import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { User, InsertUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool, db } from "./db";
import { z } from "zod";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Extend Express User interface
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      salespersonName?: string;
      publicSlug?: string;
      role: string;
    }
  }
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  role: z.enum(["admin", "supervisor", "encargado_area", "salesperson", "client", "tecnico_obra", "jefe_planta", "mantencion", "laboratorio", "produccion", "logistica_bodega", "planificacion", "bodega_materias_primas"]).default("client"),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase(),
  password: z.string().min(1, "La contraseña es requerida"),
});

export function setupAuth(app: Express) {
  // Session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool, // Share the existing pool instead of creating separate connections
    createTableIfMissing: true, // Crear tabla automáticamente si no existe (crítico para producción)
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: "lax", // Required for Safari compatibility
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport Local Strategy
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.password) {
            return done(null, false, { message: "Usuario no encontrado" });
          }

          const isValidPassword = await bcrypt.compare(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: "Contraseña incorrecta" });
          }

          // Comprador dado de baja por su titular. El chequeo se limita a los
          // compradores del Market (parentUserId) A PROPÓSITO: aplicarlo a todas las
          // cuentas dejaría afuera a cualquier usuario histórico de la intranet que
          // hoy tenga is_active = false y siga entrando.
          if ((user as any).parentUserId && (user as any).isActive === false) {
            return done(null, false, { message: "Tu cuenta está desactivada. Contacta al titular de la cuenta." });
          }

          return done(null, {
            ...user,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            profileImageUrl: user.profileImageUrl || undefined,
            salespersonName: (user as any).salespersonName || undefined,
            publicSlug: (user as any).publicSlug || undefined,
            role: user.role || 'user'
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        ...user,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profileImageUrl: user.profileImageUrl || undefined,
        salespersonName: user.salespersonName || undefined,
        publicSlug: (user as any).publicSlug || undefined,
        role: user.role || 'user'
      });
    } catch (error) {
      console.error("Deserialize error:", error);
      done(null, false);
    }
  });

  // Registration endpoint
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({
          message: "Ya existe un usuario con este email"
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);

      // Create user
      const userData: InsertUser = {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: validatedData.role,
      };

      const user = await storage.createUser(userData);

      // Log in user
      const userForLogin = {
        ...user,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profileImageUrl: user.profileImageUrl || undefined,
        role: user.role || 'user'
      };

      req.login(userForLogin, (err) => {
        if (err) return next(err);
        res.status(201).json({
          id: userForLogin.id,
          email: userForLogin.email,
          firstName: userForLogin.firstName,
          lastName: userForLogin.lastName,
          role: userForLogin.role,
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Datos inválidos",
          errors: error.errors,
        });
      }
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/auth/login", (req, res, next) => {
    try {
      const validatedData = loginSchema.parse(req.body);

      passport.authenticate("local", (err: any, user: User | false, info: any) => {
        if (err) return next(err);

        if (!user) {
          return res.status(401).json({
            message: info?.message || "Credenciales inválidas",
          });
        }

        const userForLogin = {
          ...user,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          profileImageUrl: user.profileImageUrl || undefined,
          role: user.role || 'user'
        };

        req.login(userForLogin, (err) => {
          if (err) return next(err);
          res.json({
            id: userForLogin.id,
            email: userForLogin.email,
            firstName: userForLogin.firstName,
            lastName: userForLogin.lastName,
            role: userForLogin.role,
            salespersonName: (userForLogin as any).salespersonName,
            // Mismo contrato que GET /api/auth/user: el front cachea esta respuesta
            // como usuario actual, así que si faltan estos campos el portal del cliente
            // arranca sin la sección de usuarios hasta el siguiente refetch.
            parentUserId: (userForLogin as any).parentUserId ?? null,
            isSubUser: !!(userForLogin as any).parentUserId,
            canCreateSubUsers: !!(userForLogin as any).canCreateSubUsers,
          });
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Datos inválidos",
          errors: error.errors,
        });
      }
      next(error);
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Sesión cerrada exitosamente" });
    });
  });

  // Get current user endpoint
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user as User;
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      salespersonName: user.salespersonName,
      publicSlug: (user as any).publicSlug,
      assignedSegment: (user as any).assignedSegment,
      supervisorId: (user as any).supervisorId,
      // Panorámica Market: si es comprador (parentUserId) el front oculta crédito y
      // documentos, y avisa que sus pedidos pasan por el titular. canCreateSubUsers
      // habilita la sección "Usuarios" del titular.
      parentUserId: (user as any).parentUserId ?? null,
      isSubUser: !!(user as any).parentUserId,
      canCreateSubUsers: !!(user as any).canCreateSubUsers,
    });
  });

  // PATCH /api/auth/update-profile — Update current user email/password
  app.patch("/api/auth/update-profile", requireAuth, async (req: any, res) => {
    try {
      const { email, password, currentPassword } = req.body;
      const user = req.user as User;

      if (!email && !password) {
        return res.status(400).json({ message: "Se requiere email o contraseña para actualizar." });
      }

      // Verify current password first
      const fullUser = await storage.getUser(user.id);
      if (!fullUser || !fullUser.password) {
        return res.status(404).json({ message: "Usuario no encontrado." });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, fullUser.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "La contraseña actual es incorrecta." });
      }

      const updateData: any = {};

      if (email && email !== user.email) {
        // Check if email already exists
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "Ya existe un usuario con este email." });
        }
        updateData.email = email.toLowerCase();
      }

      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ message: "La nueva contraseña debe tener al menos 6 caracteres." });
        }
        updateData.password = await bcrypt.hash(password, 12);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No hay cambios para guardar." });
      }

      const updatedUser = await storage.updateUser(fullUser.id, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado tras actualización." });
      }

      if (email && email !== user.email && req.user) {
        req.user.email = email;
      }

      res.json({ 
        message: "Perfil actualizado correctamente.", 
        user: { 
          id: updatedUser.id, 
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName
        } 
      });
    } catch (error: any) {
      console.error("Error updating profile:", error?.message || error);
      if (error?.stack) console.error("Stack trace:", error.stack);
      
      res.status(500).json({ 
        message: "Error al actualizar perfil: " + (error?.message || "Desconocido") 
      });
    }
  });
}

