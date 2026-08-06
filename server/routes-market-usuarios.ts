/**
 * Compradores (sub-usuarios) de un cliente de Panorámica Market.
 *
 * El problema: un cliente con varios locales o encargados tenía UNA sola cuenta.
 * O compartía la clave del titular —y cualquiera compraba a nombre de la empresa
 * sin control— o llamaba por teléfono para cada pedido.
 *
 * Cómo queda: la intranet habilita la función en la ficha del cliente
 * ("Permitir crear usuarios"). El titular crea compradores desde su panel; cada
 * comprador entra al Market con su propio correo y clave, ve el catálogo con los
 * precios de la empresa y arma pedidos. Esos pedidos nacen en 'pending_client':
 * NO le llegan a Panorámica hasta que el titular los aprueba desde su panel.
 *
 * Un comprador es otro registro role='client' en salespeople_users con
 * parent_user_id = id del titular y el MISMO client_id, así hereda ficha, lista de
 * precios, crédito y convenios sin duplicar datos. Todo lo que distingue a un
 * comprador de un titular es tener parent_user_id.
 */
import type { Express } from 'express';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from './db';
import { requireAuth } from './auth';
import { storage } from './storage';
import { clients, ecommerceOrders, salespeopleUsers } from '../shared/schema';
import { avisarPedidoNuevo, consumirCupoDeCredito } from './services/ecommerce-order-flow';

/** Roles de la intranet que pueden habilitar la función en la ficha del cliente. */
const ROLES_INTRANET = ['admin', 'supervisor', 'encargado_area'];

const esComprador = (usuario: any) => !!usuario?.parentUserId;

/** El titular: cliente del Market que no depende de nadie. */
const esTitular = (usuario: any) => usuario?.role === 'client' && !usuario?.parentUserId;

const crearSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  email: z.string().trim().email('Correo inválido').max(160),
  password: z.string().min(6, 'La clave debe tener al menos 6 caracteres').max(100),
});

const actualizarSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  password: z.string().min(6).max(100).optional(),
  isActive: z.boolean().optional(),
});

/**
 * salesperson_name es UNIQUE en toda la tabla (la comparten vendedores y clientes),
 * así que dos compradores llamados "Juan Pérez" de empresas distintas chocarían.
 * Guardamos "Nombre · Empresa" y, si aún choca, numeramos.
 */
async function nombreDisponible(nombre: string, empresa: string): Promise<string> {
  const base = `${nombre} · ${empresa}`.slice(0, 190);
  for (let intento = 0; intento < 25; intento++) {
    const candidato = intento === 0 ? base : `${base} (${intento + 1})`;
    const [existe] = await db
      .select({ id: salespeopleUsers.id })
      .from(salespeopleUsers)
      .where(eq(salespeopleUsers.salespersonName, candidato))
      .limit(1);
    if (!existe) return candidato;
  }
  return `${base} (${Date.now()})`;
}

/** Datos del comprador que ve el titular (nunca el hash de la clave). */
const vistaComprador = (fila: any) => ({
  id: fila.id,
  name: fila.displayName || fila.salespersonName,
  email: fila.email,
  isActive: fila.isActive !== false,
  createdAt: fila.createdAt,
});

/**
 * Cuenta titular del Market de una ficha de cliente.
 *
 * Primero por el vínculo directo (client_id) y, si no, por RUT normalizado: las
 * cuentas viejas quedaron sin client_id y así es como las reconoce el listado de
 * clientes. Siempre parent_user_id IS NULL — los compradores heredan el client_id
 * y el RUT del titular, y sin ese filtro se devolvería a uno de ellos.
 */
