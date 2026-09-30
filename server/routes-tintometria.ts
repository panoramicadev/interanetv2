/**
 * Tintometría: carta de colores y libro de fórmulas.
 *
 * Quién ve qué:
 *  - la carta (código, nombre y color) la ve quien tenga "Carta de colores":
 *    es lo que se le muestra al cliente;
 *  - las fórmulas solo quien tenga "Ver fórmulas", el operador que tiñe
 *    (decisión de Panorámica, sep-2026: por ahora solo el operador);
 *  - subir el libro en Excel, quien administra tintometría.
 */
import type { Express } from 'express';
import multer from 'multer';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { requirePermission, userHasPermission } from './permissions';
import { tintoColores, tintoFormulas } from '../shared/schema';
import { importarLibro, leerLibro } from './services/tintometria-libro';

/** Pasa si el usuario tiene al menos uno de los permisos. */
const requireAlgunPermiso = (claves: string[]) => async (req: any, res: any, next: any) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }
  for (const clave of claves) {
    if (await userHasPermission(req.user, clave)) return next();
  }
  return res.status(403).json({ message: 'Acceso denegado. No tienes habilitado este módulo.' });
};

const puedeVerCarta = requireAlgunPermiso(['tintometria.carta', 'tintometria.formulas', 'tintometria.admin']);

// El libro pesa menos de 1 MB; 15 MB deja margen sin aceptar cualquier cosa.
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const nombreDe = (u: any): string =>
  u?.salespersonName || `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.email || 'Sin nombre';

export function registerTintometriaRoutes(app: Express) {
  /**
   * Colores de una cartilla (o de todas), con cuántas fórmulas activas tiene
   * cada uno. La lista entera pesa poco (unos 2.800 colores) y el filtro se
   * hace en el navegador, así buscar no espera al servidor.
   */
  app.get('/api/tintometria/carta', requireAuth, puedeVerCarta, async (req: any, res) => {
    try {
      const cartilla = typeof req.query.cartilla === 'string' ? req.query.cartilla.toUpperCase() : null;
      const filas = await db
        .select({
          id: tintoColores.id,
          cartilla: tintoColores.cartilla,
          codigo: tintoColores.codigo,
          nombre: tintoColores.nombre,
          hex: tintoColores.hex,
          grupo: tintoColores.grupo,
          formulas: sql<number>`(
            SELECT count(*)::int FROM tinto_formulas f
            WHERE f.color_id = ${tintoColores.id} AND f.activo = true
          )`,
        })
        .from(tintoColores)
        .where(and(eq(tintoColores.activo, true), cartilla ? eq(tintoColores.cartilla, cartilla) : undefined))
        .orderBy(asc(tintoColores.cartilla), sql`${tintoColores.orden} NULLS LAST`, asc(tintoColores.codigo));
      res.json(filas);
    } catch (error: any) {
      console.error('[tintometria] no se pudo leer la carta:', error.message);
      res.status(500).json({ message: 'No se pudo cargar la carta de colores' });
    }
  });

  /** Fórmulas activas de un color: las del libro primero, después las de laboratorio. */
  app.get(
    '/api/tintometria/carta/:id/formulas',
    requireAuth,
    requirePermission('tintometria.formulas'),
    async (req: any, res) => {
      try {
        const formulas = await db
          .select()
          .from(tintoFormulas)
          .where(and(eq(tintoFormulas.colorId, req.params.id), eq(tintoFormulas.activo, true)))
          .orderBy(
            sql`CASE WHEN ${tintoFormulas.origen} = 'libro' THEN 0 ELSE 1 END`,
            asc(tintoFormulas.linea),
            asc(tintoFormulas.base),
            asc(tintoFormulas.variante),
          );
        res.json(formulas);
      } catch (error: any) {
        console.error('[tintometria] no se pudieron leer las fórmulas:', error.message);
        res.status(500).json({ message: 'No se pudieron cargar las fórmulas' });
      }
    },
  );

  /** Qué hay cargado: por cartilla y línea, colores, fórmulas, versión y última carga. */
  app.get('/api/tintometria/libro/resumen', requireAuth, requirePermission('tintometria.admin'), async (_req, res) => {
    try {
      const colores = await db.execute(sql`
        SELECT cartilla, count(*)::int AS colores,
               count(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM tinto_formulas f WHERE f.color_id = c.id AND f.activo = true
               ))::int AS con_formula
        FROM tinto_colores c
        WHERE c.activo = true
        GROUP BY cartilla
        ORDER BY cartilla
      `);
      const lineas = await db.execute(sql`
        SELECT c.cartilla, f.linea, f.origen,
               max(f.version) AS version,
               count(*)::int AS formulas,
               count(*) FILTER (WHERE f.alerta IS NOT NULL)::int AS con_alerta,
               max(f.updated_at) AS actualizado,
               (array_agg(f.creado_por_nombre ORDER BY f.updated_at DESC))[1] AS cargado_por
        FROM tinto_formulas f
        JOIN tinto_colores c ON c.id = f.color_id
        WHERE f.activo = true
        GROUP BY c.cartilla, f.linea, f.origen
        ORDER BY c.cartilla, f.linea
      `);
      res.json({ colores: (colores as any).rows ?? [], lineas: (lineas as any).rows ?? [] });
    } catch (error: any) {
      console.error('[tintometria] no se pudo armar el resumen del libro:', error.message);
      res.status(500).json({ message: 'No se pudo leer el resumen del libro' });
    }
  });

  /**
   * Sube el libro tintométrico en Excel. Lee todas las hojas con el formato
   * del libro, y con `?simular=1` solo cuenta lo que haría, sin escribir.
   */
  app.post(
    '/api/tintometria/libro/importar',
    requireAuth,
    requirePermission('tintometria.admin'),
    subida.single('archivo'),
    async (req: any, res) => {
      try {
        if (!req.file?.buffer) {
          return res.status(400).json({ message: 'Adjunta el libro tintométrico en Excel.' });
        }
        let hojas;
        try {
          hojas = leerLibro(req.file.buffer);
        } catch {
          return res.status(400).json({ message: 'No se pudo leer el archivo. ¿Es el libro en Excel (.xlsx)?' });
        }
        if (hojas.length === 0 || hojas.every((h) => h.filas.length === 0)) {
          return res.status(400).json({
            message:
              'El archivo no tiene el formato del libro tintométrico: falta la fila BASE | COLOR | COL_1… o la ficha con la LINEA.',
          });
        }
        if (req.query.simular === '1') {
          return res.json({
            simulacion: true,
            hojas: hojas.map((h) => ({ hoja: h.hoja, cartilla: h.cartilla, linea: h.linea, version: h.version, filas: h.filas.length })),
          });
        }
        const resumen = await importarLibro(hojas, { id: req.user?.id, nombre: nombreDe(req.user) });
        console.log(
          `[tintometria] libro importado por ${req.user?.email}: ${resumen.formulasNuevas} nuevas, ` +
            `${resumen.formulasActualizadas} actualizadas, ${resumen.formulasDesactivadas} desactivadas`,
        );
        res.json(resumen);
      } catch (error: any) {
        console.error('[tintometria] falló la importación del libro:', error);
        res.status(500).json({ message: 'No se pudo importar el libro. No se cambió nada.' });
      }
    },
  );
}
