import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { User, InsertUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { z } from "zod";

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
      role: string;
    }
  }
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  role: z.enum(["admin", "supervisor", "salesperson", "client", "tecnico_obra", "jefe_planta", "mantencion", "laboratorio", "produccion", "logistica_bodega", "planificacion", "bodega_materias_primas"]).default("client"),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export function setupAuth(app: Express) {
  // Session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
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

          return done(null, {
            ...user,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            profileImageUrl: user.profileImageUrl || undefined,
            salespersonName: (user as any).salespersonName || undefined,
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
    });
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
export const requireAdminOrSupervisor = requireRoles(['admin', 'supervisor']);

// Commercial Module Role-Based Access Control
// Access to commercial modules (CRM, Metas, Usuarios, Dashboard, Sales Analytics, Clientes, Pedidos, Marketing, Gastos, ETL, API Keys)
// Allows: admin, supervisor, salesperson, tecnico_obra
// Excludes: jefe_planta, mantencion, laboratorio, produccion, logistica_bodega, planificacion, bodega_materias_primas, client, and all area_* roles
export const requireCommercialAccess = requireRoles([
  'admin', 
  'supervisor', 
  'salesperson', 
  'tecnico_obra'
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
  'laboratorio', 
  'bodega_materias_primas', 
  'logistica_bodega', 
  'produccion', 
  'planificacion'
]);