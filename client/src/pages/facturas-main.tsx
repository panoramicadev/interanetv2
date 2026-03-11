import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, BarChart3, Truck, DollarSign, FileSpreadsheet } from "lucide-react";
import { FacturasTable } from "@/components/facturas/facturas-table";
import NVVPage from "./nvv";
import GDVPage from "./gdv";
import ProyeccionPage from "./proyeccion";
import ListaPrecios from "./lista-precios";
import PresupuestoVentas from "./presupuesto-ventas";

export default function FacturasMainPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("facturas");

  // Check if the user is authorized
  if (!user || (user.role !== "admin" && user.role !== "supervisor" && user.role !== "logistica_bodega" && user.role !== "salesperson" && user.role !== "client")) {
    setLocation("/dashboard");
    return null;
  }

  // Check if user can see proyección tab
  const canSeeProyeccion = user.role !== 'salesperson';

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Finanzas</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Administra facturas, notas de venta, proyecciones de ventas y solicitudes de crédito
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex min-w-max gap-1 p-1">
            <TabsTrigger value="facturas" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-facturas">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Facturas</span>
              <span className="sm:hidden">Fact.</span>
            </TabsTrigger>
            <TabsTrigger value="nvv" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-nvv">
              <TrendingUp className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Notas de Venta (NVV)</span>
              <span className="sm:hidden">NVV</span>
            </TabsTrigger>
            <TabsTrigger value="gdv" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-gdv">
              <Truck className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Guías de Despacho (GDV)</span>
              <span className="sm:hidden">GDV</span>
            </TabsTrigger>
            {canSeeProyeccion && (
              <TabsTrigger value="proyeccion" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-proyeccion">
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Proyección</span>
                <span className="sm:hidden">Proy.</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="lista-precios" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-lista-precios">
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Lista de Precios</span>
              <span className="sm:hidden">Precios</span>
            </TabsTrigger>
            <TabsTrigger value="solicitud-credito" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-solicitud-credito">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Solicitud de Crédito</span>
              <span className="sm:hidden">Crédito</span>
            </TabsTrigger>
            <TabsTrigger value="presupuesto-ventas" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-presupuesto-ventas">
              <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Presupuesto Ventas</span>
              <span className="sm:hidden">Presup.</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Facturas Tab */}
        <TabsContent value="facturas" className="mt-6">
          <FacturasTable />
        </TabsContent>

        {/* NVV Tab */}
        <TabsContent value="nvv" className="mt-6">
          <NVVPage />
        </TabsContent>

        {/* GDV Tab */}
        <TabsContent value="gdv" className="mt-6">
          <GDVPage />
        </TabsContent>

        {/* Proyección Tab */}
        {canSeeProyeccion && (
          <TabsContent value="proyeccion" className="mt-6">
            <ProyeccionPage />
          </TabsContent>
        )}

        {/* Lista de Precios Tab */}
        <TabsContent value="lista-precios" className="mt-6">
          <ListaPrecios />
        </TabsContent>

        {/* Solicitud de Crédito Tab */}
        <TabsContent value="solicitud-credito" className="mt-6">
          <SolicitudCreditoForm />
        </TabsContent>

        {/* Presupuesto Ventas Tab */}
        <TabsContent value="presupuesto-ventas" className="mt-6">
          <PresupuestoVentas />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SolicitudCreditoForm() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    razonSocial: '',
    rut: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    giro: '',
    correo: '',
    socio1Nombre: '',
    socio1Direccion: '',
    socio2Nombre: '',
    socio2Direccion: '',
    representanteNombre: '',
    representanteCedula: '',
    banco1: '',
    cuenta1: '',
    sucursal1: '',
    banco2: '',
    cuenta2: '',
    sucursal2: '',
    creditoSolicitado: '',
    creditoAprobado: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica de campos requeridos
    if (!formData.razonSocial || !formData.rut || !formData.direccion || !formData.ciudad || !formData.telefono || !formData.creditoSolicitado) {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa todos los campos obligatorios marcados con *",
        variant: "destructive"
      });
      return;
    }

    // Simular envío exitoso
    console.log('Solicitud de crédito enviada:', formData);
    
    toast({
      title: "Solicitud enviada",
      description: "Tu solicitud de crédito ha sido enviada exitosamente y será revisada pronto.",
      variant: "default"
    });

    // Limpiar formulario
    setFormData({
      razonSocial: '',
      rut: '',
      direccion: '',
      ciudad: '',
      telefono: '',
      giro: '',
      correo: '',
      socio1Nombre: '',
      socio1Direccion: '',
      socio2Nombre: '',
      socio2Direccion: '',
      representanteNombre: '',
      representanteCedula: '',
      banco1: '',
      cuenta1: '',
      sucursal1: '',
      banco2: '',
      cuenta2: '',
      sucursal2: '',
      creditoSolicitado: '',
      creditoAprobado: ''
    });
  };

  const handleCancel = () => {
    setFormData({
      razonSocial: '',
      rut: '',
      direccion: '',
      ciudad: '',
      telefono: '',
      giro: '',
      correo: '',
      socio1Nombre: '',
      socio1Direccion: '',
      socio2Nombre: '',
      socio2Direccion: '',
      representanteNombre: '',
      representanteCedula: '',
      banco1: '',
      cuenta1: '',
      sucursal1: '',
      banco2: '',
      cuenta2: '',
      sucursal2: '',
      creditoSolicitado: '',
      creditoAprobado: ''
    });
    
    toast({
      title: "Formulario limpiado",
      description: "Se han borrado todos los datos del formulario.",
      variant: "default"
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="modern-card p-6">
        <h2 className="text-2xl font-bold mb-6">Solicitud de Crédito</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos del Solicitante */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Datos del Solicitante</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón Social <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.razonSocial}
                  onChange={(e) => setFormData({...formData, razonSocial: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Razón Social"
                  data-testid="input-razon-social"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUT <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rut}
                  onChange={(e) => setFormData({...formData, rut: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12.345.678-9"
                  data-testid="input-rut"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dirección"
                  data-testid="input-direccion"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ciudad}
                  onChange={(e) => setFormData({...formData, ciudad: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ciudad"
                  data-testid="input-ciudad"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+56 9 1234 5678"
                  data-testid="input-telefono"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giro
                </label>
                <input
                  type="text"
                  value={formData.giro}
                  onChange={(e) => setFormData({...formData, giro: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Giro comercial"
                  data-testid="input-giro"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico Receptor (SII)
              </label>
              <input
                type="email"
                value={formData.correo}
                onChange={(e) => setFormData({...formData, correo: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="correo@ejemplo.com"
                data-testid="input-correo"
              />
            </div>
          </div>

          {/* Socios Principales */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Socios Principales</h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Socio 1</label>
                  <input
                    type="text"
                    value={formData.socio1Nombre}
                    onChange={(e) => setFormData({...formData, socio1Nombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo"
                    data-testid="input-socio-1-nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Particular</label>
                  <input
                    type="text"
                    value={formData.socio1Direccion}
                    onChange={(e) => setFormData({...formData, socio1Direccion: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección"
                    data-testid="input-socio-1-direccion"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Socio 2</label>
                  <input
                    type="text"
                    value={formData.socio2Nombre}
                    onChange={(e) => setFormData({...formData, socio2Nombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo"
                    data-testid="input-socio-2-nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Particular</label>
                  <input
                    type="text"
                    value={formData.socio2Direccion}
                    onChange={(e) => setFormData({...formData, socio2Direccion: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección"
                    data-testid="input-socio-2-direccion"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Representante Legal */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Representante Legal</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={formData.representanteNombre}
                  onChange={(e) => setFormData({...formData, representanteNombre: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre completo"
                  data-testid="input-representante-nombre"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cédula de Identidad</label>
                <input
                  type="text"
                  value={formData.representanteCedula}
                  onChange={(e) => setFormData({...formData, representanteCedula: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12.345.678-9"
                  data-testid="input-representante-cedula"
                />
              </div>
            </div>
          </div>

          {/* Cuentas Corrientes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Cuentas Corrientes</h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                  <input
                    type="text"
                    value={formData.banco1}
                    onChange={(e) => setFormData({...formData, banco1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del banco"
                    data-testid="input-banco-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cta. Cte. Nº</label>
                  <input
                    type="text"
                    value={formData.cuenta1}
                    onChange={(e) => setFormData({...formData, cuenta1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Número de cuenta"
                    data-testid="input-cuenta-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                  <input
                    type="text"
                    value={formData.sucursal1}
                    onChange={(e) => setFormData({...formData, sucursal1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sucursal"
                    data-testid="input-sucursal-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                  <input
                    type="text"
                    value={formData.banco2}
                    onChange={(e) => setFormData({...formData, banco2: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del banco"
                    data-testid="input-banco-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cta. Cte. Nº</label>
                  <input
                    type="text"
                    value={formData.cuenta2}
                    onChange={(e) => setFormData({...formData, cuenta2: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Número de cuenta"
                    data-testid="input-cuenta-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                  <input
                    type="text"
                    value={formData.sucursal2}
                    onChange={(e) => setFormData({...formData, sucursal2: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sucursal"
                    data-testid="input-sucursal-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Montos de Crédito */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Crédito</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Crédito Solicitado <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.creditoSolicitado}
                    onChange={(e) => setFormData({...formData, creditoSolicitado: e.target.value})}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    data-testid="input-credito-solicitado"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Crédito Aprobado
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.creditoAprobado}
                    onChange={(e) => setFormData({...formData, creditoAprobado: e.target.value})}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
                    placeholder="0"
                    data-testid="input-credito-aprobado"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              data-testid="button-cancel-credito"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              data-testid="button-submit-credito"
            >
              Enviar Solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
