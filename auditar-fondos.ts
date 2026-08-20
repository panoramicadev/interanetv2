/**
 * Audita los movimientos de fondos contra los gastos reales.
 *
 * Existe porque el saldo de un fondo no se guarda: se calcula sumando
 * fund_movements. Si un movimiento queda desalineado con su gasto —el gasto se
 * borró, le cambiaron el monto, lo movieron de fondo o se rechazó por la ruta
 * vieja— el fondo sigue descontando plata que nadie gastó. Es el síntoma de
 * "no usé el fondo pero el saldo bajó".
 *
 * Uso:
 *   npx tsx -r dotenv/config auditar-fondos.ts                 # informe de todo
 *   npx tsx -r dotenv/config auditar-fondos.ts --fondo=biobio  # filtra por nombre de fondo
 *   npx tsx -r dotenv/config auditar-fondos.ts --persona=chaparro
 *   npx tsx -r dotenv/config auditar-fondos.ts --fix           # corrige lo que encuentre
 *
 * Sin --fix no escribe nada.
 */
import { db } from './server/db';
import { fundAllocations, fundMovements, gastosEmpresariales, users } from './shared/schema';
import { eq, inArray } from 'drizzle-orm';

const args = process.argv.slice(2);
const aplicar = args.includes('--fix');
const filtroFondo = args.find((a) => a.startsWith('--fondo='))?.split('=')[1]?.toLowerCase();
const filtroPersona = args.find((a) => a.startsWith('--persona='))?.split('=')[1]?.toLowerCase();

const clp = (n: number) =>
  `$${Math.round(n).toLocaleString('es-CL')}`;

/** El tipo de movimiento que le corresponde a un gasto según su estado. */
function tipoEsperado(gasto: typeof gastosEmpresariales.$inferSelect) {
  if (gasto.estado === 'rechazado' || gasto.estadoAprobacion === 'rechazado') return 'gasto_rechazado';
  if (gasto.estado === 'aprobado' || gasto.estadoAprobacion === 'aprobado') return 'gasto_aprobado';
  return 'gasto_pendiente';
}

