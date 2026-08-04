/**
 * Ruta /gastos-empresariales/nuevo.
 *
 * El formulario en sí vive en components/gastos/formulario-gasto.tsx porque la
 * pestaña "Añadir Gasto" del módulo monta el mismo componente sin salir de la
 * vista. Esta página queda como envoltorio para los enlaces directos que ya
 * circulan (notificaciones, accesos guardados).
 */
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import FormularioGasto from "@/components/gastos/formulario-gasto";

export default function GastosEmpresarialesForm() {
  const [, setLocation] = useLocation();
  const volver = () => setLocation("/gastos-empresariales");

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-5">
        <Button
          variant="ghost"
          onClick={volver}
          className="mb-3 rounded-2xl"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
          Nuevo gasto
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Carga el comprobante y los datos del gasto para rendirlo.
        </p>
      </div>

      <FormularioGasto modo="pagina" onGuardado={volver} onCancelar={volver} />
    </div>
  );
}
