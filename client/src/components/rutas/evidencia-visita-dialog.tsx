import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageZoomViewer, getProxiedUrl } from "@/components/ui/image-zoom-viewer";
import { Camera, ChevronLeft, ChevronRight, ExternalLink, MapPin, StickyNote, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Evidencia que el vendedor deja al completar una visita de ruta:
 * foto + geolocalización + nota. Se guarda en `ruta_visitas`.
 */
export interface VisitaEvidencia {
  id: string;
  clienteId?: string;
  fecha: string;
  nota: string | null;
  imagenUrl: string | null;
  lat: string | null;
  lng: string | null;
  clienteNombre?: string | null;
  rutaNombre?: string | null;
  registradoPorNombre?: string | null;
}

/** ¿La visita tiene algo que revisar (foto, ubicación o nota)? */
export function tieneEvidencia(v: VisitaEvidencia): boolean {
  return !!(v.imagenUrl || (v.lat && v.lng) || (v.nota && v.nota.trim()));
}

/**
 * Miniatura de la foto de una visita. Si la visita no trae foto muestra un
 * placeholder para que se note que se registró sin evidencia fotográfica.
 * Las imágenes viven en Supabase, por eso pasan por el proxy del servidor.
 */
export function EvidenciaThumb({ visita, onClick, className = "" }: { visita: VisitaEvidencia; onClick?: () => void; className?: string }) {
  const label = `Visita del ${format(new Date(visita.fecha), "dd MMM yyyy", { locale: es })}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={visita.imagenUrl ? `Ver evidencia · ${label}` : `Sin foto · ${label}`}
      className={`relative h-14 w-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0 hover:border-[#fd6301] hover:shadow-sm transition-all ${className}`}
    >
      {visita.imagenUrl ? (
        <img src={getProxiedUrl(visita.imagenUrl)} alt={label} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="h-full w-full flex items-center justify-center text-slate-300 dark:text-slate-600">
          <Camera className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}

/**
 * Visor de la evidencia de visitas: foto con zoom/rotación, nota, ubicación en
 * Google Maps y quién la registró. Si se le pasan varias visitas permite
 * navegar entre ellas con las flechas.
 *
 * z-[80]: el sidebar es fixed z-[60] y los modales del panel llegan a z-[70].
 */
export function EvidenciaVisitaDialog({
  visitas,
  startIndex = 0,
  onClose,
}: {
  visitas: VisitaEvidencia[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(visitas.length - 1, 0)));
  const v = visitas[index];
  if (!v) return null;

  const fecha = format(new Date(v.fecha), "dd 'de' MMMM yyyy · HH:mm", { locale: es });
  const geo = v.lat && v.lng ? { lat: v.lat, lng: v.lng } : null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[640px] z-[80] max-h-[92vh] overflow-y-auto" overlayClassName="z-[80]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#fd6301]" />
            Evidencia de la visita
          </DialogTitle>
          <DialogDescription className="text-xs">
            {[v.clienteNombre, v.rutaNombre].filter(Boolean).join(" · ") || "Visita de ruta"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {v.imagenUrl ? (
            <ImageZoomViewer src={v.imagenUrl} alt={`Evidencia de la visita del ${fecha}`} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
              <Camera className="h-6 w-6" />
              <p className="text-xs">Esta visita se registró sin foto.</p>
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{fecha}</p>
            {v.nota && (
              <p className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                <StickyNote className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" /> {v.nota}
              </p>
            )}
            {geo ? (
              <a
                href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" /> Ver ubicación ({Number(geo.lat).toFixed(5)}, {Number(geo.lng).toFixed(5)})
              </a>
            ) : (
              <p className="flex items-center gap-1.5 text-slate-400"><MapPin className="h-3.5 w-3.5" /> Sin ubicación registrada.</p>
            )}
            {v.registradoPorNombre && (
              <p className="flex items-center gap-1.5 text-slate-400"><User className="h-3.5 w-3.5" /> Registrada por {v.registradoPorNombre}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              {visitas.length > 1 && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-2xl h-8"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-[11px] text-slate-500 tabular-nums">{index + 1} / {visitas.length}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-2xl h-8"
                    disabled={index === visitas.length - 1}
                    onClick={() => setIndex((i) => Math.min(visitas.length - 1, i + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {v.imagenUrl && (
              <a href={v.imagenUrl} target="_blank" rel="noreferrer">
                <Button type="button" size="sm" variant="ghost" className="rounded-2xl h-8 text-xs">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir original
                </Button>
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
