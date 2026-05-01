import { Router } from 'express';
import { storage } from './storage';
import { validateApiKey, requireApiRole, type ApiAuthRequest } from './middleware/api-auth';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './db';
import { users, notifications, ecommerceOrders, salespeopleUsers } from '@shared/schema';
import { desc, eq, and, or, sql } from 'drizzle-orm';

const router = Router();

// All external API routes require API key authentication
router.use(validateApiKey);

// Parse `limit` from query string with sensible defaults for AI/chat clients.
// Default 500 rows, hard cap 5000 to protect the DB.
function parseLimit(raw: unknown, def = 500, max = 5000): number {
  const n = parseInt((raw as string) ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

function parseOffset(raw: unknown): number {
  const n = parseInt((raw as string) ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// ============================================
// Self-describing help endpoint (for AI/chat clients)
// ============================================

router.get('/help', async (_req: ApiAuthRequest, res) => {
  res.json({
    description: 'External API for Panorámica intranet — read & write access for integrations and AI assistants.',
    auth: { header: 'X-API-Key', roles: ['readonly', 'read_write', 'admin'] },
    pagination: { default_limit: 500, max_limit: 5000, params: ['limit', 'offset'] },
    endpoints: {
      'GET /ventas': { filters: ['startDate', 'endDate', 'salesperson', 'segment', 'client', 'product', 'client_rut', 'limit', 'offset'] },
      'GET /clientes': { filters: ['search', 'segment', 'salesperson', 'creditStatus', 'businessType', 'debtStatus', 'entityType', 'salesPeriod', 'limit', 'offset'] },
      'GET /usuarios': { filters: ['role', 'source (users|salespeople|all)', 'limit'], note: 'returns { users, salespeople, counts }' },
      'GET /notificaciones': { filters: ['type', 'priority', 'departamento', 'archived', 'targetType', 'userId', 'limit', 'offset'] },
      'POST /notificaciones': { body: ['title*', 'message*', 'type', 'priority', 'departamento', 'actionUrl'] },
      'GET /reclamos': { filters: ['estado', 'areaResponsable', 'gravedad', 'vendedorId', 'tecnicoId', 'responsableAreaId', 'limit', 'offset'] },
      'POST /reclamos': { body: ['clienteNombre*', 'motivo*', 'clienteRut', 'clienteEmail', 'clienteTelefono', 'descripcion', 'severidad'] },
      'GET /mantencion': { filters: ['estado', 'tipoMantencion', 'gravedad', 'area', 'solicitanteId', 'tecnicoAsignadoId', 'limit', 'offset'] },
      'POST /mantencion': { body: ['equipoNombre*', 'descripcionProblema*', 'equipoCodigo', 'equipoArea', 'tipoMantencion', 'severidad', 'solicitadoPor'] },
      'GET /tareas': { filters: ['assignedTo', 'status', 'priority', 'creatorId', 'limit', 'offset'] },
      'POST /tareas': { body: ['title*', 'description', 'priority', 'dueDate', 'createdBy', 'assignments[]'] },
      'PATCH /tareas/:id': { body: ['status', 'notes', '...'] },
      'DELETE /tareas/:id': {},
      'GET /inventario': { filters: ['search', 'bodega', 'limit', 'offset'], note: 'returns { total, offset, limit, items }' },
      'GET /ecommerce/orders': { filters: ['status', 'clientId', 'salespersonId', 'limit', 'offset'] },
      'PATCH /ecommerce/orders/:id': { body: ['status*'] },
      'GET /crm/leads': { filters: ['stage', 'salespersonId', 'supervisorId', 'segment', 'limit', 'offset'] },
      'POST /crm/leads': { body: ['clientName*', 'salespersonId*', 'clientPhone', 'clientEmail', 'clientType', 'estimatedValue', 'notes', 'stage', 'segment'] },
      'PATCH /crm/leads/:id': { body: ['stage', 'notes', '...'] },
      'DELETE /crm/leads/:id': {},
      'GET /productos': { filters: ['search', 'unidad', 'tipoProducto', 'color', 'limit', 'offset'], note: 'flat list with all price tiers' },
      'GET /productos/grupos': { filters: ['search', 'categoria', 'soloActivos', 'limit', 'offset'], note: 'grouped like the store: parent product + color/format variations with prices' },
      'GET /productos/:codigo': { note: 'product detail + stock per warehouse' },
      'GET /cotizaciones': { filters: ['status', 'createdBy', 'salespersonName', 'clientName', 'dateFrom', 'dateTo', 'limit', 'offset'], note: 'returns quote + creatorName' },
      'GET /cotizaciones/:id': { note: 'returns quote + items[]' },
      'POST /cotizaciones': { body: ['clientName*', 'salespersonName*', 'clientRut', 'clientEmail', 'clientPhone', 'clientAddress', 'validUntil', 'paymentCondition', 'segment', 'subtotal', 'discount', 'taxRate', 'taxAmount', 'total', 'notes', 'items[]'] },
      'PATCH /cotizaciones/:id': { body: ['salespersonName', 'status', 'notes', 'validUntil', '...'] },
      'PATCH /cotizaciones/:id/status': { body: ['status* (draft|sent|accepted|rejected|converted)'] },
      'DELETE /cotizaciones/:id': {},
      'GET /cotizaciones/:id/items': {},
      'POST /cotizaciones/:id/items': { body: ['productName*', 'quantity*', 'unitPrice*', 'type (standard|custom)', 'productCode', 'productUnit', 'notes'] },
      'PATCH /cotizaciones/items/:itemId': { body: ['quantity', 'unitPrice', 'productName', '...'] },
      'DELETE /cotizaciones/items/:itemId': {},
      'GET /dashboard': { filters: ['period (YYYY | YYYY-MM | YYYY-MM-DD)', 'filterType', 'segment', 'salesperson', 'client'] },
    },
  });
});

// ============================================
// API Keys Management (admin only)
// ============================================

router.get('/api-keys', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const keys = await storage.getApiKeys();
    
    // Don't return the actual key hash
    const sanitizedKeys = keys.map(key => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      name: key.name,
      description: key.description,
      role: key.role,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      createdBy: key.createdBy,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
    }));

    res.json(sanitizedKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api-keys', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { name, description, role, expiresAt } = req.body;

    if (!name || !req.apiKey) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Generate a random API key
    const apiKey = `mk_${role}_${nanoid(32)}`;
    const keyHash = await bcrypt.hash(apiKey, 10);
    const keyPrefix = apiKey.substring(0, 16) + '...';

    const newKey = await storage.createApiKey({
      name,
      description,
      role: role || 'readonly',
      createdBy: req.apiKey.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      keyHash,
      keyPrefix,
    });

    // Return the full API key ONLY on creation (it won't be accessible again)
    res.json({
      ...newKey,
      apiKey, // Only shown once
      keyHash: undefined, // Don't expose hash
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/api-keys/:id/toggle', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updated = await storage.toggleApiKeyStatus(id, isActive);
    
    if (!updated) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ ...updated, keyHash: undefined });
  } catch (error) {
    console.error('Error toggling API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api-keys/:id', requireApiRole(['admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteApiKey(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Sales Transactions (Read)
// ============================================

router.get('/ventas', async (req: ApiAuthRequest, res) => {
  try {
    const { startDate, endDate, salesperson, segment, client, product, client_rut } = req.query;

    const result = await storage.getSalesTransactions({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      salesperson: salesperson as string | undefined,
      segment: segment as string | undefined,
      client: client as string | undefined,
      product: product as string | undefined,
      client_rut: client_rut as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Clients (Read)
// ============================================

router.get('/clientes', async (req: ApiAuthRequest, res) => {
  try {
    const { search, segment, salesperson, creditStatus, businessType, debtStatus, entityType, salesPeriod } = req.query;

    const clients = await storage.getClients({
      search: search as string | undefined,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      creditStatus: creditStatus as string | undefined,
      businessType: businessType as string | undefined,
      debtStatus: debtStatus as string | undefined,
      entityType: entityType as string | undefined,
      salesPeriod: salesPeriod as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Users (Read)
// ============================================

router.get('/usuarios', async (req: ApiAuthRequest, res) => {
  try {
    const { role, source = 'all' } = req.query;
    const lim = parseLimit(req.query.limit);

    const usersList = source !== 'salespeople'
      ? await (async () => {
          const conditions = [];
          if (role) conditions.push(eq(users.role, role as string));
          let q = db
            .select({
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              role: users.role,
              createdAt: users.createdAt,
            })
            .from(users);
          if (conditions.length > 0) q = q.where(and(...conditions)) as typeof q;
          return await q.orderBy(desc(users.createdAt)).limit(lim);
        })()
      : [];

    const salespeopleList = source !== 'users'
      ? await (async () => {
          const conditions = [eq(salespeopleUsers.isActive, true)];
          if (role) conditions.push(eq(salespeopleUsers.role, role as string));
          return await db
            .select({
              id: salespeopleUsers.id,
              salespersonName: salespeopleUsers.salespersonName,
              username: salespeopleUsers.username,
              email: salespeopleUsers.email,
              role: salespeopleUsers.role,
              supervisorId: salespeopleUsers.supervisorId,
              assignedSegment: salespeopleUsers.assignedSegment,
              isActive: salespeopleUsers.isActive,
              createdAt: salespeopleUsers.createdAt,
            })
            .from(salespeopleUsers)
            .where(and(...conditions))
            .orderBy(desc(salespeopleUsers.createdAt))
            .limit(lim);
        })()
      : [];

    res.json({
      users: usersList,
      salespeople: salespeopleList,
      counts: { users: usersList.length, salespeople: salespeopleList.length },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Notifications (Read & Create)
// ============================================

router.get('/notificaciones', async (req: ApiAuthRequest, res) => {
  try {
    const { type, priority, departamento, archived, targetType, userId } = req.query;

    const conditions = [];
    if (type) conditions.push(eq(notifications.type, type as string));
    if (priority) conditions.push(eq(notifications.priority, priority as string));
    if (departamento) conditions.push(eq(notifications.department, departamento as string));
    if (targetType) conditions.push(eq(notifications.targetType, targetType as string));
    if (userId) conditions.push(eq(notifications.userId, userId as string));
    if (archived !== undefined) conditions.push(eq(notifications.isArchived, archived === 'true'));

    let query = db.select().from(notifications);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query
      .orderBy(desc(notifications.createdAt))
      .limit(parseLimit(req.query.limit))
      .offset(parseOffset(req.query.offset));

    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notificaciones', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { title, message, type, priority, departamento, actionUrl } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const notification = await storage.createNotification({
      title,
      message,
      type: type || 'manual',
      priority: priority || 'media',
      targetType: departamento ? 'departamento' : 'general',
      department: departamento || null,
      actionUrl: actionUrl || null,
      createdBy: 'api', // Mark as created by API
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Reclamos Generales (Read & Create)
// ============================================

router.get('/reclamos', async (req: ApiAuthRequest, res) => {
  try {
    const { estado, areaResponsable, gravedad, vendedorId, tecnicoId, responsableAreaId } = req.query;

    const reclamos = await storage.getReclamosGenerales({
      estado: estado as string | undefined,
      areaResponsable: areaResponsable as string | undefined,
      gravedad: gravedad as string | undefined,
      vendedorId: vendedorId as string | undefined,
      tecnicoId: tecnicoId as string | undefined,
      responsableAreaId: responsableAreaId as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    res.json(reclamos);
  } catch (error) {
    console.error('Error fetching reclamos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reclamos', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const reclamoData = req.body;
    
    if (!reclamoData.clienteNombre || !reclamoData.motivo) {
      return res.status(400).json({ error: 'Client name and motivo are required' });
    }

    const newReclamo = await storage.createReclamoGeneral(reclamoData);
    res.status(201).json(newReclamo);
  } catch (error) {
    console.error('Error creating reclamo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Maintenance Requests (Read & Create)
// ============================================

router.get('/mantencion', async (req: ApiAuthRequest, res) => {
  try {
    const { estado, tipoMantencion, gravedad, area, solicitanteId, tecnicoAsignadoId } = req.query;

    const solicitudes = await storage.getSolicitudesMantencion({
      estado: estado as string | undefined,
      gravedad: gravedad as string | undefined,
      area: area as string | undefined,
      solicitanteId: solicitanteId as string | undefined,
      tecnicoAsignadoId: tecnicoAsignadoId as string | undefined,
      limit: parseLimit(req.query.limit),
      offset: parseOffset(req.query.offset),
    });

    const filtered = tipoMantencion
      ? solicitudes.filter((s: any) => s.tipoMantencion === tipoMantencion)
      : solicitudes;

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mantencion', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const mantencionData = req.body;
    
    if (!mantencionData.equipoNombre || !mantencionData.descripcionProblema) {
      return res.status(400).json({ error: 'Equipment name and problem description are required' });
    }

    const newSolicitud = await storage.createSolicitudMantencion(mantencionData);
    res.status(201).json(newSolicitud);
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Tasks (Read & Write)
// ============================================

router.get('/tareas', async (req: ApiAuthRequest, res) => {
  try {
    const { assignedTo, status, priority, creatorId } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const tasks = await storage.getTasks({
      status: status as string | undefined,
      priority: priority as string | undefined,
      creatorId: creatorId as string | undefined,
      assigneeUserId: assignedTo as string | undefined,
      userRole: 'admin',
      userId: 'api',
    });

    res.json(tasks.slice(off, off + lim));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tareas', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const taskData = req.body;
    
    if (!taskData.title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const { assignments = [], ...taskFields } = taskData;
    const newTask = await storage.createTask(taskFields, assignments);
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tareas/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = await storage.updateTask(id, updates);
    
    if (!updated) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tareas/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.deleteTask(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Inventory (Read only)
// ============================================

router.get('/inventario', async (req: ApiAuthRequest, res) => {
  try {
    const { bodega, search } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const all = await storage.getInventory({
      search: search as string | undefined,
      warehouse: bodega as string | undefined,
    });

    res.json({
      total: all.length,
      offset: off,
      limit: lim,
      items: all.slice(off, off + lim),
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// E-commerce Orders (Read)
// ============================================

router.get('/ecommerce/orders', async (req: ApiAuthRequest, res) => {
  try {
    const { status, clientId, salespersonId } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const orders = await storage.getEcommerceOrders({
      status: status as string | undefined,
      clientId: clientId as string | undefined,
      salespersonId: salespersonId as string | undefined,
    });

    res.json(orders.slice(off, off + lim));
  } catch (error) {
    console.error('Error fetching e-commerce orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/ecommerce/orders/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const [updated] = await db
      .update(ecommerceOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(ecommerceOrders.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating e-commerce order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CRM Leads (Read & Write)
// ============================================

router.get('/crm/leads', async (req: ApiAuthRequest, res) => {
  try {
    const { stage, salespersonId, supervisorId, segment } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const leads = await storage.getAllLeads({
      stage: stage as string | undefined,
      salespersonId: salespersonId as string | undefined,
      supervisorId: supervisorId as string | undefined,
      segment: segment as string | undefined,
    });

    res.json(leads.slice(off, off + lim));
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/crm/leads', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const leadData = req.body;

    if (!leadData.clientName || !leadData.salespersonId) {
      return res.status(400).json({ error: 'clientName and salespersonId are required' });
    }

    const newLead = await storage.createLead(leadData);
    res.status(201).json(newLead);
  } catch (error) {
    console.error('Error creating CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/crm/leads/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const updated = await storage.updateLead(id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/crm/leads/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.deleteLead(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Productos & Lista de precios (Read)
// Para que un asistente IA pueda buscar productos antes de cotizar.
// ============================================

// GET /productos — búsqueda flat sobre price_list
// Devuelve cada producto con TODOS sus precios (lista, descuentos, mínimo, canal digital, oferta).
router.get('/productos', async (req: ApiAuthRequest, res) => {
  try {
    const { search, unidad, tipoProducto, color } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const result = await storage.getPriceList({
      search: search as string | undefined,
      unidad: unidad as string | undefined,
      tipoProducto: tipoProducto as string | undefined,
      color: color as string | undefined,
      limit: lim,
      offset: off,
    });

    // Normalizar campos de precio a números para que sean fáciles de usar
    const items = (result.items || []).map((p: any) => ({
      codigo: p.codigo,
      producto: p.producto,
      unidad: p.unidad,
      precioLista: Number(p.lista) || 0,
      precioDesc10: Number(p.desc10) || 0,
      precioDesc10_5: Number(p.desc10_5) || 0,
      precioDesc10_5_3: Number(p.desc10_5_3) || 0,
      precioMinimo: Number(p.minimo) || 0,
      precioCanalDigital: Number(p.canalDigital) || 0,
      precioOferta: p.offerPrice ? Number(p.offerPrice) : null,
      esPersonalizado: p.esPersonalizado === 'Si',
      modoPrecio: p.modoPrecio,
      cantidadProducto: p.cantidadProducto ? Number(p.cantidadProducto) : null,
      unidadMedida: p.unidadMedida,
      rendimiento: p.rendimiento ? Number(p.rendimiento) : null,
    }));

    res.json({
      total: result.totalCount ?? items.length,
      offset: off,
      limit: lim,
      items,
    });
  } catch (error) {
    console.error('Error fetching productos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /productos/grupos — productos agrupados como en la tienda
// Cada grupo (ej: "Esmalte al agua") tiene N variaciones (colores/formatos), cada una con su código y precio.
// Permite que Claude responda "qué colores hay de Esmalte al agua y cuánto cuestan".
router.get('/productos/grupos', async (req: ApiAuthRequest, res) => {
  try {
    const { search, categoria, soloActivos } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    const allGroups = await storage.getProductGroupsWithVariations();

    let filtered = allGroups;
    if (categoria) {
      const cat = (categoria as string).toLowerCase();
      filtered = filtered.filter(g => (g.categoria || '').toLowerCase().includes(cat));
    }
    if (search) {
      const s = (search as string).toLowerCase();
      filtered = filtered.filter(g =>
        g.nombre.toLowerCase().includes(s) ||
        (g.descripcion || '').toLowerCase().includes(s) ||
        g.variations.some(v =>
          v.codigo.toLowerCase().includes(s) ||
          v.producto.toLowerCase().includes(s) ||
          (v.color || '').toLowerCase().includes(s)
        )
      );
    }
    if (soloActivos !== 'false') {
      filtered = filtered
        .filter(g => g.activo)
        .map(g => ({ ...g, variations: g.variations.filter(v => v.activo) }))
        .filter(g => g.variations.length > 0);
    }

    res.json({
      total: filtered.length,
      offset: off,
      limit: lim,
      groups: filtered.slice(off, off + lim),
    });
  } catch (error) {
    console.error('Error fetching grupos de productos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /productos/:codigo — detalle por código exacto + stock por bodega
router.get('/productos/:codigo', async (req: ApiAuthRequest, res) => {
  try {
    const { codigo } = req.params;

    // 1) Buscar en price_list por código
    const priceListResult = await storage.getPriceList({ search: codigo, limit: 5 });
    const product = (priceListResult.items || []).find((p: any) => p.codigo === codigo);

    if (!product) {
      return res.status(404).json({ error: `Producto '${codigo}' no encontrado` });
    }

    // 2) Stock por bodega
    let stock: any[] = [];
    try {
      const stockRows = await storage.getProductStock(codigo);
      stock = stockRows.map((s: any) => ({
        warehouseCode: s.warehouseCode,
        branchCode: s.branchCode,
        warehouseLocation: s.warehouseLocation,
        physicalStock: Number(s.physicalStock1) || 0,
        availableStock: Number(s.availableStock1) || 0,
        committedStock: Number(s.committedStock1) || 0,
        lastUpdated: s.lastUpdated,
      }));
    } catch (e) {
      console.error('Error fetching stock for product:', e);
    }

    const totalAvailable = stock.reduce((sum, s) => sum + s.availableStock, 0);

    res.json({
      codigo: product.codigo,
      producto: product.producto,
      unidad: product.unidad,
      precios: {
        lista: Number(product.lista) || 0,
        desc10: Number(product.desc10) || 0,
        desc10_5: Number(product.desc10_5) || 0,
        desc10_5_3: Number(product.desc10_5_3) || 0,
        minimo: Number(product.minimo) || 0,
        canalDigital: Number(product.canalDigital) || 0,
        oferta: product.offerPrice ? Number(product.offerPrice) : null,
      },
      esPersonalizado: product.esPersonalizado === 'Si',
      modoPrecio: product.modoPrecio,
      cantidadProducto: product.cantidadProducto ? Number(product.cantidadProducto) : null,
      unidadMedida: product.unidadMedida,
      rendimiento: product.rendimiento ? Number(product.rendimiento) : null,
      stockTotal: totalAvailable,
      stockPorBodega: stock,
    });
  } catch (error) {
    console.error('Error fetching producto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Cotizaciones / Presupuestos (Read & Write)
// Same data the "tomador de pedidos" uses (quotes + quote_items).
// ============================================

// Resolve a salesperson name to a users.id (FK quotes.createdBy expects).
// Tries salespeople_users.salespersonName, then full name in users (firstName + lastName),
// then exact email match. Returns { id, displayName } or null.
async function resolveSalesperson(name: string): Promise<{ id: string; displayName: string } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // 1) salespeople_users by salespersonName (case-insensitive)
  const [sp] = await db
    .select({ id: salespeopleUsers.id, name: salespeopleUsers.salespersonName, email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(sql`LOWER(${salespeopleUsers.salespersonName}) = LOWER(${trimmed})`)
    .limit(1);
  if (sp) {
    // Prefer the matching users row (so quotes.createdBy → users.id) when available
    if (sp.email) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, sp.email)).limit(1);
      if (u) return { id: u.id, displayName: sp.name };
    }
    return { id: sp.id, displayName: sp.name };
  }

  // 2) users by full name "First Last"
  const [u2] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(sql`LOWER(TRIM(COALESCE(${users.firstName},'') || ' ' || COALESCE(${users.lastName},''))) = LOWER(${trimmed})`)
    .limit(1);
  if (u2) {
    const display = [u2.firstName, u2.lastName].filter(Boolean).join(' ') || u2.email || trimmed;
    return { id: u2.id, displayName: display };
  }

  // 3) users by exact email
  const [u3] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, trimmed)).limit(1);
  if (u3) return { id: u3.id, displayName: u3.email || trimmed };

  return null;
}

// GET /cotizaciones — list with rich filters and resolved creator name
router.get('/cotizaciones', async (req: ApiAuthRequest, res) => {
  try {
    const { status, createdBy, salespersonName, clientName, dateFrom, dateTo } = req.query;
    const lim = parseLimit(req.query.limit);
    const off = parseOffset(req.query.offset);

    let createdById = createdBy as string | undefined;
    if (!createdById && salespersonName) {
      const resolved = await resolveSalesperson(salespersonName as string);
      if (!resolved) return res.status(404).json({ error: `Vendedor '${salespersonName}' no encontrado` });
      createdById = resolved.id;
    }

    const result = await storage.getQuotes({
      status: status as string | undefined,
      createdBy: createdById,
      clientName: clientName as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      limit: lim,
      offset: off,
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching cotizaciones:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cotizaciones/:id — full quote with items
router.get('/cotizaciones/:id', async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const quote = await storage.getQuoteById(id);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    const items = await storage.getQuoteItems(id);
    res.json({ ...quote, items });
  } catch (error) {
    console.error('Error fetching cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cotizaciones — create quote header (items added separately)
router.post('/cotizaciones', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { salespersonName, items, ...body } = req.body ?? {};

    if (!body.clientName) {
      return res.status(400).json({ error: 'clientName es requerido' });
    }
    if (!salespersonName) {
      return res.status(400).json({ error: 'salespersonName es requerido' });
    }

    const resolved = await resolveSalesperson(salespersonName);
    if (!resolved) {
      return res.status(404).json({ error: `Vendedor '${salespersonName}' no encontrado` });
    }

    const quote = await storage.createQuote({
      ...body,
      createdBy: resolved.id,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    } as any);

    // Optional: create items in the same call
    const createdItems = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const newItem = await storage.addQuoteItem(quote.id, item);
        createdItems.push(newItem);
      }
    }

    res.status(201).json({
      ...quote,
      salespersonName: resolved.displayName,
      items: createdItems,
    });
  } catch (error) {
    console.error('Error creating cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cotizaciones/:id — update header fields
router.patch('/cotizaciones/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { salespersonName, ...updates } = req.body ?? {};

    const patch: any = { ...updates };
    if (updates.validUntil) patch.validUntil = new Date(updates.validUntil);

    if (salespersonName) {
      const resolved = await resolveSalesperson(salespersonName);
      if (!resolved) return res.status(404).json({ error: `Vendedor '${salespersonName}' no encontrado` });
      patch.createdBy = resolved.id;
    }

    const updated = await storage.updateQuote(id, patch);
    if (!updated) return res.status(404).json({ error: 'Cotización no encontrada' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cotizaciones/:id/status — change status only
router.patch('/cotizaciones/:id/status', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};
    const allowed = ['draft', 'sent', 'accepted', 'rejected', 'converted'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status inválido (válidos: ${allowed.join(', ')})` });
    }

    const updated = await storage.updateQuote(id, { status });
    if (!updated) return res.status(404).json({ error: 'Cotización no encontrada' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating cotización status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /cotizaciones/:id
router.delete('/cotizaciones/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteQuote(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting cotización:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cotizaciones/:id/items
router.get('/cotizaciones/:id/items', async (req: ApiAuthRequest, res) => {
  try {
    const items = await storage.getQuoteItems(req.params.id);
    res.json(items);
  } catch (error) {
    console.error('Error fetching quote items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cotizaciones/:id/items — add a single item
router.post('/cotizaciones/:id/items', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const item = req.body ?? {};

    if (!item.productName || item.quantity === undefined || item.unitPrice === undefined) {
      return res.status(400).json({ error: 'productName, quantity y unitPrice son requeridos' });
    }
    if (!item.type) item.type = item.productCode ? 'standard' : 'custom';

    const newItem = await storage.addQuoteItem(id, item);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding quote item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cotizaciones/items/:itemId — update item
router.patch('/cotizaciones/items/:itemId', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const updated = await storage.updateQuoteItem(req.params.itemId, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating quote item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /cotizaciones/items/:itemId
router.delete('/cotizaciones/items/:itemId', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    await storage.deleteQuoteItem(req.params.itemId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Dashboard de Ventas (Read) - Datos Agregados
// ============================================

router.get('/dashboard', async (req: ApiAuthRequest, res) => {
  try {
    const { 
      period, 
      filterType = 'month',
      segment,
      salesperson,
      client
    } = req.query;

    // Support formats: YYYY (year), YYYY-MM (month), YYYY-MM-DD (day)
    const periodStr = period as string || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    
    // Auto-detect filterType based on period format if not explicitly set
    let filterTypeStr = filterType as 'month' | 'year' | 'day';
    if (!req.query.filterType) {
      if (/^\d{4}$/.test(periodStr)) {
        filterTypeStr = 'year';
      } else if (/^\d{4}-\d{2}$/.test(periodStr)) {
        filterTypeStr = 'month';
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(periodStr)) {
        filterTypeStr = 'day';
      }
    }

    // Calculate date range based on period and filterType
    let startDate: string;
    let endDate: string;
    let targetYear: string;

    if (filterTypeStr === 'year') {
      // Accept both "2025" and "2025-01" formats for year
      targetYear = periodStr.split('-')[0];
      startDate = `${targetYear}-01-01`;
      endDate = `${targetYear}-12-31`;
    } else if (filterTypeStr === 'month') {
      const [year, month] = periodStr.split('-');
      targetYear = year;
      startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // day
      targetYear = periodStr.split('-')[0];
      startDate = periodStr;
      endDate = periodStr;
    }

    // 1. Ventas Totales del período (usando startDate y endDate calculados)
    const salesMetrics = await storage.getSalesMetrics({
      startDate,
      endDate,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      client: client as string | undefined,
    });

    // 2. Total Acumulado del Año (full year for target year)
    const yearStartDate = `${targetYear}-01-01`;
    const yearEndDate = `${targetYear}-12-31`;
    const yearMetrics = await storage.getSalesMetrics({
      startDate: yearStartDate,
      endDate: yearEndDate,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      client: client as string | undefined,
    });

    // 3. Meta Global del período (si es mes)
    let globalGoal = null;
    if (filterTypeStr === 'month') {
      try {
        const goals = await storage.getGoalsProgress(periodStr);
        const globalGoalData = goals.find(g => g.type === 'global');
        if (globalGoalData) {
          globalGoal = {
            targetAmount: Number(globalGoalData.targetAmount),
            currentSales: Number(globalGoalData.currentSales),
            percentage: globalGoalData.percentage,
            period: globalGoalData.period,
          };
        }
      } catch (e) {
        console.error('Error fetching goals:', e);
      }
    }

    // 4. Ventas por Segmento (with filters applied)
    const segmentsData = await storage.getSegmentAnalysis(
      startDate,
      endDate,
      salesperson as string | undefined,
      segment as string | undefined
    );

    // 5. Tendencia de Ventas (con filtros aplicados)
    let salesTrend: Array<{ date: string; month?: string; sales: number }> = [];
    try {
      if (filterTypeStr === 'year') {
        // Tendencia mensual para el año - garantiza 12 meses
        const trendData = await storage.getSalesChartData(
          'monthly',
          startDate,
          endDate,
          salesperson as string | undefined,
          segment as string | undefined,
          client as string | undefined
        );
        
        // Create a map of existing data
        const dataMap = new Map(trendData.map(t => [t.period, t.sales]));
        
        // Generate all 12 months for the year
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        salesTrend = monthNames.map((monthName, index) => {
          const monthNum = String(index + 1).padStart(2, '0');
          const periodKey = `${targetYear}-${monthNum}`;
          return {
            date: periodKey,
            month: monthName,
            sales: dataMap.get(periodKey) || 0,
          };
        });
      } else {
        // Tendencia diaria para el mes
        const trendData = await storage.getSalesChartData(
          'daily',
          startDate,
          endDate,
          salesperson as string | undefined,
          segment as string | undefined,
          client as string | undefined
        );
        salesTrend = trendData.map(t => ({
          date: t.period,
          sales: t.sales,
        }));
      }
    } catch (e) {
      console.error('Error fetching sales trend:', e);
    }

    // 6. NVV y GDV pendientes (siempre disponible - son datos en vivo del mes actual)
    let nvvPending = { totalAmount: 0, pendingCount: 0, totalQuantity: 0, confirmedCount: 0 };
    let gdvPending = { gdvSales: 0, gdvCount: 0 };
    
    try {
      nvvPending = await storage.getNvvSummaryMetrics({
        segment: segment as string | undefined,
        salesperson: salesperson as string | undefined,
        client: client as string | undefined,
      });
    } catch (e) {
      console.error('Error fetching NVV metrics:', e);
    }

    try {
      gdvPending = await storage.getGdvPendingGlobal({
        segment: segment as string | undefined,
        salesperson: salesperson as string | undefined,
        client: client as string | undefined,
      });
    } catch (e) {
      console.error('Error fetching GDV metrics:', e);
    }

    // Respuesta consolidada
    res.json({
      period: periodStr,
      year: parseInt(targetYear),
      filterType: filterTypeStr,
      dateRange: {
        startDate,
        endDate,
      },
      filters: {
        segment: segment || null,
        salesperson: salesperson || null,
        client: client || null,
      },
      // Métricas del período solicitado (ej: solo diciembre si period=2025-12)
      salesTotal: salesMetrics.totalSales,
      unitsSold: salesMetrics.totalUnits,
      // transactionCount: solo ventas facturadas (excluye GDV), alineado con salesTotal
      transactionCount: salesMetrics.salesTransactionCount,
      // transactionCountAll: todas las transacciones incluyendo GDV
      transactionCountAll: salesMetrics.totalTransactions,
      activeCustomers: salesMetrics.activeCustomers,
      // averageTicket: calculado solo sobre ventas facturadas
      averageTicket: salesMetrics.salesTransactionCount > 0 
        ? Math.round(salesMetrics.totalSales / salesMetrics.salesTransactionCount) 
        : 0,
      // Métricas anuales (contexto del año completo)
      yearStats: {
        yearTotal: yearMetrics.totalSales,
        yearUnitsSold: yearMetrics.totalUnits,
        // yearTransactions: solo ventas facturadas del año
        yearTransactions: yearMetrics.salesTransactionCount,
        // yearTransactionsAll: todas las transacciones del año incluyendo GDV
        yearTransactionsAll: yearMetrics.totalTransactions,
        yearActiveCustomers: yearMetrics.activeCustomers,
        note: `Totales acumulados del año ${targetYear} completo (transactionCount excluye GDV, transactionCountAll incluye GDV)`
      },
      globalGoal,
      // Pendientes (datos en vivo, sin filtro de fecha)
      nvvPending: {
        totalAmount: nvvPending.totalAmount,
        count: nvvPending.pendingCount,
        note: 'NVV son Notas de Venta Vigentes pendientes de facturar (datos en vivo)'
      },
      gdvPending: {
        totalAmount: gdvPending.gdvSales,
        count: gdvPending.gdvCount,
        note: 'GDV son Guías de Despacho Vigentes pendientes de facturar (datos en vivo)'
      },
      // Combined = salesTotal (ventas facturadas del período) + NVV pendientes + GDV pendientes
      combinedTotal: salesMetrics.totalSales + nvvPending.totalAmount + gdvPending.gdvSales,
      combinedTotalNote: 'salesTotal (solo ventas facturadas) + nvvPending.totalAmount + gdvPending.totalAmount',
      salesBySegment: segmentsData.map(s => ({
        segment: s.segment,
        totalSales: s.totalSales,
        percentage: s.percentage,
      })),
      salesTrend,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;