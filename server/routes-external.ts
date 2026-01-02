import { Router } from 'express';
import { storage } from './storage';
import { validateApiKey, requireApiRole, type ApiAuthRequest } from './middleware/api-auth';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const router = Router();

// All external API routes require API key authentication
router.use(validateApiKey);

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
    const { startDate, endDate, salesperson, segment, limit = '100', offset = '0' } = req.query;

    const result = await storage.getSalesTransactions({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      salesperson: salesperson as string | undefined,
      segment: segment as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
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
    const { search, limit = '100', offset = '0' } = req.query;

    const clients = await storage.getAllClients({
      search: search as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
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
    const users = await storage.getAllUsers();

    // Don't expose passwords
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
    }));

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CRM Leads (Read & Write)
// ============================================

router.get('/crm/leads', async (req: ApiAuthRequest, res) => {
  try {
    const { stage, salespersonId, limit = '100', offset = '0' } = req.query;

    const leads = await storage.getCrmLeads({
      stage: stage as string | undefined,
      salespersonId: salespersonId as string | undefined,
    });

    res.json(leads);
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/crm/leads', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const leadData = req.body;
    const newLead = await storage.createCrmLead(leadData);
    res.status(201).json(newLead);
  } catch (error) {
    console.error('Error creating CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/crm/leads/:id', requireApiRole(['read_write', 'admin']), async (req: ApiAuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = await storage.updateCrmLead(id, updates);
    
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
    const deleted = await storage.deleteCrmLead(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting CRM lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Notifications (Read & Create)
// ============================================

router.get('/notificaciones', async (req: ApiAuthRequest, res) => {
  try {
    const { type, priority, departamento, archived, limit = '100' } = req.query;

    const notifications = await storage.getNotifications({
      type: type as any,
      priority: priority as any,
      departamento: departamento as string | undefined,
      includeArchived: archived === 'true',
    });

    res.json(notifications.slice(0, parseInt(limit as string)));
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
      type: type || 'general',
      priority: priority || 'media',
      departamento: departamento || null,
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
    const { estado, areaResponsable, limit = '100' } = req.query;

    const reclamos = await storage.getAllReclamosGenerales();

    // Filter if needed
    let filtered = reclamos;
    if (estado) {
      filtered = filtered.filter(r => r.estado === estado);
    }
    if (areaResponsable) {
      filtered = filtered.filter(r => r.areaResponsable === areaResponsable);
    }

    res.json(filtered.slice(0, parseInt(limit as string)));
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
    const { estado, tipoMantencion, limit = '100' } = req.query;

    const solicitudes = await storage.getAllSolicitudesMantencion();

    // Filter if needed
    let filtered = solicitudes;
    if (estado) {
      filtered = filtered.filter(s => s.estado === estado);
    }
    if (tipoMantencion) {
      filtered = filtered.filter(s => s.tipoMantencion === tipoMantencion);
    }

    res.json(filtered.slice(0, parseInt(limit as string)));
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
    const { assignedTo, status, limit = '100' } = req.query;

    const tasks = await storage.getAllTasks();

    // Filter if needed
    let filtered = tasks;
    if (assignedTo) {
      filtered = filtered.filter(t => 
        t.assignments?.some(a => a.userId === assignedTo)
      );
    }
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }

    res.json(filtered.slice(0, parseInt(limit as string)));
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

    const newTask = await storage.createTask(taskData);
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
    const deleted = await storage.deleteTask(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

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
    const { bodega, sucursal, limit = '100', offset = '0' } = req.query;

    const products = await storage.getInventoryProducts({
      search: '',
      bodega: bodega as string | undefined,
      sucursal: sucursal as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json(products);
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
    const { status, limit = '100' } = req.query;

    const orders = await storage.getEcommerceOrders();

    // Filter if needed
    let filtered = orders;
    if (status) {
      filtered = filtered.filter(o => o.status === status);
    }

    res.json(filtered.slice(0, parseInt(limit as string)));
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

    const updated = await storage.updateEcommerceOrderStatus(id, status);
    
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

    const periodStr = period as string || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    const filterTypeStr = filterType as 'month' | 'year' | 'day';

    // Calculate date range based on period and filterType
    let startDate: string;
    let endDate: string;
    const currentYear = periodStr.split('-')[0];

    if (filterTypeStr === 'year') {
      startDate = `${currentYear}-01-01`;
      endDate = `${currentYear}-12-31`;
    } else if (filterTypeStr === 'month') {
      const [year, month] = periodStr.split('-');
      startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // day
      startDate = periodStr;
      endDate = periodStr;
    }

    // 1. Ventas Totales del período
    const salesMetrics = await storage.getSalesMetrics({
      period: periodStr,
      filterType: filterTypeStr,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined,
      client: client as string | undefined,
    });

    // 2. Total Acumulado del Año (YTD)
    const yearMetrics = await storage.getSalesMetrics({
      period: `${currentYear}-01`,
      filterType: 'year',
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
    let salesTrend: Array<{ date: string; sales: number }> = [];
    try {
      if (filterTypeStr === 'year') {
        // Tendencia mensual para el año
        const trendData = await storage.getSalesChartData(
          'monthly',
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
      salesTotal: salesMetrics.totalSales,
      unitsSold: salesMetrics.totalUnits,
      transactionCount: salesMetrics.transactionCount,
      averageTicket: salesMetrics.averageTicket,
      yearToDateTotal: yearMetrics.totalSales,
      globalGoal,
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
      combinedTotal: salesMetrics.totalSales + nvvPending.totalAmount + gdvPending.gdvSales,
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