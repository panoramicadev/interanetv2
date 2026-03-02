const fs = require('fs');
const file = 'server/routes.ts';
let content = fs.readFileSync(file, 'utf8');

// Insert the new routes BEFORE the hitos marketing routes
const insertionPoint = "  // ==================================================================================\n  // HITOS DE MARKETING routes (Calendario)\n  // ==================================================================================";

const newRoutes = `  // ==================================================================================
  // CREATIVIDADES MARKETING routes
  // ==================================================================================

  app.get('/api/marketing/creatividades', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { mes, anio, estado, tipo, plataforma } = req.query;
      const filters: any = {};
      
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      if (estado) filters.estado = estado;
      if (tipo) filters.tipo = tipo;
      if (plataforma) filters.plataforma = plataforma;

      const creatividades = await storage.getCreatividadesMarketing(filters);
      res.json(creatividades);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener creatividades', error: error.message });
    }
  }));

  app.get('/api/marketing/creatividades/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const creatividad = await storage.getCreatividadMarketingById(req.params.id);
      if (!creatividad) {
        return res.status(404).json({ message: 'Creatividad no encontrada' });
      }
      res.json(creatividad);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener creatividad', error: error.message });
    }
  }));

  app.post('/api/marketing/creatividades', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      const insertData = {
        ...req.body,
        creadoPorId: user.id
      };
      
      const parsedData = insertCreatividadMarketingSchema.parse(insertData);
      const nuevaCreatividad = await storage.createCreatividadMarketing(parsedData);
      
      res.status(201).json(nuevaCreatividad);
    } catch (error: any) {
      res.status(400).json({ message: 'Datos de creatividad inválidos', error: error.message || error });
    }
  }));

  app.patch('/api/marketing/creatividades/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      // Validate existence
      const existing = await storage.getCreatividadMarketingById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Creatividad no encontrada' });
      }

      const parsedData = insertCreatividadMarketingSchema.partial().parse(req.body);
      const updated = await storage.updateCreatividadMarketing(req.params.id, parsedData);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: 'Datos de actualización inválidos', error: error.message || error });
    }
  }));

  app.delete('/api/marketing/creatividades/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const existing = await storage.getCreatividadMarketingById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Creatividad no encontrada' });
      }

      await storage.deleteCreatividadMarketing(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar creatividad', error: error.message });
    }
  }));

`;

if (!content.includes('/api/marketing/creatividades')) {
  content = content.replace(insertionPoint, newRoutes + insertionPoint);
}

// Add schema to imports at the top
if (!content.includes('insertCreatividadMarketingSchema')) {
  content = content.replace(
    '  insertHitoMarketingSchema,\n  insertPrecioCompetenciaSchema,',
    '  insertHitoMarketingSchema,\n  insertPrecioCompetenciaSchema,\n  insertCreatividadMarketingSchema,'
  );
  // Also try an alternative because import order might differ
  if (!content.includes('insertCreatividadMarketingSchema')) {
    content = content.replace(
      'insertHitoMarketingSchema,',
      'insertHitoMarketingSchema, insertCreatividadMarketingSchema,'
    );
  }
}

fs.writeFileSync(file, content);
console.log('Routes added successfully');
