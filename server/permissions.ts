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
import { rolePermissions, userPermissions } from "../shared/schema";
import {
  ALL_PERMISSION_KEYS,
  CONFIGURABLE_ROLES,
  ROLE_LABELS,
  computeEffectivePermissions,
  isValidPermissionKey,
} from "../shared/permissions";
import { requireAuth, requireRoles } from "./auth";

// ─── Tablas en runtime (el deploy de migraciones no es confiable) ───
// role_permissions y user_permissions se crean por separado: si el DDL de
// una falla en prod, la otra sigue funcionando (los overrides de rol no
// deben caerse porque no se pudo crear la tabla nueva de usuarios).

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

let ensureUserTablePromise: Promise<void> | null = null;

function ensureUserTable(): Promise<void> {
  if (!ensureUserTablePromise) {
    ensureUserTablePromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_permissions (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          user_email varchar NOT NULL,
          permission_key varchar NOT NULL,
          allowed boolean NOT NULL DEFAULT true,
          updated_by varchar,
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_permissions_email_key"
        ON user_permissions (user_email, permission_key)
      `);
    })().catch((error) => {
      ensureUserTablePromise = null;
      throw error;
    });
  }
  return ensureUserTablePromise;
}

const normalizeEmail = (email: string | null | undefined) =>
  (email || "").trim().toLowerCase();

// ─── Cache de overrides (TTL corto para soportar multi-instancia) ───
// Se cachea la PROMESA (no el valor) para que N requests concurrentes al
// expirar el TTL disparen un único SELECT y no una estampida.

const CACHE_TTL_MS = 30_000;

interface PromiseCache<T> {
  promise: Promise<T>;
  loadedAt: number;
}

let overridesCache: PromiseCache<Map<string, Record<string, boolean>>> | null = null;

function loadOverrides(): Promise<Map<string, Record<string, boolean>>> {
  const now = Date.now();
  if (overridesCache && now - overridesCache.loadedAt < CACHE_TTL_MS) {
    return overridesCache.promise;
  }
  const promise = (async () => {
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
    return byRole;
  })();
  const entry: PromiseCache<Map<string, Record<string, boolean>>> = { promise, loadedAt: now };
  overridesCache = entry;
  promise.catch(() => {
    if (overridesCache === entry) overridesCache = null; // no cachear fallos
  });
  return promise;
}

let userOverridesCache: PromiseCache<Map<string, Record<string, boolean>>> | null = null;

function loadUserOverrides(): Promise<Map<string, Record<string, boolean>>> {
  const now = Date.now();
  if (userOverridesCache && now - userOverridesCache.loadedAt < CACHE_TTL_MS) {
    return userOverridesCache.promise;
  }
  const promise = (async () => {
    await ensureUserTable();
    const rows = await db.select().from(userPermissions);
    const byEmail = new Map<string, Record<string, boolean>>();
    for (const row of rows) {
      if (!isValidPermissionKey(row.permissionKey)) continue; // clave obsoleta del catálogo
      const email = normalizeEmail(row.userEmail);
      if (!email) continue;
      let perms = byEmail.get(email);
      if (!perms) {
        perms = {};
        byEmail.set(email, perms);
      }
      perms[row.permissionKey] = row.allowed;
    }
    return byEmail;
  })();
  const entry: PromiseCache<Map<string, Record<string, boolean>>> = { promise, loadedAt: now };
  userOverridesCache = entry;
  promise.catch(() => {
    if (userOverridesCache === entry) userOverridesCache = null;
  });
  return promise;
}

export function invalidatePermissionsCache() {
  overridesCache = null;
  userOverridesCache = null;
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
 * Permisos efectivos de un USUARIO concreto: defaults del rol + overrides
 * del rol + overrides propios del usuario (los del usuario mandan sobre
 * todo lo demás). Admin siempre tiene todo. Si la DB falla se cae a los
 * permisos del rol para no romper la app.
 */
export async function getEffectivePermissionsForUser(
  email: string | null | undefined,
  role: string,
): Promise<Record<string, boolean>> {
  const base = await getEffectivePermissions(role);
  if (role === "admin") return base;
  const normalized = normalizeEmail(email);
  if (!normalized) return base;
  try {
    const userOverrides = await loadUserOverrides();
    const own = userOverrides.get(normalized);
    if (!own) return base;
    return { ...base, ...own };
  } catch (error: any) {
    console.error("⚠️ [PERMISSIONS] No se pudieron leer overrides de usuario, usando permisos del rol:", error?.message);
    return base;
  }
}

export async function userHasPermission(
  user: { email?: string | null; role?: string | null } | null | undefined,
  permissionKey: string,
): Promise<boolean> {
  const role = user?.role || "";
  if (role === "admin") return true;
  const effective = await getEffectivePermissionsForUser(user?.email, role);
  return !!effective[permissionKey];
}

/**
 * ¿Puede este usuario escribir sobre precios? Cubre lista comercial, listas
 * personalizadas (Mix, MCT, Store…) y ofertas: crear, editar, borrar, ajuste
 * masivo e importación. Antes era un chequeo de rol fijo
 * (admin/supervisor/encargado_area); ahora vive en el permiso
 * "precios.editar", que se prende o apaga por rol o por usuario desde
 * Configuración → Roles y Permisos.
 */
export async function canEditPricing(
  user: { email?: string | null; role?: string | null } | null | undefined,
): Promise<boolean> {
  return userHasPermission(user, "precios.editar");
}

/**
 * Middleware: exige que el usuario tenga el permiso indicado, combinando
 * los permisos de su rol con sus overrides personales. Úsalo además de
 * requireAuth/requireRoles en endpoints de módulos cuya visibilidad es
 * configurable.
 */
export const requirePermission = (permissionKey: string) => {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const allowed = await userHasPermission(req.user, permissionKey);
    if (!allowed) {
      return res.status(403).json({
        message: "Acceso denegado. No tienes habilitado este módulo.",
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
  // Permisos efectivos del usuario autenticado (consumido por el frontend).
  // Combina rol + overrides personales, así el sidebar y los guards de
  // ruta reflejan automáticamente la configuración por usuario.
  app.get("/api/permissions/me", requireAuth, async (req: any, res) => {
    try {
      const role = req.user?.role || "";
      const permissions = await getEffectivePermissionsForUser(req.user?.email, role);
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

  // ─── Overrides por USUARIO (visibilidad de módulos por persona) ───
  // Los administra Gestión de Usuarios: admin y supervisor.
  //
  // Límite de privilegios: el editor de permisos por ROL es solo-admin,
  // así que un supervisor NO puede usar este endpoint para concederse (ni
  // conceder) módulos arbitrarios: solo puede tocar las claves de la
  // allowlist y nunca su propio email. El admin no tiene restricciones.
  const SUPERVISOR_MANAGEABLE_KEYS = new Set(["clientes.seguimiento"]);

  // Estado actual: overrides existentes + qué permite cada rol hoy, para
  // que el cliente calcule el efectivo por usuario (override ?? rol).
  app.get("/api/admin/user-permissions", requireRoles(["admin", "supervisor"]), async (_req, res) => {
    try {
      let storageAvailable = true;
      let overrides: Array<{ email: string; permissionKey: string; allowed: boolean }> = [];
      try {
        const byEmail = await loadUserOverrides();
        for (const [email, perms] of Array.from(byEmail.entries())) {
          for (const [permissionKey, allowed] of Object.entries(perms)) {
            overrides.push({ email, permissionKey, allowed });
          }
        }
      } catch (error: any) {
        storageAvailable = false;
        console.error("⚠️ [PERMISSIONS] Overrides de usuario no disponibles:", error?.message);
      }

      const roleDefaults: Record<string, Record<string, boolean>> = {};
      for (const role of CONFIGURABLE_ROLES) {
        roleDefaults[role] = await getEffectivePermissions(role);
      }

      res.json({ overrides, roleDefaults, storageAvailable });
    } catch (error: any) {
      console.error("Error obteniendo permisos por usuario:", error);
      res.status(500).json({ message: "Error obteniendo permisos por usuario" });
    }
  });

  // Fijar/limpiar un override puntual de un usuario. allowed=null lo
  // elimina (el usuario vuelve a regirse por su rol).
  app.put("/api/admin/user-permissions", requireRoles(["admin", "supervisor"]), async (req: any, res) => {
    try {
      const parsed = z.object({
        email: z.string().trim().min(3).max(320),
        permissionKey: z.string(),
        allowed: z.boolean().nullable(),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Formato inválido", errors: parsed.error.flatten() });
      }
      const { permissionKey, allowed } = parsed.data;
      const email = normalizeEmail(parsed.data.email);
      if (!email.includes("@")) {
        return res.status(400).json({ message: "El usuario no tiene un email válido; no se puede personalizar su acceso." });
      }
      if (!isValidPermissionKey(permissionKey)) {
        return res.status(400).json({ message: `Permiso desconocido: ${permissionKey}` });
      }
      if (req.user?.role !== "admin") {
        if (!SUPERVISOR_MANAGEABLE_KEYS.has(permissionKey)) {
          return res.status(403).json({ message: "Solo un administrador puede personalizar ese permiso." });
        }
        if (email === normalizeEmail(req.user?.email)) {
          return res.status(403).json({ message: "No puedes modificar tu propio acceso; pídeselo a un administrador." });
        }
      }

      await ensureUserTable();
      if (allowed === null) {
        await db.delete(userPermissions).where(
          sql`${userPermissions.userEmail} = ${email} AND ${userPermissions.permissionKey} = ${permissionKey}`,
        );
      } else {
        await db.insert(userPermissions)
          .values({
            userEmail: email,
            permissionKey,
            allowed,
            updatedBy: req.user?.id || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [userPermissions.userEmail, userPermissions.permissionKey],
            set: { allowed, updatedBy: req.user?.id || null, updatedAt: new Date() },
          });
      }
      invalidatePermissionsCache();

      console.log(`✅ [PERMISSIONS] Override de "${permissionKey}" para ${email}: ${allowed === null ? "eliminado (rige el rol)" : allowed} — por ${req.user?.email}`);
      res.json({ email, permissionKey, allowed });
    } catch (error: any) {
      console.error("Error guardando permiso por usuario:", error);
      res.status(500).json({ message: "Error guardando el permiso: " + (error?.message || "desconocido") });
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