async function resolverTitularDeFicha(fichaId: string, ecommerceUserId?: string | null) {
  // Camino preferido: la ficha ya resolvió la cuenta (es lo que muestra como
  // "En eCommerce") y nos pasa su id. Evita depender del calce por RUT, que falla
  // cuando la ficha del ERP guarda el RUT sin dígito verificador y la cuenta con él.
  if (ecommerceUserId) {
    const [porId] = await db
      .select()
      .from(salespeopleUsers)
      .where(and(
        eq(salespeopleUsers.id, ecommerceUserId),
        eq(salespeopleUsers.role, 'client'),
        isNull(salespeopleUsers.parentUserId),
      ))
      .limit(1);
    if (porId) return porId;
  }

  const [porVinculo] = await db
    .select()
    .from(salespeopleUsers)
    .where(and(
      eq(salespeopleUsers.role, 'client'),
      eq(salespeopleUsers.clientId, fichaId),
      isNull(salespeopleUsers.parentUserId),
    ))
    .orderBy(salespeopleUsers.createdAt)
    .limit(1);
  if (porVinculo) return porVinculo;

  const [ficha] = await db
    .select({ rten: clients.rten })
    .from(clients)
    .where(eq(clients.id, fichaId))
    .limit(1);
  const rutLimpio = (ficha?.rten || '').replace(/[.\-\s]/g, '').toUpperCase();
  if (!rutLimpio) return undefined;

  // El ERP a veces guarda el RUT sin dígito verificador ("77454264") y la cuenta
  // del Market con él ("77.454.264-7"). Comparamos ambos lados por el cuerpo del
  // RUT —sin el último carácter cuando corresponde— para que igual calcen.
  const cuerpo = (v: string) => (v.length > 8 ? v.slice(0, -1) : v);
  const [porRut] = await db
    .select()
    .from(salespeopleUsers)
    .where(and(
      eq(salespeopleUsers.role, 'client'),
      isNull(salespeopleUsers.parentUserId),
      sql`
        CASE
          WHEN LENGTH(REPLACE(REPLACE(REPLACE(UPPER(${salespeopleUsers.clientRut}), '.', ''), '-', ''), ' ', '')) > 8
          THEN LEFT(REPLACE(REPLACE(REPLACE(UPPER(${salespeopleUsers.clientRut}), '.', ''), '-', ''), ' ', ''), LENGTH(REPLACE(REPLACE(REPLACE(UPPER(${salespeopleUsers.clientRut}), '.', ''), '-', ''), ' ', '')) - 1)
          ELSE REPLACE(REPLACE(REPLACE(UPPER(${salespeopleUsers.clientRut}), '.', ''), '-', ''), ' ', '')
        END = ${cuerpo(rutLimpio)}
      `,
    ))
    .orderBy(salespeopleUsers.createdAt)
    .limit(1);
  return porRut;
}

