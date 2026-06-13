/**
 * Servicio de Roles y Permisos
 * ---------------------------------------------------------------
 * Resuelve los permisos efectivos de cada rol combinando los defaults
 * de shared/permissions.ts con los overrides guardados en la tabla
 * role_permissions, y expone los endpoints de administración.
 *
 * Diseño resiliente:
 * - La tabla se crea en runtime (CREATE TABLE IF NOT EXISTS) porque el
 *   runner de migraciones no es confiable en producción.
 * - Si la DB falla, se responde con los defaults de código: la app
 *   nunca queda inutilizable por este sistema.
 * - El rol `admin` siempre tiene todos los permisos (no configurable).
 */
import type { Express } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { rolePermissions } from "../shared/schema";
import {
  ALL_PERMISSION_KEYS,
  CONFIGURABLE_ROLES,
  ROLE_LABELS,
  computeEffectivePermissions,
  isValidPermissionKey,
} from "../shared/permissions";
import { requireAuth, requireRoles } from "./auth";

// ─── Tabla en runtime (el deploy de migraciones no es confiable) ───

let ensureTablePromise: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          role varchar NOT NULL,
          permission_key varchar NOT NULL,
          allowed boolean NOT NULL DEFAULT true,
          updated_by varchar,
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_permissions_role_key"
        ON role_permissions (role, permission_key)
      `);
    })().catch((error) => {
      ensureTablePromise = null; // permite reintentar en la próxima llamada
      throw error;
    });
  }
  return ensureTablePromise;
}

// ─── Cache de overrides (TTL corto para soportar multi-instancia) ───

const CACHE_TTL_MS = 30_000;

interface OverridesCache {
  byRole: Map<string, Record<string, boolean>>;
  loadedAt: number;
}

let overridesCache: OverridesCache | null = null;

async function loadOverrides(): Promise<Map<string, Record<string, boolean>>> {
  const now = Date.now();
  if (overridesCache && now - overridesCache.loadedAt < CACHE_TTL_MS) {
    return overridesCache.byRole;
  }
  await ensureTable();
  const rows = await db.select().from(rolePermissions);
  const byRole = new Map<string, Record<string, boolean>>();
  for (const row of rows) {
    if (!isValidPermissionKey(row.permissionKey)) continue; // clave obsoleta del catálogo
    let rolePerms = byRole.get(row.role);
    if (!rolePerms) {
      rolePerms = {};
      byRole.set(row.role, rolePerms);
    }
    rolePerms[row.permissionKey] = row.allowed;
  }
  overridesCache = { byRole, loadedAt: now };
  return byRole;
}

export function invalidatePermissionsCache() {
  overridesCache = null;
}

// ─── API del servicio ───

/**
 * Permisos efectivos de un rol (defaults + overrides). Si la DB no
 * responde, cae a los defaults de código para no romper la app.
 */
export async function getEffectivePermissions(role: string): Promise<Record<string, boolean>> {
  if (role === "admin") return computeEffectivePermissions("admin");
  try {
    const overrides = await loadOverrides();
    return computeEffectivePermissions(role, overrides.get(role) || null);
  } catch (error: any) {
    console.error("⚠️ [PERMISSIONS] No se pudieron leer overrides, usando defaults:", error?.message);
    return computeEffectivePermissions(role);
  }
}

export async function roleHasPermission(role: string, permissionKey: string): Promise<boolean> {
  if (role === "admin") return true;
  const effective = await getEffectivePermissions(role);
  return !!effective[permissionKey];
}

/**
 * Middleware: exige que el rol del usuario tenga el permiso indicado.
 * Úsalo además de requireAuth/requireRoles en endpoints de módulos
 * cuya visibilidad es configurable.
 */
export const requirePermission = (permissionKey: string) => {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const role = req.user?.role;
    if (role === "admin") return next();
    const allowed = role ? await roleHasPermission(role, permissionKey) : false;
    if (!allowed) {
      return res.status(403).json({
        message: "Acceso denegado. Tu rol no tiene habilitado este módulo.",
      });
    }
    next();
  };
};

// ─── Endpoints ───

const EDITABLE_ROLES = CONFIGURABLE_ROLES.filter((r) => r !== "admin");

const updatePermissionsSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
});

async function getUserCountsByRole(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const result = await db.execute(sql`
      SELECT role, COUNT(*)::int AS count FROM (
        SELECT role FROM salespeople_users WHERE is_active = true AND role IS NOT NULL
        UNION ALL
        SELECT role FROM users WHERE role IS NOT NULL
      ) all_users
      GROUP BY role
    `);
    for (const row of (result.rows || []) as any[]) {
      counts[row.role] = Number(row.count) || 0;
    }
  } catch (error: any) {
    console.error("⚠️ [PERMISSIONS] No se pudo contar usuarios por rol:", error?.message);
  }
  return counts;
}

export function registerPermissionRoutes(app: Express) {
  // Permisos efectivos del usuario autenticado (consumido por el frontend)
  app.get("/api/permissions/me", requireAuth, async (req: any, res) => {
    try {
      const role = req.user?.role || "";
      const permissions = await getEffectivePermissions(role);
      res.json({ role, permissions });
    } catch (error: any) {
      console.error("Error obteniendo permisos del usuario:", error);
      res.status(500).json({ message: "Error obteniendo permisos" });
    }
  });

  // Matriz completa de roles y permisos (solo admin)
  app.get("/api/admin/role-permissions", requireRoles(["admin"]), async (_req, res) => {
    try {
      let overrides = new Map<string, Record<string, boolean>>();
      let storageAvailable = true;
      try {
        overrides = await loadOverrides();
      } catch (error: any) {
        storageAvailable = false;
        console.error("⚠️ [PERMISSIONS] Overrides no disponibles, mostrando defaults:", error?.message);
      }
      const userCounts = await getUserCountsByRole();

      const roles = CONFIGURABLE_ROLES.map((role) => {
        const roleOverrides = overrides.get(role) || null;
        return {
          role,
          label: ROLE_LABELS[role] || role,
          locked: role === "admin",
          isCustomized: role !== "admin" && !!roleOverrides && Object.keys(roleOverrides).length > 0,
          userCount: userCounts[role] || 0,
          permissions: computeEffectivePermissions(role, roleOverrides),
        };
      });

      res.json({ roles, storageAvailable });
    } catch (error: any) {
      console.error("Error obteniendo matriz de permisos:", error);
      res.status(500).json({ message: "Error obteniendo la matriz de permisos" });
    }
  });

  // Guardar permisos de un rol (snapshot completo; solo admin)
  app.put("/api/admin/role-permissions/:role", requireRoles(["admin"]), async (req: any, res) => {
    try {
      const { role } = req.params;
      if (!EDITABLE_ROLES.includes(role)) {
        return res.status(400).json({
          message: role === "admin"
            ? "El rol Administrador siempre tiene acceso completo y no puede modificarse."
            : `Rol no configurable: ${role}`,
        });
      }

      const parsed = updatePermissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Formato inválido", errors: parsed.error.flatten() });
      }
      const incoming = parsed.data.permissions;
      const invalidKeys = Object.keys(incoming).filter((key) => !isValidPermissionKey(key));
      if (invalidKeys.length > 0) {
        return res.status(400).json({ message: `Permisos desconocidos: ${invalidKeys.join(", ")}` });
      }

      await ensureTable();
      const updatedBy = req.user?.id || null;
      // Snapshot completo del catálogo para el rol: las claves no enviadas
      // conservan su default actual de forma explícita.
      const defaults = computeEffectivePermissions(role);
      const values = ALL_PERMISSION_KEYS.map((key) => ({
        role,
        permissionKey: key,
        allowed: key in incoming ? incoming[key] : defaults[key],
        updatedBy,
        updatedAt: new Date(),
      }));

      await db.transaction(async (tx) => {
        await tx.delete(rolePermissions).where(eq(rolePermissions.role, role));
        await tx.insert(rolePermissions).values(values);
      });
      invalidatePermissionsCache();

      const permissions = await getEffectivePermissions(role);
      console.log(`✅ [PERMISSIONS] Rol "${role}" actualizado por ${req.user?.email || updatedBy}`);
      res.json({ role, permissions, isCustomized: true });
    } catch (error: any) {
      console.error("Error guardando permisos del rol:", error);
      res.status(500).json({ message: "Error guardando permisos: " + (error?.message || "desconocido") });
    }
  });

  // Restaurar un rol a sus permisos por defecto (solo admin)
  app.delete("/api/admin/role-permissions/:role", requireRoles(["admin"]), async (req: any, res) => {
    try {
      const { role } = req.params;
      if (!EDITABLE_ROLES.includes(role)) {
        return res.status(400).json({ message: `Rol no configurable: ${role}` });
      }
      await ensureTable();
      await db.delete(rolePermissions).where(eq(rolePermissions.role, role));
      invalidatePermissionsCache();

      const permissions = await getEffectivePermissions(role);
      console.log(`♻️ [PERMISSIONS] Rol "${role}" restaurado a defaults por ${req.user?.email}`);
      res.json({ role, permissions, isCustomized: false });
    } catch (error: any) {
      console.error("Error restaurando permisos del rol:", error);
      res.status(500).json({ message: "Error restaurando permisos: " + (error?.message || "desconocido") });
    }
  });
}