async function main() {
  const allocations = await db.select().from(fundAllocations);
  const equipo = await db.select().from(users);
  const nombrePersona = (id: string) => {
    const u = equipo.find((x) => x.id === id);
    if (!u) return id;
    return u.salespersonName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || id;
  };

  const enFoco = allocations.filter((a) => {
    if (filtroFondo && !(a.nombre || '').toLowerCase().includes(filtroFondo)) return false;
    if (filtroPersona && !nombrePersona(a.assignedToId).toLowerCase().includes(filtroPersona)) return false;
    return true;
  });

  if (enFoco.length === 0) {
    console.log('No hay fondos que coincidan con el filtro.');
    process.exit(0);
  }

  const idsFondo = enFoco.map((a) => a.id);
  const movimientos = await db.select().from(fundMovements).where(inArray(fundMovements.allocationId, idsFondo));

  const idsGasto = Array.from(new Set(movimientos.map((m) => m.gastoId).filter(Boolean))) as string[];
  const gastos = idsGasto.length
    ? await db.select().from(gastosEmpresariales).where(inArray(gastosEmpresariales.id, idsGasto))
    : [];
  const gastoPorId = new Map(gastos.map((g) => [g.id, g]));

  const problemas: Array<{ movimientoId: string; fondo: string; detalle: string; efecto: number }> = [];

  for (const fondo of enFoco) {
    const movs = movimientos.filter((m) => m.allocationId === fondo.id);
    const inicial = parseFloat(fondo.montoInicial?.toString() || '0');

    let comprometido = 0;
    let aprobado = 0;
    let ajustes = 0;
    for (const m of movs) {
      const monto = Math.abs(parseFloat(m.monto?.toString() || '0'));
      if (m.tipoMovimiento === 'gasto_pendiente') comprometido += monto;
      else if (m.tipoMovimiento === 'gasto_aprobado') aprobado += monto;
      else if (m.tipoMovimiento === 'ajuste') ajustes += parseFloat(m.monto?.toString() || '0');
    }
    const saldo = inicial + ajustes - comprometido - aprobado;

    console.log('');
    console.log(`━━ ${fondo.nombre}  ·  ${nombrePersona(fondo.assignedToId)}  ·  ${fondo.estado}`);
    console.log(`   entregado ${clp(inicial)}   rendido ${clp(comprometido + aprobado)}   saldo ${clp(saldo)}`);

    for (const m of movs) {
      // Marcas de cierre y ajustes manuales no cuelgan de un gasto.
      if (!m.gastoId) continue;

      const gasto = gastoPorId.get(m.gastoId);
      const monto = Math.abs(parseFloat(m.monto?.toString() || '0'));

      if (!gasto) {
        problemas.push({
          movimientoId: m.id,
          fondo: fondo.nombre,
          detalle: `movimiento huérfano: el gasto ${m.gastoId} ya no existe (descuenta ${clp(monto)})`,
          efecto: m.tipoMovimiento === 'gasto_rechazado' ? 0 : monto,
        });
        continue;
      }

      if (gasto.fundAllocationId !== fondo.id) {
        problemas.push({
          movimientoId: m.id,
          fondo: fondo.nombre,
          detalle: `el gasto "${gasto.descripcion || gasto.categoria}" hoy está en otro fondo, pero el cargo de ${clp(monto)} quedó acá`,
          efecto: monto,
        });
        continue;
      }

      if (gasto.fundingMode !== 'con_fondo') {
        problemas.push({
          movimientoId: m.id,
          fondo: fondo.nombre,
          detalle: `el gasto "${gasto.descripcion || gasto.categoria}" pasó a reembolso, pero sigue descontando ${clp(monto)}`,
          efecto: monto,
        });
        continue;
      }

      const montoGasto = Math.abs(parseFloat(gasto.monto?.toString() || '0'));
      if (Math.abs(montoGasto - monto) > 0.5) {
        problemas.push({
          movimientoId: m.id,
          fondo: fondo.nombre,
          detalle: `"${gasto.descripcion || gasto.categoria}" vale ${clp(montoGasto)} pero descuenta ${clp(monto)}`,
          efecto: monto - montoGasto,
        });
        continue;
      }

      const esperado = tipoEsperado(gasto);
      if (esperado !== m.tipoMovimiento) {
        problemas.push({
          movimientoId: m.id,
          fondo: fondo.nombre,
          detalle: `"${gasto.descripcion || gasto.categoria}" está ${gasto.estado} pero el movimiento dice ${m.tipoMovimiento}`,
          efecto: esperado === 'gasto_rechazado' ? monto : 0,
        });
      }
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  if (problemas.length === 0) {
    console.log('✅ Todos los movimientos coinciden con sus gastos.');
    process.exit(0);
  }

  const plataFantasma = problemas.reduce((acc, p) => acc + p.efecto, 0);
  console.log(`⚠️  ${problemas.length} movimiento(s) desalineado(s). Saldo descontado de más: ${clp(plataFantasma)}`);
  for (const p of problemas) {
    console.log(`   · [${p.fondo}] ${p.detalle}`);
  }

  if (!aplicar) {
    console.log('');
    console.log('Corré de nuevo con --fix para corregirlos.');
    process.exit(0);
  }

  console.log('');
  console.log('Corrigiendo...');
  const { storage } = await import('./server/storage');
  let corregidos = 0;
  for (const p of problemas) {
    const mov = movimientos.find((m) => m.id === p.movimientoId)!;
    if (!mov.gastoId || !gastoPorId.has(mov.gastoId)) {
      await db.delete(fundMovements).where(eq(fundMovements.id, mov.id));
    } else {
      await storage.syncFundMovementForGasto(mov.gastoId, mov.creadoPorId);
    }
    corregidos++;
  }
  console.log(`✅ ${corregidos} movimiento(s) corregido(s). Volvé a correr sin --fix para verificar.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
