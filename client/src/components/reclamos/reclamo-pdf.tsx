import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// PDF de un reclamo, para la opción "Descargar" del listado de Reclamos. Se carga
// con import() desde la página para no sumar @react-pdf al módulo de entrada.

export interface ReclamoPdfDatos {
  id: string;
  clientName?: string | null;
  clientRut?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  productName?: string | null;
  productSku?: string | null;
  lote?: string | null;
  motivo?: string | null;
  description?: string | null;
  gravedad?: string | null;
  estado?: string | null;
  vendedorName?: string | null;
  tecnicoName?: string | null;
  informeTecnico?: string | null;
  informeLaboratorio?: string | null;
  resolucionDescripcion?: string | null;
  resolucionUsuarioName?: string | null;
  fechaRegistro?: string | Date | null;
  fechaCierre?: string | Date | null;
  historial?: Array<{ estadoNuevo: string; userName: string; notas: string | null; createdAt: string }>;
}

const NARANJO = "#fd6301";

const estilos = StyleSheet.create({
  pagina: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  encabezado: { borderBottomWidth: 2, borderBottomColor: NARANJO, paddingBottom: 10, marginBottom: 16 },
  marca: { fontSize: 9, color: NARANJO, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  titulo: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 4 },
  subtitulo: { fontSize: 9, color: "#64748b", marginTop: 2 },
  seccion: { marginBottom: 14 },
  seccionTitulo: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NARANJO, marginBottom: 6 },
  fila: { flexDirection: "row", marginBottom: 3 },
  etiqueta: { width: 120, color: "#64748b" },
  valor: { flex: 1 },
  parrafo: { lineHeight: 1.4 },
  pie: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

const fecha = (v?: string | Date | null, patron = "dd MMM yyyy · HH:mm") =>
  v ? format(new Date(v), patron, { locale: es }) : "—";

function Fila({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <View style={estilos.fila}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

function ReclamoPdf({ r, etiquetas }: { r: ReclamoPdfDatos; etiquetas: Etiquetas }) {
  const informe = r.resolucionDescripcion || r.informeLaboratorio;
  return (
    <Document title={`Reclamo ${r.clientName ?? ""}`}>
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <Text style={estilos.marca}>PINTURAS PANORÁMICA</Text>
          <Text style={estilos.titulo}>Reclamo de Cliente</Text>
          <Text style={estilos.subtitulo}>
            Registrado el {fecha(r.fechaRegistro)} · Estado: {etiquetas.estado(r.estado)} · Gravedad: {etiquetas.gravedad(r.gravedad)}
          </Text>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Cliente</Text>
          <Fila etiqueta="Nombre" valor={r.clientName} />
          <Fila etiqueta="RUT" valor={r.clientRut} />
          <Fila etiqueta="Correo" valor={r.clientEmail} />
          <Fila etiqueta="Teléfono" valor={r.clientPhone} />
          <Fila etiqueta="Dirección" valor={r.clientAddress} />
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Producto</Text>
          <Fila etiqueta="Producto" valor={r.productName} />
          <Fila etiqueta="SKU" valor={r.productSku} />
          <Fila etiqueta="Lote" valor={r.lote} />
          <Fila etiqueta="Motivo" valor={etiquetas.motivo(r.motivo)} />
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Descripción</Text>
          <Text style={estilos.parrafo}>{r.description || "—"}</Text>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Responsables</Text>
          <Fila etiqueta="Creado por" valor={r.vendedorName} />
          <Fila etiqueta="Técnico" valor={r.tecnicoName} />
        </View>

        {r.informeTecnico ? (
          <View style={estilos.seccion}>
            <Text style={estilos.seccionTitulo}>Informe técnico</Text>
            <Text style={estilos.parrafo}>{r.informeTecnico}</Text>
          </View>
        ) : null}

        {informe ? (
          <View style={estilos.seccion}>
            <Text style={estilos.seccionTitulo}>Resolución</Text>
            {r.resolucionUsuarioName ? <Fila etiqueta="Resuelto por" valor={r.resolucionUsuarioName} /> : null}
            {r.fechaCierre ? <Fila etiqueta="Cierre" valor={fecha(r.fechaCierre)} /> : null}
            <Text style={estilos.parrafo}>{informe}</Text>
          </View>
        ) : null}

        {r.historial && r.historial.length > 0 ? (
          <View style={estilos.seccion}>
            <Text style={estilos.seccionTitulo}>Historial</Text>
            {r.historial.map((h, i) => (
              <Text key={i} style={[estilos.parrafo, { marginBottom: 2 }]}>
                {fecha(h.createdAt, "dd MMM yyyy")} — {etiquetas.estado(h.estadoNuevo)} ({h.userName}){h.notas ? `: ${h.notas}` : ""}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={estilos.pie} fixed>
          Documento generado el {fecha(new Date())} desde la intranet de Pinturas Panorámica
        </Text>
      </Page>
    </Document>
  );
}

export interface Etiquetas {
  estado: (v?: string | null) => string;
  gravedad: (v?: string | null) => string;
  motivo: (v?: string | null) => string | null;
}

/** Arma el PDF del reclamo y lo descarga en el navegador. */
export async function descargarReclamoPdf(r: ReclamoPdfDatos, etiquetas: Etiquetas) {
  const blob = await pdf(<ReclamoPdf r={r} etiquetas={etiquetas} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const nombre = (r.clientName || "cliente").replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]+/g, "-").replace(/^-|-$/g, "");
  a.download = `reclamo-${nombre}-${fecha(r.fechaRegistro, "yyyy-MM-dd")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
