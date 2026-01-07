import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { 
  Plus, 
  FileText, 
  BarChart3, 
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  X,
  PackagePlus,
  Camera,
  Building2,
  Edit,
  Trash2,
  Loader2,
  Bell,
  CheckCircle,
  Users,
  Package,
  TrendingUp,
  PenLine,
  Download
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import type { Obra, InsertObra } from "@shared/schema";

// Estilos para el PDF de visita técnica
const pdfStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f3f4f6',
    padding: 6,
    marginBottom: 8,
    color: '#374151',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 120,
    fontWeight: 'bold',
    color: '#4b5563',
  },
  value: {
    flex: 1,
    color: '#111827',
  },
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 15,
  },
  signatureBox: {
    width: '45%',
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#374151',
  },
  signatureName: {
    fontSize: 10,
    marginBottom: 5,
    color: '#111827',
  },
  signatureImage: {
    width: 150,
    height: 60,
    border: '1px solid #d1d5db',
  },
  signatureLine: {
    width: 150,
    height: 1,
    backgroundColor: '#9ca3af',
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  productRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
  },
  productName: {
    flex: 2,
  },
  productDetail: {
    flex: 1,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeWarning: {
    backgroundColor: '#fef9c3',
    color: '#854d0e',
  },
});

interface VisitaResumen {
  id: string;
  nombreObra: string;
  fechaVisita: string;
  tecnico: string;
  cliente: string;
  estado: 'borrador' | 'completada';
  productosEvaluados: number;
  reclamosTotal: number;
}

interface EstadisticasVisitas {
  totalVisitas: number;
  visitasCompletadas: number;
  visitasBorrador: number;
  aplicacionesCorrectas: number;
  aplicacionesDeficientes: number;
  reclamosPendientes: number;
  promedioProgreso: number;
}

interface EstadisticasMensuales {
  visitasPorMes: Array<{ mes: string; completadas: number; pendientes: number; total: number }>;
  obrasActivas: number;
  totalTecnicos: number;
  productosEvaluadosTotal: number;
  reclamosResueltosUltimoMes: number;
  visitasUltimos30Dias: number;
}

interface Client {
  id: string;
  nokoen: string;
  koen: string;
}

interface Product {
  id: string;
  kopr: string;
  name: string;
  ud02pr: string;
}

interface SelectedProduct {
  productId: string;
  sku: string;
  name: string;
  formato: string;
}

interface ObraWithClient extends Obra {
  clienteNombre?: string;
}

interface NotificacionesReclamos {
  nuevosReclamos: number;
  nuevasResoluciones: number;
  reclamosMasRecientes: { id: string; numeroReclamo: string; clientName: string; createdAt: string }[];
  resolucionesMasRecientes: { id: string; numeroReclamo: string; clientName: string; resolvedAt: string }[];
}

interface ProductoEvaluacion {
  aplicacion?: string;
  tipoSuperficie?: string;
  ambiente?: string;
  condicionesClimaticas?: string;
  dilucion?: string;
  observacionesTecnicas?: string;
  preparacionSuperficie?: string;
  rendimiento?: string;
  adherencia?: string;
  anomalias?: string;
  accionesRecomendadas?: string;
  imagenesUrls?: string[];
}

interface ProductoEvaluado {
  id: string;
  productId?: string;
  sku?: string;
  name?: string;
  productoManual?: string;
  formato?: string;
  color?: string;
  lote?: string;
  porcentajeAvance?: string;
  evaluacion?: ProductoEvaluacion;
}

interface VisitaDetalle {
  id: string;
  nombreObra: string;
  direccionObra: string;
  tecnicoId: string;
  tecnico?: string;
  clienteId?: string;
  cliente?: string;
  clienteManual?: string;
  recepcionistaNombre?: string;
  recepcionistaCargo?: string;
  estado: string;
  aplicacionGeneral?: string;
  tipoSuperficie?: string;
  ambiente?: string;
  condicionesClimaticas?: string;
  dilucion?: string;
  observacionesGenerales?: string;
  comentarios?: string;
  firmaTecnicoNombre?: string;
  firmaTecnicoData?: string;
  firmaRecepcionistaData?: string;
  fechaFirma?: string;
  createdAt?: string;
  productos?: ProductoEvaluado[];
}

// Componente PDF para la visita técnica - Incluye TODA la información
const VisitaPDFDocument = ({ visita }: { visita: VisitaDetalle }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      {/* Header */}
      <View style={pdfStyles.header}>
        <View>
          <Text style={pdfStyles.title}>Informe de Visita Técnica</Text>
          <Text style={pdfStyles.subtitle}>Pinturas Panorámica</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={pdfStyles.subtitle}>
            Fecha: {visita.createdAt ? new Date(visita.createdAt).toLocaleDateString('es-CL') : '-'}
          </Text>
          <Text style={[pdfStyles.badge, visita.estado === 'completada' ? pdfStyles.badgeSuccess : pdfStyles.badgeWarning]}>
            {visita.estado === 'completada' ? 'Completada' : 'Borrador'}
          </Text>
        </View>
      </View>

      {/* Información General */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Información General</Text>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Nombre Obra:</Text>
          <Text style={pdfStyles.value}>{visita.nombreObra || '-'}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Dirección:</Text>
          <Text style={pdfStyles.value}>{visita.direccionObra || '-'}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Cliente:</Text>
          <Text style={pdfStyles.value}>{visita.cliente || visita.clienteManual || '-'}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Técnico:</Text>
          <Text style={pdfStyles.value}>{visita.tecnico || '-'}</Text>
        </View>
        {visita.recepcionistaNombre && (
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Recepcionista:</Text>
            <Text style={pdfStyles.value}>{visita.recepcionistaNombre} {visita.recepcionistaCargo ? `(${visita.recepcionistaCargo})` : ''}</Text>
          </View>
        )}
      </View>

      {/* Evaluación General */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Evaluación General</Text>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Aplicación:</Text>
          <Text style={pdfStyles.value}>{visita.aplicacionGeneral === 'correcta' ? 'Correcta' : visita.aplicacionGeneral === 'deficiente' ? 'Deficiente' : '-'}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Tipo Superficie:</Text>
          <Text style={pdfStyles.value}>{visita.tipoSuperficie || '-'}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Ambiente:</Text>
          <Text style={pdfStyles.value}>{visita.ambiente === 'interior' ? 'Interior' : visita.ambiente === 'exterior' ? 'Exterior' : '-'}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Condiciones Climáticas:</Text>
          <Text style={pdfStyles.value}>{visita.condicionesClimaticas || '-'}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Dilución:</Text>
          <Text style={pdfStyles.value}>{visita.dilucion || '-'}</Text>
        </View>
      </View>

      {/* Productos Evaluados */}
      {visita.productos && visita.productos.length > 0 && (
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Productos Evaluados ({visita.productos.length})</Text>
          {visita.productos.map((producto, index) => (
            <View key={producto.id} style={{ marginBottom: 12, paddingBottom: 10, borderBottomWidth: index < (visita.productos?.length || 0) - 1 ? 1 : 0, borderBottomColor: '#e5e7eb' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4, color: '#1e40af' }}>
                {index + 1}. {producto.name || producto.productoManual || 'Producto sin nombre'}
              </Text>
              <View style={{ marginLeft: 10 }}>
                <View style={pdfStyles.row}>
                  <Text style={pdfStyles.label}>SKU:</Text>
                  <Text style={pdfStyles.value}>{producto.sku || '-'}</Text>
                </View>
                <View style={pdfStyles.row}>
                  <Text style={pdfStyles.label}>Formato:</Text>
                  <Text style={pdfStyles.value}>{producto.formato || '-'}</Text>
                </View>
                {producto.lote && (
                  <View style={pdfStyles.row}>
                    <Text style={pdfStyles.label}>Lote:</Text>
                    <Text style={pdfStyles.value}>{producto.lote}</Text>
                  </View>
                )}
                {producto.color && (
                  <View style={pdfStyles.row}>
                    <Text style={pdfStyles.label}>Color:</Text>
                    <Text style={pdfStyles.value}>{producto.color}</Text>
                  </View>
                )}
                
                {/* Evaluación del producto */}
                {producto.evaluacion && (
                  <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 9, color: '#4b5563', marginBottom: 4 }}>Evaluación Técnica:</Text>
                    {producto.evaluacion.aplicacion && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Aplicación:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.aplicacion === 'correcta' ? 'Correcta' : 'Deficiente'}</Text>
                      </View>
                    )}
                    {producto.evaluacion.adherencia && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Adherencia:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.adherencia}</Text>
                      </View>
                    )}
                    {producto.evaluacion.tipoSuperficie && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Superficie:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.tipoSuperficie}</Text>
                      </View>
                    )}
                    {producto.evaluacion.preparacionSuperficie && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Preparación:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.preparacionSuperficie}</Text>
                      </View>
                    )}
                    {producto.evaluacion.rendimiento && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Rendimiento:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.rendimiento}</Text>
                      </View>
                    )}
                    {producto.evaluacion.dilucion && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Dilución:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.dilucion}</Text>
                      </View>
                    )}
                    {producto.evaluacion.anomalias && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Anomalías:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.anomalias}</Text>
                      </View>
                    )}
                    {producto.evaluacion.accionesRecomendadas && (
                      <View style={pdfStyles.row}>
                        <Text style={pdfStyles.label}>Acciones:</Text>
                        <Text style={pdfStyles.value}>{producto.evaluacion.accionesRecomendadas}</Text>
                      </View>
                    )}
                    {producto.evaluacion.observacionesTecnicas && (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 9, color: '#4b5563' }}>Observaciones:</Text>
                        <Text style={{ fontSize: 9, marginTop: 2 }}>{producto.evaluacion.observacionesTecnicas}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Observaciones Generales */}
      {(visita.observacionesGenerales || visita.comentarios) && (
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Observaciones Generales</Text>
          {visita.observacionesGenerales && (
            <Text style={{ marginBottom: 8, fontSize: 10 }}>{visita.observacionesGenerales}</Text>
          )}
          {visita.comentarios && (
            <Text style={{ fontSize: 10 }}>{visita.comentarios}</Text>
          )}
        </View>
      )}

      {/* Firmas */}
      {(visita.firmaTecnicoData || visita.firmaRecepcionistaData) && (
        <View style={pdfStyles.signatureContainer}>
          <View style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureLabel}>Técnico</Text>
            {visita.firmaTecnicoNombre && (
              <Text style={pdfStyles.signatureName}>{visita.firmaTecnicoNombre}</Text>
            )}
            {visita.firmaTecnicoData && (
              <Image src={visita.firmaTecnicoData} style={pdfStyles.signatureImage} />
            )}
            {!visita.firmaTecnicoData && <View style={pdfStyles.signatureLine} />}
          </View>
          <View style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureLabel}>Recepcionista</Text>
            {visita.recepcionistaNombre && (
              <Text style={pdfStyles.signatureName}>{visita.recepcionistaNombre}</Text>
            )}
            {visita.firmaRecepcionistaData && (
              <Image src={visita.firmaRecepcionistaData} style={pdfStyles.signatureImage} />
            )}
            {!visita.firmaRecepcionistaData && <View style={pdfStyles.signatureLine} />}
          </View>
        </View>
      )}

      {/* Fecha de firma */}
      {visita.fechaFirma && (
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: '#6b7280' }}>
            Firmado el: {new Date(visita.fechaFirma).toLocaleString('es-CL')}
          </Text>
        </View>
      )}

      {/* Footer */}
      <Text style={pdfStyles.footer}>
        Documento generado automáticamente - Pinturas Panorámica © {new Date().getFullYear()}
      </Text>
    </Page>

    {/* Página adicional para imágenes si hay alguna */}
    {visita.productos && visita.productos.some(p => p.evaluacion?.imagenesUrls && p.evaluacion.imagenesUrls.length > 0) && (
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.title}>Evidencias Fotográficas</Text>
            <Text style={pdfStyles.subtitle}>Visita: {visita.nombreObra}</Text>
          </View>
        </View>

        {visita.productos.filter(p => p.evaluacion?.imagenesUrls && p.evaluacion.imagenesUrls.length > 0).map((producto) => (
          <View key={`img-${producto.id}`} style={pdfStyles.section}>
            <Text style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 8, color: '#1e40af' }}>
              {producto.name || producto.productoManual || 'Producto'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {producto.evaluacion?.imagenesUrls?.map((url, imgIndex) => (
                <Image 
                  key={imgIndex} 
                  src={url} 
                  style={{ width: 150, height: 150, objectFit: 'cover', marginBottom: 8 }} 
                />
              ))}
            </View>
          </View>
        ))}

        <Text style={pdfStyles.footer}>
          Documento generado automáticamente - Pinturas Panorámica © {new Date().getFullYear()}
        </Text>
      </Page>
    )}
  </Document>
);

