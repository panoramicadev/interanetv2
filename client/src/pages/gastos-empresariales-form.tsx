import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const formSchema = z.object({
  monto: z.string().min(1, "El monto es requerido"),
  descripcion: z.string().min(1, "La descripción es requerida"),
  centroCostos: z.string().optional(),
  categoria: z.string().min(1, "La categoría es requerida"),
  tipoGasto: z.string().min(1, "El tipo de gasto es requerido"),
  tipoDocumento: z.string().optional(),
  proveedor: z.string().optional(),
  rutProveedor: z.string().optional(),
  numeroDocumento: z.string().optional(),
  fechaEmision: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GastosEmpresarialesForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      monto: "",
      descripcion: "",
      centroCostos: "",
      categoria: "",
      tipoGasto: "",
      tipoDocumento: "",
      proveedor: "",
      rutProveedor: "",
      numeroDocumento: "",
      fechaEmision: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest('/api/gastos-empresariales', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          monto: parseFloat(data.monto),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      toast({
        title: "Gasto creado",
        description: "El gasto ha sido registrado correctamente",
      });
      setLocation('/gastos-empresariales');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el gasto",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/gastos-empresariales')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Nuevo Gasto Empresarial</h1>
          <p className="text-sm text-gray-500 mt-1">Registra un nuevo gasto empresarial</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Información Básica</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ej: 50000"
                            {...field}
                            data-testid="input-monto"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-categoria-form">
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Combustibles">Combustibles</SelectItem>
                            <SelectItem value="Colación">Colación</SelectItem>
                            <SelectItem value="Gestión Ventas">Gestión Ventas</SelectItem>
                            <SelectItem value="Otros">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe el gasto..."
                          {...field}
                          rows={3}
                          data-testid="textarea-descripcion"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipoGasto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Gasto *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tipo-gasto">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Fijo">Fijo</SelectItem>
                            <SelectItem value="Variable">Variable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="centroCostos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Centro de Costos</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: Ventas Santiago"
                            {...field}
                            data-testid="input-centro-costos"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Document Info */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Información del Documento</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipoDocumento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Documento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tipo-documento">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Boleta">Boleta</SelectItem>
                            <SelectItem value="Factura">Factura</SelectItem>
                            <SelectItem value="Recibo">Recibo</SelectItem>
                            <SelectItem value="Otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numeroDocumento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Documento</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: 123456"
                            {...field}
                            data-testid="input-numero-documento"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="proveedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nombre del proveedor"
                            {...field}
                            data-testid="input-proveedor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rutProveedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUT Proveedor</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: 12.345.678-9"
                            {...field}
                            data-testid="input-rut-proveedor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fechaEmision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Emisión</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-fecha-emision"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/gastos-empresariales')}
                  className="w-full sm:w-auto"
                  data-testid="button-cancel-form"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-submit-form"
                >
                  {createMutation.isPending ? 'Guardando...' : 'Guardar Gasto'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </DashboardLayout>
  );
}