// Auth middleware
export const requireAuth = (req: any, res: any, next: any) => {
  console.log('🔐 [AUTH] requireAuth check:', {
    isAuthenticated: req.isAuthenticated(),
    user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : null,
    sessionID: req.sessionID,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (!req.isAuthenticated()) {
    console.warn('❌ [AUTH] Authentication failed for:', {
      url: req.url,
      method: req.method,
      sessionID: req.sessionID,
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({ message: "No autenticado" });
  }

  console.log('✅ [AUTH] Authentication successful for:', {
    user: { id: req.user.id, email: req.user.email, role: req.user.role },
    url: req.url,
    method: req.method
  });
  next();
};

// Role-based authorization middleware
export const requireRoles = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    console.log('🔒 [AUTHORIZATION] requireRoles check:', {
      requiredRoles: roles,
      isAuthenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : null,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    if (!req.isAuthenticated()) {
      console.warn('❌ [AUTHORIZATION] Not authenticated for role check:', {
        url: req.url,
        method: req.method,
        requiredRoles: roles
      });
      return res.status(401).json({ message: "No autenticado" });
    }

    const userRole = req.user?.role;
    console.log('👤 [AUTHORIZATION] User role check:', {
      userRole,
      requiredRoles: roles,
      hasValidRole: userRole && roles.includes(userRole)
    });

    if (!userRole || !roles.includes(userRole)) {
      console.warn('❌ [AUTHORIZATION] Insufficient permissions:', {
        userRole,
        requiredRoles: roles,
        url: req.url,
        method: req.method,
        user: { id: req.user.id, email: req.user.email }
      });
      return res.status(403).json({
        message: "Acceso denegado. No tienes permisos para realizar esta acción."
      });
    }

    console.log('✅ [AUTHORIZATION] Role authorization successful:', {
      userRole,
      requiredRoles: roles,
      url: req.url,
      method: req.method
    });
    next();
  };
};

// Convenience middleware for admin/supervisor only
export const requireAdminOrSupervisor = requireRoles(['admin', 'supervisor', 'encargado_area']);
export const requireMailingAccess = requireRoles(['admin', 'supervisor', 'encargado_area', 'reception']);

// Commercial Module Role-Based Access Control
// Access to commercial modules (CRM, Metas, Usuarios, Sales Analytics Dashboard, Clientes, Pedidos, Marketing, Gastos, ETL, API Keys)
// Allows: admin, supervisor, encargado_area, salesperson, tecnico_obra, jefe_planta, logistica_bodega (dashboard and invoices viewing)
// Excludes: mantencion, laboratorio, produccion, planificacion, bodega_materias_primas, client, and all area_* roles
export const requireCommercialAccess = requireRoles([
  'admin',
  'supervisor',
  'encargado_area',
  'salesperson',
  'tecnico_obra',
  'jefe_planta',
  'logistica_bodega',
  'reception'
]);

// Marketing Module Access Control
// Access to the Marketing module (inventario, gastos, presupuesto, solicitudes, creatividades).
// Same commercial roles as requireCommercialAccess, plus the dedicated `marketing` role.
// Kept separate so the marketing role does not gain access to sales/CRM/dashboard endpoints.
export const requireMarketingAccess = requireRoles([
  'admin',
  'supervisor',
  'encargado_area',
  'salesperson',
  'tecnico_obra',
  'jefe_planta',
  'logistica_bodega',
  'reception',
  'marketing'
]);

// Plant Operations Access Control
// Access to plant operational functions like inventory sync, CMMS, etc.
// Allows: admin, supervisor, encargado_area, jefe_planta, mantencion, and all plant departmental roles
// Excludes: salesperson, tecnico_obra, client
export const requirePlantOperationsAccess = requireRoles([
  'admin',
  'supervisor',
  'encargado_area',
  'jefe_planta',
  'mantencion',
  'laboratorio',
  'produccion',
  'logistica_bodega',
  'planificacion',
  'bodega_materias_primas'
]);

// CMMS Module Role-Based Access Control
// Full access to all CMMS modules (equipos, proveedores, presupuestos, gastos, etc.)
export const requireCMMSFullAccess = requireRoles(['admin', 'jefe_planta']);

// Maintenance access (OT, planes preventivos, mantenciones, calendario)
export const requireCMMSMaintenance = requireRoles(['admin', 'jefe_planta', 'mantencion']);

// Plant staff access (ver OT y calendario, crear OT)
export const requireCMMSPlantStaff = requireRoles([
  'admin',
  'jefe_planta',
  'mantencion',
  'supervisor',
  'encargado_area',
  'laboratorio',
  'bodega_materias_primas',
  'logistica_bodega',
  'produccion',
  'planificacion'
]);