export default function VisitasTecnicasPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Verificar permisos de acceso
  if (!user || (user.role !== 'admin' && user.role !== 'tecnico_obra' && user.role !== 'supervisor' && user.role !== 'laboratorio' && user.role !== 'jefe_planta')) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-center text-muted-foreground">
            No tiene permisos para acceder a esta página.
          </p>
        </div>
      </div>
    );
  }
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filtroMes, setFiltroMes] = useState<string>("all");
  const [showNewVisitModal, setShowNewVisitModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  
  const canEditVisit = user?.role === 'admin' || user?.role === 'tecnico_obra';
  
  // Estados para modal de firma
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureVisitId, setSignatureVisitId] = useState<string | null>(null);
  const [firmaTecnicoNombre, setFirmaTecnicoNombre] = useState("");
  const [firmaTecnicoData, setFirmaTecnicoData] = useState<string | null>(null);
  const [firmaRecepcionistaNombre, setFirmaRecepcionistaNombre] = useState("");
  const [firmaRecepcionistaData, setFirmaRecepcionistaData] = useState<string | null>(null);
  
  // Estados para el flujo de creación de visita
  const [visitStep, setVisitStep] = useState<'basic' | 'products' | 'evaluation' | 'observations'>('basic');
  const [visitData, setVisitData] = useState({
    clienteId: '',
    clienteName: '',
    obraId: '',
    nombreObra: '',
    direccionObra: '',
    recepcionistaNombre: '',
    recepcionistaCargo: '',
    observacionesGenerales: '',
  });
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [customProductName, setCustomProductName] = useState("");
  const [customProductSku, setCustomProductSku] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const [productEvaluations, setProductEvaluations] = useState<Record<string, any>>({});
  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  // Estados para gestión de obras
  const [searchObras, setSearchObras] = useState("");
  const [selectedClienteIdObras, setSelectedClienteIdObras] = useState<string>("all");
  const [selectedEstadoObras, setSelectedEstadoObras] = useState<string>("all");
  const [showNewObraDialog, setShowNewObraDialog] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [showDeleteObraDialog, setShowDeleteObraDialog] = useState(false);
  const [obraToDelete, setObraToDelete] = useState<Obra | null>(null);
  const [clientSearchObras, setClientSearchObras] = useState("");
  const [showClientDropdownObras, setShowClientDropdownObras] = useState(false);
  const [selectedClientNameObras, setSelectedClientNameObras] = useState("");
  const clientDropdownObrasRef = useRef<HTMLDivElement>(null);
  const [formDataObra, setFormDataObra] = useState<Partial<InsertObra>>({
    clienteId: "",
    nombre: "",
    direccion: "",
    descripcion: "",
    estado: "activa",
    fechaInicio: undefined,
    fechaEstimadaFin: undefined,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };

    if (showClientDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClientDropdown]);

  // Close client dropdown for obras when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownObrasRef.current && !clientDropdownObrasRef.current.contains(event.target as Node)) {
        setShowClientDropdownObras(false);
      }
    };

    if (showClientDropdownObras) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClientDropdownObras]);

  const handleNewVisit = () => {
    setEditingVisitId(null);
    setShowNewVisitModal(true);
    setVisitStep('basic');
    setVisitData({
      clienteId: '',
      clienteName: '',
      obraId: '',
      nombreObra: '',
      direccionObra: '',
      recepcionistaNombre: '',
      recepcionistaCargo: '',
      observacionesGenerales: '',
    });
    setSelectedProducts([]);
    setProductSearchTerm("");
    setClientSearchTerm("");
    setShowClientDropdown(false);
    setProductEvaluations({});
  };

  const handleEditVisit = async (visitaId: string) => {
    try {
      const response = await apiRequest(`/api/visitas-tecnicas/${visitaId}`);
      const visita = await response.json();
      
      setEditingVisitId(visitaId);
      setVisitData({
        clienteId: visita.clienteId || '',
        clienteName: visita.cliente || '',
        obraId: visita.obraId || '',
        nombreObra: visita.nombreObra || '',
        direccionObra: visita.direccionObra || '',
        recepcionistaNombre: visita.recepcionistaNombre || '',
        recepcionistaCargo: visita.recepcionistaCargo || '',
        observacionesGenerales: visita.observacionesGenerales || '',
      });
      setClientSearchTerm(visita.cliente || '');
      
      if (visita.productos && visita.productos.length > 0) {
        setSelectedProducts(visita.productos.map((p: any) => ({
          productId: p.productId || p.id,
          sku: p.sku || p.kopr || '',
          name: p.name || p.nombreProducto || '',
          formato: p.formato || 'N/A'
        })));
        
        const evaluations: Record<string, any> = {};
        visita.productos.forEach((p: any) => {
          const eval_data = p.evaluacion || p;
          evaluations[p.productId || p.id] = {
            estadoAplicacion: eval_data.estadoAplicacion || eval_data.aplicacion || 'bueno',
            adherencia: eval_data.adherencia || 'bueno',
            acabado: eval_data.acabado || 'bueno',
            cobertura: eval_data.cobertura || 'bueno',
            observaciones: eval_data.observaciones || eval_data.observacionesTecnicas || '',
            tieneReclamo: eval_data.tieneReclamo || false,
            reclamoDescripcion: eval_data.reclamoDescripcion || '',
            tipoSuperficie: eval_data.tipoSuperficie || '',
            ambiente: eval_data.ambiente || '',
            condicionesClimaticas: eval_data.condicionesClimaticas || eval_data.clima || '',
            dilucion: eval_data.dilucion || '',
            preparacionSuperficie: eval_data.preparacionSuperficie || '',
            rendimiento: eval_data.rendimiento || '',
            anomalias: eval_data.anomalias || eval_data.evidenciaDeficiencia || '',
            accionesRecomendadas: eval_data.accionesRecomendadas || '',
            imagenes: eval_data.imagenesUrls || eval_data.imagenes || [],
            aplicacion: eval_data.aplicacion || '',
            clima: eval_data.condicionesClimaticas || eval_data.clima || '',
            evidenciaDeficiencia: eval_data.anomalias || eval_data.evidenciaDeficiencia || '',
          };
        });
        setProductEvaluations(evaluations);
      }
      
      setVisitStep('basic');
      setShowNewVisitModal(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar la visita para editar",
        variant: "destructive",
      });
    }
  };
  
  const handleCloseModal = () => {
    setShowNewVisitModal(false);
    setVisitStep('basic');
    setClientSearchTerm("");
    setShowClientDropdown(false);
    setEditingVisitId(null);
  };
  
  // Helper para actualizar los datos de evaluación de un producto
  const updateProductEvaluation = (productId: string, field: string, value: any) => {
    setProductEvaluations(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value
      }
    }));
  };

  // Query para buscar clientes (AJAX search)
  const { data: clientSearchResults = [], isLoading: searchingClients } = useQuery<Client[]>({
    queryKey: ['/api/clients/search', clientSearchTerm],
    queryFn: async () => {
      if (!clientSearchTerm || clientSearchTerm.length < 3) {
        return [];
      }
      const response = await apiRequest(`/api/clients/search?q=${encodeURIComponent(clientSearchTerm)}`);
      return response.json();
    },
    enabled: showNewVisitModal && clientSearchTerm.length >= 3,
  });

  // Query para obtener obras del cliente seleccionado
  const { data: clientObras = [] } = useQuery<Obra[]>({
    queryKey: ['/api/obras', visitData.clienteId],
    queryFn: async () => {
      if (!visitData.clienteId) return [];
      const response = await apiRequest(`/api/obras?clienteId=${visitData.clienteId}`);
      return response.json();
    },
    enabled: showNewVisitModal && !!visitData.clienteId,
  });

  // Query para obtener la lista de productos
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products/list'],
    enabled: showNewVisitModal && visitStep === 'products',
  });

  const filteredProducts = products.filter(p => 
    productSearchTerm === '' ||
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    p.kopr.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const handleProductToggle = (product: Product, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        sku: product.kopr,
        name: product.name,
        formato: product.ud02pr || 'N/A'
      }]);
    } else {
      setSelectedProducts(prev => prev.filter(p => 
        p.productId !== product.id && p.sku !== product.kopr
      ));
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleAddCustomProduct = () => {
    if (!customProductName.trim()) return;
    
    const customProduct: SelectedProduct = {
      productId: `custom-${Date.now()}`,
      sku: customProductSku.trim() || 'PERSONALIZADO',
      name: customProductName.trim(),
      formato: 'N/A'
    };
    
    setSelectedProducts(prev => [...prev, customProduct]);
    setCustomProductName('');
    setCustomProductSku('');
  };

  const createVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingVisitId) {
        return await apiRequest(`/api/visitas-tecnicas/${editingVisitId}`, {
          method: 'PUT',
          data: data,
        });
      }
      return await apiRequest('/api/visitas-tecnicas', {
        method: 'POST',
        data: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/visitas-tecnicas/listado'] });
      queryClient.invalidateQueries({ queryKey: ['/api/visitas-tecnicas/estadisticas'] });
      toast({
        title: editingVisitId ? "Visita actualizada" : "Visita creada",
        description: editingVisitId ? "La visita técnica ha sido actualizada correctamente" : "La visita técnica ha sido creada correctamente",
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la visita",
        variant: "destructive",
      });
    },
  });

  // Mutation para guardar firmas
  const saveSignaturesMutation = useMutation({
    mutationFn: async (data: { 
      visitaId: string; 
      firmaTecnicoNombre: string;
      firmaTecnicoData: string | null;
      firmaRecepcionistaNombre: string;
      firmaRecepcionistaData: string | null;
    }) => {
      return await apiRequest(`/api/visitas-tecnicas/${data.visitaId}/firmas`, {
        method: 'POST',
        data: {
          firmaTecnicoNombre: data.firmaTecnicoNombre,
          firmaTecnicoData: data.firmaTecnicoData,
          firmaRecepcionistaNombre: data.firmaRecepcionistaNombre,
          firmaRecepcionistaData: data.firmaRecepcionistaData,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/visitas-tecnicas/listado'] });
      toast({
        title: "Firmas guardadas",
        description: "La visita ha sido firmada correctamente",
      });
      handleCloseSignatureModal();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar las firmas",
        variant: "destructive",
      });
    },
  });

  const handleOpenSignatureModal = (visitaId: string) => {
    setSignatureVisitId(visitaId);
    setFirmaTecnicoNombre("");
    setFirmaTecnicoData(null);
    setFirmaRecepcionistaNombre("");
    setFirmaRecepcionistaData(null);
    setShowSignatureModal(true);
  };

  const handleCloseSignatureModal = () => {
    setShowSignatureModal(false);
    setSignatureVisitId(null);
    setFirmaTecnicoNombre("");
    setFirmaTecnicoData(null);
    setFirmaRecepcionistaNombre("");
    setFirmaRecepcionistaData(null);
  };

  const handleSaveSignatures = () => {
    if (!signatureVisitId) return;
    
    if (!firmaTecnicoNombre.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar el nombre del técnico",
        variant: "destructive",
      });
      return;
    }
    
    if (!firmaRecepcionistaNombre.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar el nombre del recepcionista",
        variant: "destructive",
      });
      return;
    }
    
    if (!firmaTecnicoData) {
      toast({
        title: "Error",
        description: "Debe agregar la firma del técnico",
        variant: "destructive",
      });
      return;
    }
    
    if (!firmaRecepcionistaData) {
      toast({
        title: "Error",
        description: "Debe agregar la firma del recepcionista",
        variant: "destructive",
      });
      return;
    }

    saveSignaturesMutation.mutate({
      visitaId: signatureVisitId,
      firmaTecnicoNombre,
      firmaTecnicoData,
      firmaRecepcionistaNombre,
      firmaRecepcionistaData,
    });
  };

  // Función para descargar PDF de visita
  const handleDownloadPDF = async (visitaId: string) => {
    try {
      toast({
        title: "Generando PDF",
        description: "Por favor espere...",
      });

      // Obtener detalles de la visita
      const response = await apiRequest(`/api/visitas-tecnicas/${visitaId}`);
      const visita = await response.json();
      
      // Generar PDF
      const pdfBlob = await pdf(<VisitaPDFDocument visita={visita} />).toBlob();
      const url = URL.createObjectURL(pdfBlob);
      
      // Descargar
      const a = document.createElement('a');
      a.href = url;
      a.download = `Visita_Tecnica_${visita.nombreObra.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF descargado",
        description: "El informe se ha descargado correctamente",
      });
    } catch (error: any) {
      console.error('Error al generar PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  // Query para estadísticas del dashboard
  const { data: estadisticas, isLoading: loadingStats } = useQuery<EstadisticasVisitas>({
    queryKey: ['/api/visitas-tecnicas/estadisticas', filtroMes],
    queryFn: async () => {
      const response = await apiRequest(`/api/visitas-tecnicas/estadisticas/${filtroMes}`);
      return response.json();
    },
    enabled: activeTab === 'dashboard',
  });

  // Query para estadísticas mensuales (gráfico de barras)
  const { data: estadisticasMensuales, isLoading: loadingMensual } = useQuery<EstadisticasMensuales>({
    queryKey: ['/api/visitas-tecnicas/estadisticas-mensuales'],
    queryFn: async () => {
      const response = await apiRequest('/api/visitas-tecnicas/estadisticas-mensuales');
      return response.json();
    },
    enabled: activeTab === 'dashboard',
  });

  // Query para notificaciones de reclamos (últimas 24 horas)
  const { data: notificaciones } = useQuery<NotificacionesReclamos>({
    queryKey: ['/api/reclamos-generales/notificaciones'],
    queryFn: async () => {
      const response = await apiRequest('/api/reclamos-generales/notificaciones');
      return response.json();
    },
    refetchInterval: 60000,
  });

  // Query para listado de visitas
  const { data: visitas, isLoading: loadingVisitas } = useQuery<VisitaResumen[]>({
    queryKey: ['/api/visitas-tecnicas/listado', searchTerm, filterEstado],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterEstado && filterEstado !== 'all') params.append('estado', filterEstado);
      
      const queryString = params.toString();
      const url = `/api/visitas-tecnicas/listado${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiRequest(url);
      return response.json();
    },
    enabled: activeTab === 'listado',
  });

  // Query para obtener detalles completos de una visita
  const { data: visitaDetalle, isLoading: loadingDetalle } = useQuery<any>({
    queryKey: ['/api/visitas-tecnicas', selectedVisitId],
    queryFn: async () => {
      if (!selectedVisitId) return null;
      const response = await apiRequest(`/api/visitas-tecnicas/${selectedVisitId}`);
      return response.json();
    },
    enabled: !!selectedVisitId && showDetailModal,
  });

  // Queries y mutations para obras
  const { data: obrasData = [], isLoading: loadingObras } = useQuery<ObraWithClient[]>({
    queryKey: ['/api/obras', selectedClienteIdObras],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClienteIdObras && selectedClienteIdObras !== 'all') {
        params.append('clienteId', selectedClienteIdObras);
      }
      const queryString = params.toString();
      const url = `/api/obras${queryString ? `?${queryString}` : ''}`;
      const response = await apiRequest(url);
      const obrasData = await response.json();
      
      const clientsResponse = await apiRequest('/api/clients/simple');
      const clients = await clientsResponse.json();
      
      return obrasData.map((obra: Obra) => {
        const client = clients.find((c: Client) => c.id === obra.clienteId);
        return {
          ...obra,
          clienteNombre: client?.nokoen || 'Cliente no encontrado'
        };
      });
    },
    enabled: activeTab === 'obras',
  });

  const { data: clientsForObras = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients/search', clientSearchObras],
    queryFn: async () => {
      if (!clientSearchObras || clientSearchObras.length < 3) {
        return [];
      }
      const response = await apiRequest(`/api/clients/search?q=${encodeURIComponent(clientSearchObras)}`);
      return response.json();
    },
    enabled: activeTab === 'obras' && clientSearchObras.length >= 3,
  });

  const createObraMutation = useMutation({
    mutationFn: async (data: InsertObra) => {
      const response = await apiRequest('/api/obras', {
        method: 'POST',
        data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/obras'] });
      handleCloseObraDialog();
      toast({
        title: "Obra creada",
        description: "La obra se ha creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la obra",
        variant: "destructive"
      });
    }
  });

  const updateObraMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertObra> }) => {
      const response = await apiRequest(`/api/obras/${id}`, {
        method: 'PUT',
        data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/obras'] });
      handleCloseObraDialog();
      toast({
        title: "Obra actualizada",
        description: "La obra se ha actualizado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la obra",
        variant: "destructive"
      });
    }
  });

  const deleteObraMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/obras/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/obras'] });
      setShowDeleteObraDialog(false);
      setObraToDelete(null);
      toast({
        title: "Obra eliminada",
        description: "La obra se ha eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la obra",
        variant: "destructive"
      });
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'completada':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completada</Badge>;
      case 'borrador':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Borrador</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  const estadoObraBadgeVariant = (estado: string) => {
    switch (estado) {
      case "activa":
        return "default";
      case "completada":
        return "secondary";
      case "cancelada":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Handlers para obras
  const handleOpenNewObraDialog = () => {
    setEditingObra(null);
    setFormDataObra({
      clienteId: "",
      nombre: "",
      direccion: "",
      descripcion: "",
      estado: "activa",
      fechaInicio: undefined,
      fechaEstimadaFin: undefined,
    });
    setShowNewObraDialog(true);
  };

  const handleOpenEditObraDialog = (obra: Obra) => {
    setEditingObra(obra);
    setFormDataObra({
      clienteId: obra.clienteId,
      nombre: obra.nombre,
      direccion: obra.direccion,
      descripcion: obra.descripcion || "",
      estado: obra.estado,
      fechaInicio: obra.fechaInicio || undefined,
      fechaEstimadaFin: obra.fechaEstimadaFin || undefined,
    });
    
    // Set the selected client name for display
    const selectedClient = clientsForObras.find(c => c.id === obra.clienteId);
    if (selectedClient) {
      setSelectedClientNameObras(selectedClient.nokoen);
    }
    
    setShowNewObraDialog(true);
  };

  const handleCloseObraDialog = () => {
    setShowNewObraDialog(false);
    setEditingObra(null);
    setClientSearchObras("");
    setShowClientDropdownObras(false);
    setSelectedClientNameObras("");
    setFormDataObra({
      clienteId: "",
      nombre: "",
      direccion: "",
      descripcion: "",
      estado: "activa",
      fechaInicio: undefined,
      fechaEstimadaFin: undefined,
    });
  };

  const handleSubmitObra = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formDataObra.clienteId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un cliente",
        variant: "destructive"
      });
      return;
    }
    
    if (!formDataObra.nombre) {
      toast({
        title: "Error",
        description: "El nombre de la obra es requerido",
        variant: "destructive"
      });
      return;
    }
    
    if (!formDataObra.direccion) {
      toast({
        title: "Error",
        description: "La dirección es requerida",
        variant: "destructive"
      });
      return;
    }

    const submitData: InsertObra = {
      clienteId: formDataObra.clienteId,
      nombre: formDataObra.nombre,
      direccion: formDataObra.direccion,
      descripcion: formDataObra.descripcion,
      estado: formDataObra.estado || "activa",
      fechaInicio: formDataObra.fechaInicio,
      fechaEstimadaFin: formDataObra.fechaEstimadaFin,
    };

    if (editingObra) {
      updateObraMutation.mutate({ id: editingObra.id, data: submitData });
    } else {
      createObraMutation.mutate(submitData);
    }
  };

  const handleDeleteObraClick = (obra: Obra) => {
    setObraToDelete(obra);
    setShowDeleteObraDialog(true);
  };

  const handleConfirmDeleteObra = () => {
    if (obraToDelete) {
      deleteObraMutation.mutate(obraToDelete.id);
    }
  };

  // Filter obras
  const filteredObras = obrasData.filter((obra) => {
    const matchesSearch = 
      searchObras === "" ||
      obra.nombre.toLowerCase().includes(searchObras.toLowerCase()) ||
      obra.direccion.toLowerCase().includes(searchObras.toLowerCase()) ||
      (obra.clienteNombre && obra.clienteNombre.toLowerCase().includes(searchObras.toLowerCase()));
    
    const matchesCliente = 
      selectedClienteIdObras === "all" || obra.clienteId === selectedClienteIdObras;
    
    const matchesEstado = 
      selectedEstadoObras === "all" || obra.estado === selectedEstadoObras;

    return matchesSearch && matchesCliente && matchesEstado;
  });

  const DashboardContent = () => (
    <div className="space-y-6">
      {/* Filtros del dashboard */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Visitas Técnicas</h2>
          <p className="text-muted-foreground">Estadísticas y resumen de inspecciones técnicas</p>
        </div>
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="w-48" data-testid="select-filter-month">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Histórico (Todo)</SelectItem>
            <SelectItem value="current">Mes actual</SelectItem>
            <SelectItem value="last">Mes anterior</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
            <SelectItem value="year">Año actual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Acciones Rápidas - Primero en móvil */}
      <Card className="lg:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Acciones Rápidas
          </CardTitle>
          <CardDescription>
            Gestionar visitas técnicas y reportes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="w-full justify-start" 
            onClick={handleNewVisit}
            data-testid="button-nueva-visita"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Visita Técnica
          </Button>
          <Button variant="outline" className="w-full justify-start" data-testid="button-exportar-reportes">
            <FileText className="w-4 h-4 mr-2" />
            Exportar Reportes
          </Button>
        </CardContent>
      </Card>

      {/* Cards de estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visitas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-visitas">
              {loadingStats ? "..." : estadisticas?.totalVisitas ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {loadingStats ? "..." : `${estadisticas?.visitasCompletadas ?? 0} completadas`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones Correctas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-aplicaciones-correctas">
              {loadingStats ? "..." : estadisticas?.aplicacionesCorrectas ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos aplicados correctamente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones Deficientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="stat-aplicaciones-deficientes">
              {loadingStats ? "..." : estadisticas?.aplicacionesDeficientes ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención técnica
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reclamos Pendientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-reclamos-pendientes">
              {loadingStats ? "..." : estadisticas?.reclamosPendientes ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren seguimiento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras y progreso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Visitas por Mes
            </CardTitle>
            <CardDescription>
              Visitas completadas vs pendientes (últimos 6 meses)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMensual ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : estadisticasMensuales?.visitasPorMes && estadisticasMensuales.visitasPorMes.length > 0 ? (
              <div className="h-64">
                <Bar
                  data={{
                    labels: estadisticasMensuales.visitasPorMes.map(m => m.mes),
                    datasets: [
                      {
                        label: 'Completadas',
                        data: estadisticasMensuales.visitasPorMes.map(m => m.completadas),
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        borderRadius: 4,
                      },
                      {
                        label: 'Pendientes',
                        data: estadisticasMensuales.visitasPorMes.map(m => m.pendientes),
                        backgroundColor: 'rgba(251, 191, 36, 0.8)',
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                    },
                    scales: {
                      x: {
                        stacked: false,
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                  data-testid="chart-visitas-mensuales"
                />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                Sin datos de visitas
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Progreso Promedio
            </CardTitle>
            <CardDescription>
              Porcentaje promedio de avance en obras visitadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-3xl font-bold mb-2" data-testid="stat-progreso-promedio">
                {loadingStats ? "..." : `${estadisticas?.promedioProgreso ?? 0}%`}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${estadisticas?.promedioProgreso ?? 0}%` }}
                ></div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Reclamos Resueltos (último mes)</span>
                <span className="font-semibold text-green-600" data-testid="stat-reclamos-resueltos">
                  {loadingMensual ? "..." : estadisticasMensuales?.reclamosResueltosUltimoMes ?? 0}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Button 
                className="w-full justify-start" 
                onClick={handleNewVisit}
                data-testid="button-nueva-visita-desktop"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Visita Técnica
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-exportar-reportes-desktop">
                <FileText className="w-4 h-4 mr-2" />
                Exportar Reportes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const ListadoContent = () => (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Listado de Visitas</h2>
          <p className="text-muted-foreground">Gestiona y revisa todas las visitas técnicas</p>
        </div>
        <Button onClick={handleNewVisit} data-testid="button-crear-visita">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Visita
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nombre de obra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-obra"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-48" data-testid="select-filter-estado">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="completada">Completadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de visitas */}
      <div className="space-y-4">
        {loadingVisitas ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : visitas && visitas.length > 0 ? (
          visitas.map((visita) => (
            <Card key={visita.id} className="hover:shadow-md transition-shadow" data-testid={`card-visita-${visita.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg" data-testid={`text-obra-${visita.id}`}>
                        {visita.nombreObra}
                      </h3>
                      {getEstadoBadge(visita.estado)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span data-testid={`text-fecha-${visita.id}`}>
                          {new Date(visita.fechaVisita).toLocaleDateString('es-CL', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span data-testid={`text-tecnico-${visita.id}`}>
                          {visita.tecnico}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span data-testid={`text-cliente-${visita.id}`}>
                          {visita.cliente}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-blue-600" data-testid={`text-productos-${visita.id}`}>
                        {visita.productosEvaluados} productos evaluados
                      </span>
                      {visita.reclamosTotal > 0 && (
                        <span className="text-red-600" data-testid={`text-reclamos-${visita.id}`}>
                          {visita.reclamosTotal} reclamos
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full sm:w-auto flex flex-col gap-2">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleOpenSignatureModal(visita.id)}
                      data-testid={`button-firmar-${visita.id}`}
                    >
                      <PenLine className="w-4 h-4 mr-2" />
                      Firmar
                    </Button>
                    {canEditVisit && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleEditVisit(visita.id)}
                        data-testid={`button-editar-${visita.id}`}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        setSelectedVisitId(visita.id);
                        setShowDetailModal(true);
                      }}
                      data-testid={`button-ver-${visita.id}`}
                    >
                      Ver Detalle
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleDownloadPDF(visita.id)}
                      data-testid={`button-pdf-${visita.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay visitas técnicas</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterEstado !== 'all' 
                  ? 'No se encontraron visitas que coincidan con los filtros aplicados.'
                  : 'Comienza creando tu primera visita técnica.'
                }
              </p>
              <Button onClick={handleNewVisit} data-testid="button-primera-visita">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Visita Técnica
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Visitas Técnicas</h1>
            <p className="text-muted-foreground">
              Sistema de inspecciones técnicas para evaluación de productos
            </p>
          </div>
        </div>

        {/* Banner sutil de notificaciones */}
        {notificaciones && (notificaciones.nuevosReclamos > 0 || notificaciones.nuevasResoluciones > 0) && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
            <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex flex-wrap items-center gap-3">
              {notificaciones.nuevosReclamos > 0 && (
                <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="font-medium">{notificaciones.nuevosReclamos}</span>
                  <span>nuevo{notificaciones.nuevosReclamos !== 1 ? 's' : ''} reclamo{notificaciones.nuevosReclamos !== 1 ? 's' : ''}</span>
                </span>
              )}
              {notificaciones.nuevosReclamos > 0 && notificaciones.nuevasResoluciones > 0 && (
                <span className="text-blue-400 dark:text-blue-600">|</span>
              )}
              {notificaciones.nuevasResoluciones > 0 && (
                <span className="flex items-center gap-1.5 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">{notificaciones.nuevasResoluciones}</span>
                  <span>resolu{notificaciones.nuevasResoluciones !== 1 ? 'ciones' : 'ción'}</span>
                </span>
              )}
              <span className="text-blue-500 dark:text-blue-400 text-xs">(últimas 24h)</span>
            </div>
          </div>
        )}

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="listado" data-testid="tab-listado">
              <FileText className="w-4 h-4 mr-2" />
              Visitas
            </TabsTrigger>
            <TabsTrigger value="obras" data-testid="tab-obras">
              <Building2 className="w-4 h-4 mr-2" />
              Obras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardContent />
          </TabsContent>

          <TabsContent value="listado" className="mt-6">
            <ListadoContent />
          </TabsContent>

          <TabsContent value="obras" className="mt-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Gestión de Obras</h2>
                  <p className="text-muted-foreground">
                    Administra proyectos y obras asignadas a clientes
                  </p>
                </div>
                <Button onClick={handleOpenNewObraDialog} data-testid="button-nueva-obra">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Obra
                </Button>
              </div>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="space-y-2">
                      <Label>Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre, dirección o cliente..."
                          value={searchObras}
                          onChange={(e) => setSearchObras(e.target.value)}
                          className="pl-10"
                          data-testid="input-search-obras"
                        />
                      </div>
                    </div>

                    {/* Cliente filter */}
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Select value={selectedClienteIdObras} onValueChange={setSelectedClienteIdObras}>
                        <SelectTrigger data-testid="select-cliente-filter">
                          <SelectValue placeholder="Todos los clientes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los clientes</SelectItem>
                          {clientsForObras.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.nokoen}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Estado filter */}
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select value={selectedEstadoObras} onValueChange={setSelectedEstadoObras}>
                        <SelectTrigger data-testid="select-estado-filter">
                          <SelectValue placeholder="Todos los estados" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="activa">Activa</SelectItem>
                          <SelectItem value="completada">Completada</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Clear filters */}
                  {(searchObras || selectedClienteIdObras !== "all" || selectedEstadoObras !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchObras("");
                        setSelectedClienteIdObras("all");
                        setSelectedEstadoObras("all");
                      }}
                      data-testid="button-clear-filters"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpiar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Obras table */}
              <Card>
                <CardContent className="p-0">
                  {loadingObras ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredObras.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No hay obras</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchObras || selectedClienteIdObras !== "all" || selectedEstadoObras !== "all"
                          ? "No se encontraron obras con los filtros aplicados."
                          : "Comienza creando tu primera obra."}
                      </p>
                      <Button onClick={handleOpenNewObraDialog} data-testid="button-primera-obra">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Obra
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Dirección</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha Inicio</TableHead>
                            <TableHead>Fecha Fin Estimada</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredObras.map((obra) => (
                            <TableRow key={obra.id} data-testid={`row-obra-${obra.id}`}>
                              <TableCell className="font-medium">{obra.nombre}</TableCell>
                              <TableCell>{obra.clienteNombre}</TableCell>
                              <TableCell className="max-w-xs truncate">{obra.direccion}</TableCell>
                              <TableCell>
                                <Badge variant={estadoObraBadgeVariant(obra.estado)} data-testid={`badge-estado-${obra.id}`}>
                                  {obra.estado}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {obra.fechaInicio ? new Date(obra.fechaInicio).toLocaleDateString('es-CL') : '-'}
                              </TableCell>
                              <TableCell>
                                {obra.fechaEstimadaFin ? new Date(obra.fechaEstimadaFin).toLocaleDateString('es-CL') : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEditObraDialog(obra)}
                                    data-testid={`button-edit-${obra.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteObraClick(obra)}
                                    data-testid={`button-delete-${obra.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reportes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Reportes Consolidados</CardTitle>
                <CardDescription>
                  Genera reportes detallados de visitas técnicas y análisis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Módulo en desarrollo</h3>
                  <p className="text-muted-foreground">
                    Los reportes consolidados estarán disponibles próximamente
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal para nueva visita técnica - Paso 1: Datos básicos */}
      {visitStep === 'basic' && (
        <Dialog open={showNewVisitModal} onOpenChange={handleCloseModal}>
          <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-y-auto m-0 rounded-none">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Nueva Visita Técnica - Datos Básicos</DialogTitle>
              <DialogDescription className="text-sm">
                Paso 1 de 3: Información general de la visita
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2 relative" ref={clientDropdownRef}>
                <label className="text-sm font-medium">Cliente *</label>
                <div className="relative">
                  <Input
                    placeholder="Escribe para buscar cliente..."
                    value={visitData.clienteName || clientSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setClientSearchTerm(value);
                      setShowClientDropdown(true);
                      if (!value) {
                        setVisitData(prev => ({ ...prev, clienteId: '', clienteName: '' }));
                      }
                    }}
                    onFocus={() => {
                      if (clientSearchTerm.length >= 3) {
                        setShowClientDropdown(true);
                      }
                    }}
                    data-testid="input-search-cliente"
                    className="pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Escribe al menos 3 caracteres para buscar
                </p>
                
                {showClientDropdown && clientSearchTerm.length >= 3 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {searchingClients ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        Buscando...
                      </div>
                    ) : clientSearchResults.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No se encontraron clientes
                      </div>
                    ) : (
                      clientSearchResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                          onClick={() => {
                            setVisitData(prev => ({ 
                              ...prev, 
                              clienteId: client.id,
                              clienteName: client.nokoen 
                            }));
                            setClientSearchTerm('');
                            setShowClientDropdown(false);
                          }}
                          data-testid={`option-cliente-${client.id}`}
                        >
                          {client.nokoen}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Técnico Asignado</label>
                <Input 
                  value={user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || ''} 
                  disabled
                  className="bg-gray-50"
                  data-testid="input-tecnico"
                />
                <p className="text-xs text-muted-foreground">
                  Automáticamente asignado al usuario actual
                </p>
              </div>
              
              {/* Selector de Obra o entrada manual */}
              {visitData.clienteId && clientObras.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seleccionar Obra</label>
                  <Select
                    value={visitData.obraId}
                    onValueChange={(value) => {
                      if (value === 'manual') {
                        setVisitData(prev => ({ 
                          ...prev, 
                          obraId: '',
                          nombreObra: '',
                          direccionObra: ''
                        }));
                      } else {
                        const obra = clientObras.find(o => o.id === value);
                        if (obra) {
                          setVisitData(prev => ({ 
                            ...prev, 
                            obraId: obra.id,
                            nombreObra: obra.nombre,
                            direccionObra: obra.direccion
                          }));
                        }
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-obra">
                      <SelectValue placeholder="Selecciona una obra del cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Ingresar manualmente</SelectItem>
                      {clientObras.map((obra) => (
                        <SelectItem key={obra.id} value={obra.id}>
                          {obra.nombre} - {obra.estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O selecciona "Ingresar manualmente" para crear una nueva obra
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de la Obra *</label>
                <Input 
                  placeholder="Ej: Edificio Las Condes 2025" 
                  value={visitData.nombreObra}
                  onChange={(e) => setVisitData(prev => ({ ...prev, nombreObra: e.target.value }))}
                  data-testid="input-nombre-obra"
                  disabled={!!visitData.obraId}
                />
                <p className="text-xs text-muted-foreground">
                  {visitData.obraId ? 'Auto-completado desde obra seleccionada' : 'Cada cliente puede tener múltiples obras'}
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Dirección de la Obra *</label>
                <Input 
                  placeholder="Dirección completa de la obra" 
                  value={visitData.direccionObra}
                  onChange={(e) => setVisitData(prev => ({ ...prev, direccionObra: e.target.value }))}
                  data-testid="input-direccion"
                  disabled={!!visitData.obraId}
                />
                {visitData.obraId && (
                  <p className="text-xs text-muted-foreground">
                    Auto-completado desde obra seleccionada
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recepcionista (Persona)</label>
                  <Input 
                    placeholder="Nombre de la persona que recibió la visita" 
                    value={visitData.recepcionistaNombre}
                    onChange={(e) => setVisitData(prev => ({ ...prev, recepcionistaNombre: e.target.value }))}
                    data-testid="input-recepcionista-nombre"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cargo del Recepcionista</label>
                  <Input 
                    placeholder="Ej: Maestro Mayor, Jefe de Obra" 
                    value={visitData.recepcionistaCargo}
                    onChange={(e) => setVisitData(prev => ({ ...prev, recepcionistaCargo: e.target.value }))}
                    data-testid="input-recepcionista-cargo"
                  />
                </div>
              </div>
              
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleCloseModal} 
                  data-testid="button-cancelar"
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => setVisitStep('products')} 
                  disabled={!visitData.clienteId || !visitData.nombreObra || !visitData.direccionObra}
                  data-testid="button-siguiente"
                  className="w-full sm:w-auto"
                >
                  <span className="hidden sm:inline">Siguiente: Seleccionar Productos</span>
                  <span className="sm:hidden">Siguiente</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para nueva visita técnica - Paso 2: Selección de productos */}
      {visitStep === 'products' && (
        <Dialog open={showNewVisitModal} onOpenChange={handleCloseModal}>
          <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-hidden flex flex-col p-0 m-0 rounded-none">
            <div className="px-6 pt-6">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Nueva Visita Técnica - Selección de Productos</DialogTitle>
                <DialogDescription className="text-sm">
                  Paso 2 de 3: Selecciona los productos que se evaluarán en la visita
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Búsqueda de productos - Fija arriba */}
            {/* Versión Desktop - Vista tradicional */}
            <div className="hidden sm:block px-6 pt-4 pb-2 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar Productos del Catálogo</label>
                <Input
                  placeholder="Buscar por SKU o nombre de producto..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  data-testid="input-buscar-producto"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">O Agregar Producto Personalizado</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="SKU (opcional)"
                    value={customProductSku}
                    onChange={(e) => setCustomProductSku(e.target.value)}
                    data-testid="input-producto-sku"
                  />
                  <Input
                    placeholder="Ej: Esmalte Sintético Rojo Ferrari"
                    value={customProductName}
                    onChange={(e) => setCustomProductName(e.target.value)}
                    data-testid="input-producto-personalizado"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleAddCustomProduct}
                    disabled={!customProductName.trim()}
                    data-testid="button-agregar-personalizado"
                    className="w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Producto Personalizado
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Productos personalizados no están en el catálogo
                </p>
              </div>
            </div>

            {/* Versión Móvil - Con pestañas */}
            <div className="sm:hidden px-6 pt-4 pb-2">
              <Tabs defaultValue="catalogo" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
                  <TabsTrigger value="personalizado">Personalizado</TabsTrigger>
                </TabsList>
                
                <TabsContent value="catalogo" className="space-y-2 mt-4">
                  <label className="text-sm font-medium">Buscar Productos</label>
                  <Input
                    placeholder="Buscar por SKU o nombre..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    data-testid="input-buscar-producto-mobile"
                  />
                </TabsContent>
                
                <TabsContent value="personalizado" className="space-y-3 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SKU (opcional)</label>
                    <Input
                      placeholder="SKU (opcional)"
                      value={customProductSku}
                      onChange={(e) => setCustomProductSku(e.target.value)}
                      data-testid="input-producto-sku-mobile"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre del Producto</label>
                    <Input
                      placeholder="Ej: Esmalte Sintético Rojo Ferrari"
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                      data-testid="input-producto-personalizado-mobile"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddCustomProduct}
                    disabled={!customProductName.trim()}
                    data-testid="button-agregar-personalizado-mobile"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Producto
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    No está en el catálogo
                  </p>
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-4 py-4">
                {/* Productos seleccionados */}
                {selectedProducts.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Productos Seleccionados ({selectedProducts.length})</label>
                    <ScrollArea className="h-24 border rounded-md p-2">
                      <div className="flex flex-wrap gap-2">
                        {selectedProducts.map((product) => {
                          const isCustom = product.productId.startsWith('custom-');
                          return (
                            <Badge 
                              key={product.productId} 
                              variant={isCustom ? "default" : "secondary"} 
                              className="gap-1"
                            >
                              {isCustom && <span className="mr-1">✨</span>}
                              {product.sku} - {product.name.substring(0, 30)}{product.name.length > 30 ? '...' : ''}
                              <button
                                onClick={() => handleRemoveProduct(product.productId)}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Lista de productos */}
                <ScrollArea className="h-[300px] border rounded-md">
                  <div className="p-4 space-y-2">
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <PackagePlus className="mx-auto h-12 w-12 mb-2 opacity-50" />
                        <p>No se encontraron productos</p>
                      </div>
                    ) : (
                      filteredProducts.map((product) => {
                        const isSelected = selectedProducts.some(p => 
                          p.productId === product.id || p.sku === product.kopr
                        );
                        return (
                          <div
                            key={product.id}
                            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                            onClick={() => {
                              handleProductToggle(product, !isSelected);
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="mt-1 pointer-events-none"
                              data-testid={`checkbox-product-${product.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs">{product.kopr}</Badge>
                                <Badge variant="secondary" className="text-xs">{product.ud02pr || 'N/A'}</Badge>
                              </div>
                              <p className="text-sm font-medium">{product.name}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3 p-6 border-t bg-background">
              <Button 
                variant="outline" 
                onClick={() => setVisitStep('basic')} 
                data-testid="button-atras"
                className="w-full sm:w-auto"
              >
                Atrás
              </Button>
              <Button 
                onClick={() => {
                  setCurrentProductIndex(0);
                  setVisitStep('evaluation');
                }} 
                disabled={selectedProducts.length === 0}
                data-testid="button-crear-evaluacion"
                className="w-full sm:w-auto"
              >
                <span className="hidden sm:inline">Continuar a Evaluación ({selectedProducts.length})</span>
                <span className="sm:hidden">Continuar ({selectedProducts.length})</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para nueva visita técnica - Paso 3: Evaluación */}
      {visitStep === 'evaluation' && selectedProducts[currentProductIndex] && (
        <Dialog open={showNewVisitModal} onOpenChange={handleCloseModal}>
          <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-hidden flex flex-col m-0 rounded-none p-0">
            {/* Cabecera compacta */}
            <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">Evaluación de Productos</h3>
                  <p className="text-xs text-muted-foreground">Producto {currentProductIndex + 1} de {selectedProducts.length}</p>
                </div>
              </div>
            </div>
            
            {/* Área de formulario expandida */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {(() => {
                const product = selectedProducts[currentProductIndex];
                const index = currentProductIndex;
                return (
                  <div key={product.productId} className="space-y-4">
                    {/* Header del producto compacto */}
                    <div className="bg-primary text-primary-foreground rounded-lg p-3">
                      <h4 className="text-sm font-semibold leading-tight mb-1">{product.name}</h4>
                      <div className="flex gap-2 flex-wrap text-xs opacity-90">
                        <span>SKU: {product.sku}</span>
                        <span>•</span>
                        <span>Formato: {product.formato}</span>
                      </div>
                    </div>

                    {/* Formulario de evaluación */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Color</label>
                          <Input 
                            placeholder="Color del producto" 
                            data-testid={`input-color-${index}`}
                            value={productEvaluations[product.productId]?.color || ''}
                            onChange={(e) => updateProductEvaluation(product.productId, 'color', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Lote</label>
                          <Input 
                            placeholder="Número de lote" 
                            data-testid={`input-lote-${index}`}
                            value={productEvaluations[product.productId]?.lote || ''}
                            onChange={(e) => updateProductEvaluation(product.productId, 'lote', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Fecha de Llegada</label>
                          <Input 
                            type="date" 
                            data-testid={`input-fecha-llegada-${index}`}
                            value={productEvaluations[product.productId]?.fechaLlegada || ''}
                            onChange={(e) => updateProductEvaluation(product.productId, 'fechaLlegada', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">% Avance</label>
                          <Input 
                            type="number" 
                            min="0" 
                            max="100" 
                            placeholder="Porcentaje de avance" 
                            data-testid={`input-avance-${index}`}
                            value={productEvaluations[product.productId]?.avance || ''}
                            onChange={(e) => updateProductEvaluation(product.productId, 'avance', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Condiciones Climáticas</label>
                          <Input 
                            placeholder="Ej: Soleado, 20°C" 
                            data-testid={`input-clima-${index}`}
                            value={productEvaluations[product.productId]?.clima || ''}
                            onChange={(e) => updateProductEvaluation(product.productId, 'clima', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">% Dilución</label>
                          <Input 
                            type="number" 
                            min="0" 
                            max="100" 
                            placeholder="Porcentaje de dilución" 
                            data-testid={`input-dilucion-${index}`}
                            value={productEvaluations[product.productId]?.dilucion || ''}
                            onChange={(e) => updateProductEvaluation(product.productId, 'dilucion', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="border-t pt-3 space-y-3">
                        <h4 className="font-medium text-sm">Evaluación Técnica</h4>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Aplicación</label>
                          <Select 
                            value={productEvaluations[product.productId]?.aplicacion || ''}
                            onValueChange={(value) => updateProductEvaluation(product.productId, 'aplicacion', value)}
                          >
                            <SelectTrigger data-testid={`select-aplicacion-${index}`}>
                              <SelectValue placeholder="Seleccionar evaluación" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="correcta">Correcta</SelectItem>
                              <SelectItem value="deficiente">Deficiente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {productEvaluations[product.productId]?.aplicacion === 'deficiente' && (
                          <div className="space-y-2 bg-red-50 p-3 rounded-lg border border-red-200">
                            <label className="text-sm font-medium text-red-900">Evidencia de Deficiencia *</label>
                            <Input 
                              placeholder="Describir el problema encontrado..." 
                              data-testid={`input-evidencia-${index}`}
                              className="bg-white"
                              value={productEvaluations[product.productId]?.evidenciaDeficiencia || ''}
                              onChange={(e) => updateProductEvaluation(product.productId, 'evidenciaDeficiencia', e.target.value)}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Observaciones Técnicas</label>
                          <Input 
                            placeholder="Observaciones sobre el producto..." 
                            data-testid={`input-observaciones-${index}`}
                            value={productEvaluations[product.productId]?.observaciones || ''}
                            onChange={(e) => updateProductEvaluation(product.productId, 'observaciones', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2 border-t pt-3">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            Evidencia Fotográfica (Máx. 5 fotos)
                          </label>
                          <Input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            data-testid={`input-fotos-${index}`}
                            className="cursor-pointer"
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (files && files.length > 5) {
                                alert('Solo puedes subir máximo 5 fotos');
                                e.target.value = '';
                                return;
                              }
                              
                              if (files && files.length > 0) {
                                const imageUrls: string[] = [];
                                
                                for (let i = 0; i < files.length; i++) {
                                  const file = files[i];
                                  const reader = new FileReader();
                                  
                                  await new Promise((resolve) => {
                                    reader.onloadend = () => {
                                      imageUrls.push(reader.result as string);
                                      resolve(null);
                                    };
                                    reader.readAsDataURL(file);
                                  });
                                }
                                
                                updateProductEvaluation(product.productId, 'imagenes', imageUrls);
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Formatos permitidos: JPG, PNG, HEIC. Máximo 5 imágenes por producto.
                          </p>
                          {productEvaluations[product.productId]?.imagenes && productEvaluations[product.productId]?.imagenes.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-2">
                              {productEvaluations[product.productId]?.imagenes.map((url: string, imgIdx: number) => (
                                <div key={imgIdx} className="relative w-20 h-20">
                                  <img 
                                    src={url} 
                                    alt={`Foto ${imgIdx + 1}`} 
                                    className="w-full h-full object-cover rounded border"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer con botones - compacto */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3 px-4 py-3 border-t bg-background shrink-0">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (currentProductIndex === 0) {
                    setVisitStep('products');
                  } else {
                    setCurrentProductIndex(currentProductIndex - 1);
                  }
                }}
                data-testid="button-atras-evaluacion"
                className="w-full sm:w-auto"
              >
                Atrás
              </Button>
              <Button 
                onClick={() => {
                  // Si no es el último producto, avanzar al siguiente
                  if (currentProductIndex < selectedProducts.length - 1) {
                    setCurrentProductIndex(currentProductIndex + 1);
                  } else {
                    // Es el último producto, ir a observaciones
                    setVisitStep('observations');
                  }
                }}
                data-testid="button-finalizar"
                className="w-full sm:w-auto"
              >
                {currentProductIndex < selectedProducts.length - 1 
                  ? 'Guardar y Continuar' 
                  : 'Continuar a Observaciones'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para Observaciones Generales (Paso 4) */}
      {visitStep === 'observations' && (
        <Dialog open={showNewVisitModal} onOpenChange={setShowNewVisitModal}>
          <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-y-auto m-0 rounded-none">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Paso 4: Observaciones Generales</DialogTitle>
              <DialogDescription className="text-sm">
                Agrega comentarios generales sobre toda la visita técnica
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Observaciones Generales <span className="text-muted-foreground">(opcional)</span>
                </label>
                <Textarea 
                  placeholder="Comentarios generales sobre toda la visita técnica, conclusiones finales, recomendaciones..."
                  value={visitData.observacionesGenerales || ''}
                  onChange={(e) => setVisitData(prev => ({ ...prev, observacionesGenerales: e.target.value }))}
                  data-testid="textarea-observaciones-generales"
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Estas observaciones se aplicarán a toda la visita técnica
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-4 border-t mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setVisitStep('evaluation');
                  setCurrentProductIndex(selectedProducts.length - 1);
                }}
                data-testid="button-atras-observaciones"
                className="w-full sm:w-auto"
              >
                Atrás
              </Button>
              <Button 
                onClick={() => {
                  if (!user?.id) {
                    alert('Error: Usuario no autenticado');
                    return;
                  }
                  
                  // Combinar productos seleccionados con sus evaluaciones
                  const productosConEvaluacion = selectedProducts.map(product => ({
                    ...product,
                    evaluacion: productEvaluations[product.productId] || {}
                  }));
                  
                  // Crear la visita con todos los datos
                  const visitCompleteData = {
                    ...visitData,
                    tecnicoId: user.id,
                    productos: productosConEvaluacion,
                    estado: 'completada'
                  };
                  
                  console.log('Enviando visita técnica:', visitCompleteData);
                  createVisitMutation.mutate(visitCompleteData);
                }}
                disabled={createVisitMutation.isPending}
                data-testid="button-crear-visita"
                className="w-full sm:w-auto"
              >
                {createVisitMutation.isPending ? 'Creando...' : 'Crear Visita Técnica'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para ver detalles de visita */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-y-auto m-0 rounded-none">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Detalle de Visita Técnica</DialogTitle>
            <DialogDescription className="text-sm">
              Información completa de la inspección técnica realizada
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetalle ? (
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
            </div>
          ) : visitaDetalle ? (
            <div className="space-y-6">
              {/* Información general */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información General</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Obra:</span>
                      <p className="font-medium">{visitaDetalle.nombreObra}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Dirección:</span>
                      <p className="font-medium">{visitaDetalle.direccionObra}</p>
                    </div>
                    {visitaDetalle.recepcionistaNombre && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Recepcionista:</span>
                        <p className="font-medium">{visitaDetalle.recepcionistaNombre}</p>
                      </div>
                    )}
                    {visitaDetalle.recepcionistaCargo && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Cargo:</span>
                        <p className="font-medium">{visitaDetalle.recepcionistaCargo}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Estado:</span>
                      <div className="mt-1">{getEstadoBadge(visitaDetalle.estado)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Observaciones Generales */}
              {visitaDetalle.observacionesGenerales && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Observaciones Generales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{visitaDetalle.observacionesGenerales}</p>
                  </CardContent>
                </Card>
              )}

              {/* Productos evaluados */}
              {visitaDetalle.productos && visitaDetalle.productos.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Productos Evaluados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {visitaDetalle.productos.map((producto: any, index: number) => (
                        <Card key={index} className="border-2">
                          <CardContent className="pt-6">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold text-base">{producto.name}</h4>
                                  <p className="text-sm text-muted-foreground">SKU: {producto.sku}</p>
                                  <p className="text-sm text-muted-foreground">Formato: {producto.formato}</p>
                                </div>
                                {producto.evaluacion?.aplicacion && (
                                  <Badge variant={producto.evaluacion.aplicacion === 'correcta' ? 'default' : 'destructive'}>
                                    {producto.evaluacion.aplicacion}
                                  </Badge>
                                )}
                              </div>

                              {producto.evaluacion && (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 p-3 bg-muted/50 rounded-lg">
                                    {producto.evaluacion.color && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Color:</span>
                                        <p className="text-sm">{producto.evaluacion.color}</p>
                                      </div>
                                    )}
                                    {producto.evaluacion.lote && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Lote:</span>
                                        <p className="text-sm">{producto.evaluacion.lote}</p>
                                      </div>
                                    )}
                                    {producto.evaluacion.fechaLlegada && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Fecha Llegada:</span>
                                        <p className="text-sm">{formatDate(producto.evaluacion.fechaLlegada)}</p>
                                      </div>
                                    )}
                                    {producto.evaluacion.avance && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Avance:</span>
                                        <p className="text-sm">{producto.evaluacion.avance}%</p>
                                      </div>
                                    )}
                                    {producto.evaluacion.condicionesClimaticas && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Clima:</span>
                                        <p className="text-sm capitalize">{producto.evaluacion.condicionesClimaticas}</p>
                                      </div>
                                    )}
                                    {producto.evaluacion.dilucion && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Dilución:</span>
                                        <p className="text-sm">{producto.evaluacion.dilucion}%</p>
                                      </div>
                                    )}
                                    {producto.evaluacion.anomalias && (
                                      <div className="col-span-2 md:col-span-3">
                                        <span className="text-xs font-medium text-muted-foreground">Deficiencia:</span>
                                        <p className="text-sm">{producto.evaluacion.anomalias}</p>
                                      </div>
                                    )}
                                    {producto.evaluacion.observacionesTecnicas && (
                                      <div className="col-span-2 md:col-span-3">
                                        <span className="text-xs font-medium text-muted-foreground">Observaciones:</span>
                                        <p className="text-sm">{producto.evaluacion.observacionesTecnicas}</p>
                                      </div>
                                    )}
                                  </div>

                                  {producto.evaluacion.imagenesUrls && producto.evaluacion.imagenesUrls.length > 0 && (
                                    <div className="mt-4">
                                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                                        <Camera className="w-4 h-4" />
                                        Evidencia Fotográfica
                                      </span>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {producto.evaluacion.imagenesUrls.map((url: string, imgIdx: number) => (
                                          <div key={imgIdx} className="relative aspect-square">
                                            <img 
                                              src={url} 
                                              alt={`Evidencia ${imgIdx + 1}`} 
                                              className="w-full h-full object-cover rounded border hover:scale-105 transition-transform cursor-pointer"
                                              onClick={() => window.open(url, '_blank')}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p>No hay productos evaluados en esta visita</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>No se pudieron cargar los detalles de la visita</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para crear/editar obras */}
      <Dialog open={showNewObraDialog} onOpenChange={handleCloseObraDialog}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-y-auto m-0 rounded-none">
          <DialogHeader>
            <DialogTitle>
              {editingObra ? "Editar Obra" : "Nueva Obra"}
            </DialogTitle>
            <DialogDescription>
              {editingObra
                ? "Modifica los datos de la obra"
                : "Completa la información para crear una nueva obra"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitObra} className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2 relative" ref={clientDropdownObrasRef}>
              <label className="text-sm font-medium">Cliente *</label>
              <div className="relative">
                <Input
                  placeholder="Escribe para buscar cliente..."
                  value={selectedClientNameObras || clientSearchObras}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientSearchObras(value);
                    setShowClientDropdownObras(true);
                    if (!value) {
                      setSelectedClientNameObras("");
                      setFormDataObra({ ...formDataObra, clienteId: "" });
                    }
                  }}
                  onFocus={() => {
                    if (clientSearchObras.length >= 3) {
                      setShowClientDropdownObras(true);
                    }
                  }}
                  data-testid="input-search-cliente-obras"
                  className="pr-10"
                  required
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-muted-foreground">
                Escribe al menos 3 caracteres para buscar
              </p>
              
              {showClientDropdownObras && clientSearchObras.length >= 3 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {clientsForObras.length > 0 ? (
                    clientsForObras.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                        onClick={() => {
                          setFormDataObra({ ...formDataObra, clienteId: client.id });
                          setSelectedClientNameObras(client.nokoen);
                          setClientSearchObras("");
                          setShowClientDropdownObras(false);
                        }}
                        data-testid={`client-option-${client.id}`}
                      >
                        {client.nokoen}
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      No se encontraron clientes
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre de la Obra <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                value={formDataObra.nombre}
                onChange={(e) => setFormDataObra({ ...formDataObra, nombre: e.target.value })}
                placeholder="Ej: Edificio Las Condes"
                required
                data-testid="input-nombre"
              />
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="direccion">
                Dirección <span className="text-destructive">*</span>
              </Label>
              <Input
                id="direccion"
                value={formDataObra.direccion}
                onChange={(e) => setFormDataObra({ ...formDataObra, direccion: e.target.value })}
                placeholder="Ej: Av. Providencia 123, Santiago"
                required
                data-testid="input-direccion"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formDataObra.descripcion || ""}
                onChange={(e) => setFormDataObra({ ...formDataObra, descripcion: e.target.value })}
                placeholder="Descripción opcional de la obra..."
                rows={3}
                data-testid="textarea-descripcion"
              />
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={formDataObra.estado}
                onValueChange={(value: "activa" | "completada" | "cancelada") =>
                  setFormDataObra({ ...formDataObra, estado: value })
                }
              >
                <SelectTrigger id="estado" data-testid="select-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha Inicio */}
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha de Inicio</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={formDataObra.fechaInicio || ""}
                  onChange={(e) => setFormDataObra({ ...formDataObra, fechaInicio: e.target.value || undefined })}
                  data-testid="input-fecha-inicio"
                />
              </div>

              {/* Fecha Fin Estimada */}
              <div className="space-y-2">
                <Label htmlFor="fechaEstimadaFin">Fecha Fin Estimada</Label>
                <Input
                  id="fechaEstimadaFin"
                  type="date"
                  value={formDataObra.fechaEstimadaFin || ""}
                  onChange={(e) =>
                    setFormDataObra({ ...formDataObra, fechaEstimadaFin: e.target.value || undefined })
                  }
                  data-testid="input-fecha-fin"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseObraDialog}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createObraMutation.isPending || updateObraMutation.isPending}
                data-testid="button-submit"
              >
                {(createObraMutation.isPending || updateObraMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingObra ? "Actualizar" : "Crear Obra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteObraDialog} onOpenChange={setShowDeleteObraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la obra "{obraToDelete?.nombre}"? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteObraDialog(false);
                setObraToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteObra}
              disabled={deleteObraMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteObraMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Firmas */}
      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5" />
              Firmar Visita Técnica
            </DialogTitle>
            <DialogDescription>
              Complete los datos y firmas para registrar la recepción de la visita técnica
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Firma del Técnico */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <User className="w-4 h-4" />
                Técnico que realiza la visita
              </h3>
              <div className="space-y-2">
                <Label htmlFor="firmaTecnicoNombre">Nombre completo</Label>
                <Input
                  id="firmaTecnicoNombre"
                  placeholder="Ingrese el nombre del técnico"
                  value={firmaTecnicoNombre}
                  onChange={(e) => setFirmaTecnicoNombre(e.target.value)}
                  data-testid="input-firma-tecnico-nombre"
                />
              </div>
              <div className="space-y-2">
                <Label>Firma del técnico</Label>
                <SignaturePad
                  onSignatureChange={setFirmaTecnicoData}
                  width={400}
                  height={150}
                />
              </div>
            </div>

            {/* Separador */}
            <div className="border-t pt-4" />

            {/* Firma del Recepcionista */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <User className="w-4 h-4" />
                Persona que recepciona la obra
              </h3>
              <div className="space-y-2">
                <Label htmlFor="firmaRecepcionistaNombre">Nombre completo</Label>
                <Input
                  id="firmaRecepcionistaNombre"
                  placeholder="Ingrese el nombre del recepcionista"
                  value={firmaRecepcionistaNombre}
                  onChange={(e) => setFirmaRecepcionistaNombre(e.target.value)}
                  data-testid="input-firma-recepcionista-nombre"
                />
              </div>
              <div className="space-y-2">
                <Label>Firma del recepcionista</Label>
                <SignaturePad
                  onSignatureChange={setFirmaRecepcionistaData}
                  width={400}
                  height={150}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseSignatureModal}
              data-testid="button-cancel-signature"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSignatures}
              disabled={saveSignaturesMutation.isPending}
              data-testid="button-save-signature"
            >
              {saveSignaturesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Firmas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}