// ==================================================================================
// "Nueva tarea" del módulo Marketing.
//
// Vive en su propio archivo y no dentro de `pages/marketing.tsx` porque lo usa la
// sección "Mis tareas": teniéndolo allá, el import quedaba circular (la página
// importa la sección y la sección importaba la página).
//
// La tarea se crea en el segmento marketing y auto-asignada a quien la escribe: es
// para anotar el propio trabajo, no para repartirlo.
// ==================================================================================
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckSquare, Loader2, Plus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const createMarketingTaskSchema = z.object({
  title: z.string().min(1, "Título es requerido"),
  description: z.string().optional(),
  type: z.enum(["texto", "formulario", "visita"]).default("texto"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().or(z.null()),
  clienteId: z.string().optional().or(z.null()),
  clienteNombre: z.string().optional().or(z.null()),
  plataforma: z.string().optional(),
  presupuesto: z.string().optional(),
  urlReferencia: z.string().optional(),
  assignments: z.array(z.object({
    assigneeType: z.enum(["supervisor", "salesperson"]),
    assigneeId: z.string().min(1, "Destinatario requerido"),
  })).optional().default([]),
});

type CreateMarketingTaskInput = z.infer<typeof createMarketingTaskSchema>;

export function MarketingTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void; }) {
  const { user } = useAuth();
  const { toast } = useToast();



  const form = useForm<CreateMarketingTaskInput>({
    resolver: zodResolver(createMarketingTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "texto",
      priority: "medium",
      dueDate: null,
      clienteId: null,
      clienteNombre: null,
      plataforma: "general",
      presupuesto: "",
      urlReferencia: "",
      assignments: [],
    },
  });

  const createMutation = useMutation<any, Error, CreateMarketingTaskInput & { segmento: string; payload?: Record<string, any> }>({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/marketing'], refetchType: 'all' });
      toast({ title: "Tarea de marketing creada" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateMarketingTaskInput) => {
    const payload = {
      plataforma: data.plataforma,
      presupuesto: data.presupuesto,
      urlReferencia: data.urlReferencia
    };
    // Auto-assign to creator
    const autoAssignments = [{
      assigneeType: ((user?.role === 'supervisor' || user?.role === 'encargado_area') || user?.role === 'admin' ? 'supervisor' : 'salesperson') as 'supervisor' | 'salesperson',
      assigneeId: user?.id || '',
    }];
    createMutation.mutate({ ...data, assignments: autoAssignments, payload, segmento: "marketing" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader className="p-6 pb-4 bg-slate-900 border-b relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:16px_16px]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative flex items-start gap-4">
            <div className="p-2.5 bg-orange-500/20 rounded-xl border border-orange-500/20 shadow-inner">
              <CheckSquare className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-xl text-white font-semibold">Nueva Tarea de Marketing</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Completa los detalles de la tarea (Segmento: Marketing por defecto)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">

            {/* Sección 1: Info Básica */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Información de la tarea
              </div>
              <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">TÍTULO *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Revisar campaña de redes sociales..."
                          className="bg-white border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">DESCRIPCIÓN</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Agrega detalles, instrucciones o contexto..."
                          className="min-h-[100px] resize-none bg-white border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Sección 2: Plazos (2 columnas porque quitamos segmento y prioridad visualmente) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Fecha Límite
              </div>
              <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4">
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FECHA LÍMITE</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="bg-white border-slate-200"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Sección Marketing fields */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                Datos de Marketing
              </div>
              <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plataforma"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PLATAFORMA</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white border-slate-200">
                              <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="web">Sitio Web</SelectItem>
                            <SelectItem value="impreso">Impreso/Físico</SelectItem>
                            <SelectItem value="evento">Evento</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="presupuesto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PRESUPUESTO ESTIMADO (CLP)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ej: 50000"
                            className="bg-white border-slate-200"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="urlReferencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ENLACE / CARPETA DRIVE (OPCIONAL)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://..."
                          className="bg-white border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>



            <DialogFooter className="sticky bottom-0 bg-white pt-4 mt-6 border-t border-slate-100 flex items-center justify-end gap-3 sm:justify-end">
              <Button type="button" variant="outline" className="rounded-xl font-medium" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="rounded-xl font-medium bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/20">
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Crear Tarea</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog >
  );
}
