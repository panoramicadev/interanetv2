import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHANGELOG_ENTRIES = [
  {
    version: "2.8.0",
    date: "Octubre 2025",
    changes: [
      { type: "feature", text: "Sistema de imágenes de evidencia para tareas completadas" },
      { type: "improvement", text: "Optimización de entrada móvil: auto-selección en campos numéricos" },
      { type: "improvement", text: "Panel de tareas optimizado para móvil con filtros colapsables" },
    ]
  },
  {
    version: "2.7.0",
    date: "Octubre 2025",
    changes: [
      { type: "feature", text: "Nuevo rol Técnico de Obra con dashboard dedicado" },
      { type: "feature", text: "Sistema de visitas técnicas con evaluación de productos y observaciones" },
      { type: "improvement", text: "Soporte para productos personalizados en visitas técnicas" },
      { type: "improvement", text: "Información de recepcionista en visitas técnicas" },
    ]
  },
  {
    version: "2.6.0",
    date: "Octubre 2025",
    changes: [
      { type: "feature", text: "Sistema PWA con actualizaciones automáticas" },
      { type: "feature", text: "Notificaciones de actualización de versión" },
      { type: "improvement", text: "Experiencia offline mejorada" },
    ]
  },
  {
    version: "2.5.0",
    date: "Octubre 2025",
    changes: [
      { type: "feature", text: "Generación profesional de PDF con React-PDF" },
      { type: "feature", text: "Sistema de compartir presupuestos por email" },
      { type: "improvement", text: "Logo de 30° aniversario en documentos PDF" },
      { type: "fix", text: "Corrección de cálculos de ventas totales" },
    ]
  },
  {
    version: "2.4.0",
    date: "Octubre 2025",
    changes: [
      { type: "feature", text: "Análisis de segmentos por vendedor con gráfico de torta" },
      { type: "feature", text: "Control de acceso a facturas basado en roles" },
      { type: "improvement", text: "Visibilidad de columnas según rol en gestión de presupuestos" },
    ]
  },
  {
    version: "2.3.0",
    date: "Septiembre 2025",
    changes: [
      { type: "feature", text: "Sistema de gestión de tareas con asignaciones" },
      { type: "feature", text: "Dashboard unificado para supervisores y administradores" },
      { type: "feature", text: "Importación directa de NVV sin filtros" },
    ]
  },
];

const getTypeBadge = (type: string) => {
  switch (type) {
    case "feature":
      return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Nueva</Badge>;
    case "improvement":
      return <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">Mejora</Badge>;
    case "fix":
      return <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">Corrección</Badge>;
    default:
      return <Badge>{type}</Badge>;
  }
};

export default function ChangelogDialog({ open, onOpenChange }: ChangelogDialogProps) {
  const handleConfirm = () => {
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-screen p-0 sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:p-6">
        <div className="flex flex-col h-full">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 sm:px-0 sm:pt-0">
            <DialogTitle className="text-2xl">Últimos Cambios Publicados</DialogTitle>
            <DialogDescription>
              Historial de actualizaciones y mejoras del sistema Panorámica
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-shrink-0 px-6 pb-4 sm:px-0 sm:pb-0">
            <Button 
              onClick={handleConfirm}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-6 text-base"
              data-testid="confirm-update-button"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirmar actualización
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 sm:px-0">
            <div className="space-y-6 pr-4 pb-6">
              {CHANGELOG_ENTRIES.map((entry, index) => (
                <div key={index} className="border-l-2 border-primary/20 pl-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">Versión {entry.version}</h3>
                    <span className="text-sm text-muted-foreground">{entry.date}</span>
                  </div>
                  <ul className="space-y-2">
                    {entry.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className="flex items-start gap-2">
                        {getTypeBadge(change.type)}
                        <span className="text-sm flex-1 pt-0.5">{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
