-- Módulo de Balance: plan de cuentas y resultado del período.
--
-- La intranet nunca había tocado contabilidad. El ETL de Softland trae ventas y
-- maestros (MAEEDO, MAEDDO, MAEEN, MAEPR, TABFU, TABBO, TABRU, TABSU) y ninguna
-- tabla contable; lo único "contable" que existía era `gasto_catalogos.cuenta_contable`
-- (texto libre, sin catálogo detrás) y `clients.contab` / `clients.subauxi`.
--
-- ⚠️ Es un ESTADO DE RESULTADOS, no un balance general: el plan que entregó el
-- cliente sólo trae 41 (ingresos), 51 (egresos de la operación) y 52 (no
-- operacionales). No hay activo, pasivo ni patrimonio.

-- El plan de cuentas. Dos códigos a propósito: Softland no rellena el mayor a
-- tres dígitos (CMAYOR = '20' en vez de '020') y deja el hueco como un espacio
-- dentro del código, así que las 20 cuentas de GASTOS DE OPERACION llegan como
-- '5120 106' cuando la cuenta real es '51020106'. `codigo` es el normalizado
-- —con el que se indexa y se compara— y `codigo_erp` la forma cruda, que es la
-- que va a venir en el archivo de saldos.
CREATE TABLE IF NOT EXISTS cuentas_contables (
  codigo varchar(20) PRIMARY KEY,
  codigo_erp varchar(20) NOT NULL,
  gran_cuenta varchar(4) NOT NULL,
  gran_cuenta_nombre varchar(120) NOT NULL,
  mayor varchar(4) NOT NULL,
  mayor_nombre varchar(120) NOT NULL,
  nombre varchar(120) NOT NULL,
  nombre_largo varchar(200),
  naturaleza varchar(10) NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cuentas_contables_codigo_erp" ON cuentas_contables (codigo_erp);
CREATE INDEX IF NOT EXISTS "IDX_cuentas_contables_gran_cuenta" ON cuentas_contables (gran_cuenta);

-- Un mes cargado. `origen` distingue de dónde vinieron los saldos: hoy se suben
-- por Excel, y si mañana se conectan las tablas contables de Softland los meses
-- viejos tienen que seguir distinguiéndose de los nuevos.
CREATE TABLE IF NOT EXISTS balance_periodos (
  periodo varchar(7) PRIMARY KEY,
  estado varchar(20) NOT NULL DEFAULT 'borrador',
  origen varchar(20) NOT NULL DEFAULT 'excel',
  archivo_nombre varchar(255),
  cargado_por varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- El saldo de cada cuenta en cada mes. `saldo` se guarda calculado y no se
-- deriva al leer: si el archivo del cliente trae un saldo que no cuadra con
-- debe - haber, gana el que él mandó y la diferencia se ve.
CREATE TABLE IF NOT EXISTS balance_saldos (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo varchar(7) NOT NULL,
  cuenta_codigo varchar(20) NOT NULL,
  debe numeric(18,2) NOT NULL DEFAULT 0,
  haber numeric(18,2) NOT NULL DEFAULT 0,
  saldo numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_saldos_periodo_cuenta" ON balance_saldos (periodo, cuenta_codigo);
CREATE INDEX IF NOT EXISTS "IDX_balance_saldos_periodo" ON balance_saldos (periodo);

-- Meta mensual por cuenta. Hoy sólo se llena la línea de ingresos: el
-- presupuesto que existe es de ventas por vendedor, sin gastos y sin cuentas
-- contables. La tabla igual es por cuenta para que uno de gastos entre después
-- sin rehacer el modelo.
CREATE TABLE IF NOT EXISTS balance_presupuesto (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo varchar(7) NOT NULL,
  cuenta_codigo varchar(20) NOT NULL,
  monto numeric(18,2) NOT NULL DEFAULT 0,
  actualizado_por varchar,
  updated_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_presupuesto_periodo_cuenta" ON balance_presupuesto (periodo, cuenta_codigo);

-- El puente entre la contabilidad y Talana.
--
-- No se puede cruzar cuenta a cuenta: el costo empresa de Talana viene todo
-- junto por persona, mientras que la contabilidad separa remuneración de
-- indemnización y de leyes sociales. Lo que sí calza es el ÁREA. Un `concepto`
-- agrupa N cuentas contables de un lado y N centros de costo de Talana del otro;
-- una sola tabla con `tipo` porque los dos lados son la misma pregunta.
CREATE TABLE IF NOT EXISTS balance_puente_personal (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto varchar(60) NOT NULL,
  tipo varchar(20) NOT NULL,
  valor varchar(255) NOT NULL,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_puente_tipo_valor" ON balance_puente_personal (tipo, valor);
CREATE INDEX IF NOT EXISTS "IDX_balance_puente_concepto" ON balance_puente_personal (concepto);
