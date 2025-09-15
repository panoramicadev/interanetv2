import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Upload, Download, Search } from "lucide-react";

export default function ListaPrecios() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Lista de Precios
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestión y consulta de precios comerciales
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button variant="outline">
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lista de Precios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Lista de Precios en Preparación
              </h3>
              <p className="text-muted-foreground mb-6">
                Esta sección estará disponible próximamente para la gestión de precios comerciales.
                <br />
                Podrás importar y gestionar catálogos de precios desde archivos CSV.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Button variant="outline" disabled>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar desde CSV
                </Button>
                <Button variant="outline" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Plantilla
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Características Próximamente:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Importación masiva desde CSV</li>
                  <li>• Gestión de precios por cliente</li>
                  <li>• Búsqueda y filtrado avanzado</li>
                  <li>• Histórico de cambios de precios</li>
                  <li>• Exportación personalizada</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Formato de CSV Esperado:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Código de producto</li>
                  <li>• Nombre del producto</li>
                  <li>• Precio de lista</li>
                  <li>• Precio especial (opcional)</li>
                  <li>• Categoría</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}