export function registerMarketUsuariosRoutes(app: Express): void {
  // ==========================================================================
  // INTRANET — habilitar/deshabilitar la creación de usuarios para un cliente
  // ==========================================================================
  app.patch('/api/clients/:id/market-sub-users', requireAuth, async (req: any, res) => {
    try {
      if (!ROLES_INTRANET.includes(req.user?.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const enabled = req.body?.enabled === true;
      const fichaId = req.params.id;

      const titular = await resolverTitularDeFicha(fichaId, req.body?.ecommerceUserId);
      if (!titular) {
        return res.status(404).json({
          message: 'El cliente todavía no tiene cuenta en Panorámica Market. Actívala primero.',
        });
      }

      await db
        .update(salespeopleUsers)
        .set({ canCreateSubUsers: enabled, updatedAt: new Date() })
        .where(eq(salespeopleUsers.id, titular.id));

      // Al deshabilitar dejamos a los compradores existentes sin acceso: si no, la
      // función queda "apagada" en la ficha pero su gente sigue entrando y comprando.
      let desactivados = 0;
      if (!enabled) {
        const filas = await db
          .update(salespeopleUsers)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(salespeopleUsers.parentUserId, titular.id),
            eq(salespeopleUsers.isActive, true),
          ))
          .returning({ id: salespeopleUsers.id });
        desactivados = filas.length;
      }

      console.log(`[market-sub-users] ficha ${fichaId} → ${enabled ? 'habilitado' : 'deshabilitado'} por ${req.user.id}${desactivados ? ` (${desactivados} compradores desactivados)` : ''}`);
      res.json({ success: true, enabled, titularId: titular.id, desactivados });
    } catch (error: any) {
      console.error('Error al cambiar permiso de sub-usuarios:', error);
      res.status(500).json({ message: 'No se pudo actualizar el permiso' });
    }
  });

  // ==========================================================================
  // INTRANET — restablecer la clave del panel del cliente
  //
  // Hasta ahora la única forma de dar una clave era "Activar Market", que sólo
  // corre la primera vez: si el cliente la perdía, había que tocar la base.
  // ==========================================================================
  app.post('/api/clients/:id/market-password', requireAuth, async (req: any, res) => {
    try {
      if (!ROLES_INTRANET.includes(req.user?.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const parsed = z.object({ password: z.string().min(6, 'La clave debe tener al menos 6 caracteres').max(100) })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Datos inválidos' });
      }

      const titular = await resolverTitularDeFicha(req.params.id, req.body?.ecommerceUserId);
      if (!titular) {
        return res.status(404).json({
          message: 'El cliente todavía no tiene cuenta en Panorámica Market. Actívala primero.',
        });
      }

      await db
        .update(salespeopleUsers)
        .set({ password: await bcrypt.hash(parsed.data.password, 12), updatedAt: new Date() })
        .where(eq(salespeopleUsers.id, titular.id));

      console.log(`[market-password] clave del cliente ${titular.id} restablecida por ${req.user.id}`);
      // Devolvemos con qué entra, que es lo que el ejecutivo le tiene que pasar.
      res.json({
        success: true,
        ecommerceUserId: titular.id,
        loginEmail: titular.email,
        username: titular.username,
      });
    } catch (error: any) {
      console.error('Error al restablecer la clave del cliente:', error);
      res.status(500).json({ message: 'No se pudo restablecer la clave' });
    }
  });

  // ==========================================================================
  // PORTAL DEL CLIENTE — el titular administra a sus compradores
  // ==========================================================================
  app.get('/api/ecommerce/client/sub-users', requireAuth, async (req: any, res) => {
    try {
      if (!esTitular(req.user)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const filas = await db
        .select()
        .from(salespeopleUsers)
        .where(eq(salespeopleUsers.parentUserId, req.user.id))
        .orderBy(desc(salespeopleUsers.createdAt));

      // Pedidos por aprobar de cada comprador, para mostrarlo junto a su ficha.
      const pendientes = await db
        .select({
          createdByUserId: ecommerceOrders.createdByUserId,
          total: sql<number>`COUNT(*)`,
        })
        .from(ecommerceOrders)
        .where(and(
          eq(ecommerceOrders.clientId, req.user.id),
          eq(ecommerceOrders.status, 'pending_client'),
        ))
        .groupBy(ecommerceOrders.createdByUserId);

      const porComprador = new Map(pendientes.map((p: any) => [p.createdByUserId, Number(p.total) || 0]));

      res.json({
        canCreateSubUsers: !!req.user.canCreateSubUsers,
        subUsers: filas.map((f: any) => ({
          ...vistaComprador(f),
          // El nombre guardado lleva el sufijo "· Empresa" por la restricción UNIQUE.
          name: String(f.salespersonName || '').split(' · ')[0],
          pendingOrders: porComprador.get(f.id) || 0,
        })),
      });
    } catch (error: any) {
      console.error('Error al listar compradores:', error);
      res.status(500).json({ message: 'No se pudieron obtener los usuarios' });
    }
  });

  app.post('/api/ecommerce/client/sub-users', requireAuth, async (req: any, res) => {
    try {
      if (!esTitular(req.user)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      if (!req.user.canCreateSubUsers) {
        return res.status(403).json({
          message: 'Tu cuenta no tiene habilitada la creación de usuarios. Pídeselo a tu vendedor de Panorámica.',
        });
      }

      const parsed = crearSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Datos inválidos' });
      }
      const { name, password } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      // El correo es la credencial de login de toda la app: tiene que ser único.
      const yaExiste = await storage.getUserByEmail(email);
      if (yaExiste) {
        return res.status(409).json({ message: 'Ya existe una cuenta con ese correo.' });
      }

      // Leemos el registro del titular en vez de confiar en la sesión: clientRut no
      // viaja en ella, y sin RUT el comprador queda desvinculado de la empresa para
      // todo lo que resuelve por RUT (seguimiento de despachos, historial ERP).
      const [cuentaTitular] = await db
        .select()
        .from(salespeopleUsers)
        .where(eq(salespeopleUsers.id, req.user.id))
        .limit(1);

      if (!cuentaTitular) {
        return res.status(404).json({ message: 'No encontramos tu cuenta de Panorámica Market.' });
      }

      const empresa = String(cuentaTitular.salespersonName || 'Cliente').split(' · ')[0];
      const [creado] = await db
        .insert(salespeopleUsers)
        .values({
          salespersonName: await nombreDisponible(name, empresa),
          email,
          password: await bcrypt.hash(password, 12),
          role: 'client',
          isActive: true,
          // Hereda la ficha del titular: misma lista de precios, crédito y convenios.
          parentUserId: cuentaTitular.id,
          clientId: cuentaTitular.clientId || null,
          clientRut: cuentaTitular.clientRut || null,
          publicEmail: email,
        })
        .returning();

      console.log(`[market-sub-users] titular ${req.user.id} creó comprador ${creado.id}`);
      res.status(201).json({ ...vistaComprador(creado), name, pendingOrders: 0 });
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Ya existe una cuenta con ese correo o nombre.' });
      }
      console.error('Error al crear comprador:', error);
      res.status(500).json({ message: 'No se pudo crear el usuario' });
    }
  });

  app.patch('/api/ecommerce/client/sub-users/:id', requireAuth, async (req: any, res) => {
    try {
      if (!esTitular(req.user)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const parsed = actualizarSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Datos inválidos' });
      }

      const [comprador] = await db
        .select()
        .from(salespeopleUsers)
        .where(and(
          eq(salespeopleUsers.id, req.params.id),
          eq(salespeopleUsers.parentUserId, req.user.id),
        ))
        .limit(1);

      if (!comprador) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const cambios: any = { updatedAt: new Date() };
      if (parsed.data.password) cambios.password = await bcrypt.hash(parsed.data.password, 12);
      if (typeof parsed.data.isActive === 'boolean') {
        if (parsed.data.isActive && !req.user.canCreateSubUsers) {
          return res.status(403).json({ message: 'Tu cuenta no tiene habilitada la creación de usuarios.' });
        }
        cambios.isActive = parsed.data.isActive;
      }
      if (parsed.data.name) {
        const empresa = String(req.user.salespersonName || 'Cliente').split(' · ')[0];
        cambios.salespersonName = await nombreDisponible(parsed.data.name, empresa);
      }

      const [actualizado] = await db
        .update(salespeopleUsers)
        .set(cambios)
        .where(eq(salespeopleUsers.id, comprador.id))
        .returning();

      res.json({
        ...vistaComprador(actualizado),
        name: String(actualizado.salespersonName || '').split(' · ')[0],
      });
    } catch (error: any) {
      console.error('Error al actualizar comprador:', error);
      res.status(500).json({ message: 'No se pudo actualizar el usuario' });
    }
  });

  // ==========================================================================
  // PORTAL DEL CLIENTE — el titular aprueba o rechaza lo que armó su comprador
  // ==========================================================================
  app.post('/api/ecommerce/orders/:id/client-approve', requireAuth, async (req: any, res) => {
    try {
      if (!esTitular(req.user)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const [pedido] = await db
        .select()
        .from(ecommerceOrders)
        .where(eq(ecommerceOrders.id, req.params.id))
        .limit(1);

      if (!pedido || pedido.clientId !== req.user.id) {
        return res.status(404).json({ message: 'Pedido no encontrado' });
      }
      if (pedido.status !== 'pending_client') {
        return res.status(409).json({ message: 'Este pedido ya fue resuelto.' });
      }

      // Desde acá el pedido entra al flujo normal, igual que si lo hubiera hecho el
      // titular: a crédito y sin OC se aprueba solo; con OC o transferencia queda
      // pendiente para que recepción lo revise.
      const esCredito = pedido.paymentCondition === 'Crédito';
      const tieneOC = !!pedido.purchaseOrderPdfUrl;
      const autoAprobado = esCredito && !tieneOC;
      const ahora = new Date();

      const [actualizado] = await db
        .update(ecommerceOrders)
        .set({
          status: autoAprobado ? 'approved' : 'pending',
          clientApprovedAt: ahora,
          clientApprovedById: req.user.id,
          updatedAt: ahora,
          ...(autoAprobado ? { approvedAt: ahora, approvedById: req.user.id } : {}),
        })
        .where(and(
          eq(ecommerceOrders.id, pedido.id),
          // Candado optimista: si dos pestañas aprueban a la vez, sólo una avisa.
          eq(ecommerceOrders.status, 'pending_client'),
        ))
        .returning();

      if (!actualizado) {
        return res.status(409).json({ message: 'Este pedido ya fue resuelto.' });
      }

      if (autoAprobado) {
        await consumirCupoDeCredito(req.user.id, Number(actualizado.total) || 0);
      }

      const ficha = await storage.getClientByUserId(req.user.id).catch(() => null);
      await avisarPedidoNuevo({
        order: actualizado,
        client: ficha,
        clientName: actualizado.clientName,
        clientEmail: actualizado.clientEmail,
        assignedSalespersonId: actualizado.assignedSalespersonId,
        items: (actualizado.items as any[]) || [],
        total: Number(actualizado.total) || 0,
        subtotal: Number(actualizado.subtotal) || 0,
        tax: Number(actualizado.tax) || 0,
        paymentCondition: actualizado.paymentCondition,
        shippingAddress: actualizado.shippingAddress,
        notes: actualizado.notes,
        status: actualizado.status || 'pending',
        hasPurchaseOrder: tieneOC,
        createdByName: actualizado.createdByName,
      });

      // Avisamos al comprador que su pedido salió.
      try {
        if (actualizado.createdByUserId) {
          await storage.createNotification({
            userId: actualizado.createdByUserId,
            type: 'ecommerce_order',
            title: 'Tu pedido fue aprobado',
            message: `${req.user.salespersonName || 'El titular'} aprobó tu pedido y ya está en Panorámica.`,
            relatedOrderId: actualizado.id,
            read: false,
          });
        }
      } catch (err) {
        console.warn('Warning: no se pudo notificar al comprador:', err);
      }

      res.json(actualizado);
    } catch (error: any) {
      console.error('Error al aprobar pedido del comprador:', error);
      res.status(500).json({ message: 'No se pudo aprobar el pedido' });
    }
  });

  app.post('/api/ecommerce/orders/:id/client-reject', requireAuth, async (req: any, res) => {
    try {
      if (!esTitular(req.user)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const motivo = String(req.body?.reason || '').trim().slice(0, 500) || null;

      const [pedido] = await db
        .select()
        .from(ecommerceOrders)
        .where(eq(ecommerceOrders.id, req.params.id))
        .limit(1);

      if (!pedido || pedido.clientId !== req.user.id) {
        return res.status(404).json({ message: 'Pedido no encontrado' });
      }
      if (pedido.status !== 'pending_client') {
        return res.status(409).json({ message: 'Este pedido ya fue resuelto.' });
      }

      const ahora = new Date();
      const [actualizado] = await db
        .update(ecommerceOrders)
        .set({
          status: 'rejected',
          clientRejectedAt: ahora,
          clientRejectedById: req.user.id,
          clientRejectedReason: motivo,
          rejectedAt: ahora,
          rejectedById: req.user.id,
          rejectedReason: motivo,
          updatedAt: ahora,
        })
        .where(and(
          eq(ecommerceOrders.id, pedido.id),
          eq(ecommerceOrders.status, 'pending_client'),
        ))
        .returning();

      if (!actualizado) {
        return res.status(409).json({ message: 'Este pedido ya fue resuelto.' });
      }

      try {
        if (actualizado.createdByUserId) {
          await storage.createNotification({
            userId: actualizado.createdByUserId,
            type: 'ecommerce_order',
            title: 'Tu pedido fue rechazado',
            message: motivo
              ? `${req.user.salespersonName || 'El titular'} rechazó tu pedido: ${motivo}`
              : `${req.user.salespersonName || 'El titular'} rechazó tu pedido.`,
            relatedOrderId: actualizado.id,
            read: false,
          });
        }
      } catch (err) {
        console.warn('Warning: no se pudo notificar al comprador:', err);
      }

      res.json(actualizado);
    } catch (error: any) {
      console.error('Error al rechazar pedido del comprador:', error);
      res.status(500).json({ message: 'No se pudo rechazar el pedido' });
    }
  });
}
