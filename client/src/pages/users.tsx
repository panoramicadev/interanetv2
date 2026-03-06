import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Edit, Trash2, Users, Check, ChevronsUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSalespersonUserSchema, type InsertSalespersonUserInput, type SalespersonUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SalespersonUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  // Verificar permisos de admin
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'supervisor') {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores y supervisores pueden acceder a esta página.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation('/');
      }, 1000);
    }
  }, [user, toast, setLocation]);

  // Query para obtener usuarios
  const { data: salespeopleUsers = [], isLoading } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Filtrar usuarios según el filtro seleccionado
  const filteredUsers = salespeopleUsers.filter((userData) => {
    if (roleFilter === "todos") return true;
    return userData.role === roleFilter;
  });

  // Función para obtener el nombre del supervisor
  const getSupervisorName = (supervisorId: string | null) => {
    if (!supervisorId || supervisorId === 'none') return 'Sin supervisor';
    const supervisor = availableSupervisors.find(s => s.id === supervisorId);
    return supervisor ? supervisor.salespersonName : 'Sin supervisor';
  };

  // Función para obtener sugerencia de segmento basado en ventas
  const getSegmentSuggestion = (assignedSegment: string | null) => {
    if (assignedSegment) return assignedSegment;
    
    // Si no tiene segmento asignado, sugerir el de mejores ventas
    const topSegment = segmentsData[0]; // Ya están ordenados por ventas DESC
    if (topSegment) {
      return `💡 ${topSegment.segment}`;
    }
    return 'Sin segmento';
  };

  // Query para obtener vendedores disponibles
  const { data: availableSalespeople = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Query para obtener supervisores disponibles
  const { data: availableSupervisors = [] } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople/supervisors"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Query para obtener clientes disponibles
  const { data: availableClients = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/clients"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Query para obtener segmentos únicos (para asignación de usuarios)
  const { data: availableSegments = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Query para obtener segmentos ordenados por ventas (para sugerencias)
  const { data: segmentsData = [] } = useQuery<Array<{segment: string; totalSales: number; percentage: number}>>({
    queryKey: ["/api/sales/segments?period=2025-09&filterType=month"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Helper para extraer mensaje de error del backend
  const extractErrorMessage = (error: any): string => {
    try {
      // El error llega como "400: {"message":"Ya existe un usuario con ese nombre"}"
      const errorMsg = error.message || "";
      const jsonMatch = errorMsg.match(/\{.*\}/);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        return errorData.message || errorMsg;
      }
      return errorMsg || "Error desconocido";
    } catch {
      return error.message || "Error desconocido";
    }
  };

  // Mutation para crear usuario
  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertSalespersonUserInput) => {
      return await apiRequest("POST", "/api/users/salespeople", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      createForm.reset();
      setIsCreateDialogOpen(false);
      toast({
        title: "Usuario creado",
        description: "El usuario se ha creado correctamente.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error al crear usuario",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Mutation para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: string; userData: Partial<InsertSalespersonUserInput> }) => {
      return await apiRequest("PUT", `/api/users/salespeople/${id}`, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      editForm.reset();
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast({
        title: "Usuario actualizado",
        description: "El usuario se ha actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error al actualizar usuario",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Mutation para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/salespeople/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario se ha eliminado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario.",
        variant: "destructive",
      });
    },
  });


  // Función para generar nombre de usuario automáticamente
  const generateUsername = (fullName: string): string => {
    const nameParts = fullName.trim().toLowerCase().split(' ');
    if (nameParts.length < 2) {
      return nameParts[0].substring(0, 4);
    }
    const firstLetter = nameParts[0].charAt(0);
    const firstLastName = nameParts[1];
    return firstLetter + firstLastName;
  };

  // Form para crear usuario
  const createForm = useForm<InsertSalespersonUserInput>({
    resolver: zodResolver(insertSalespersonUserSchema),
    defaultValues: {
      salespersonName: "",
      username: "",
      email: "",
      password: "",
      isActive: true,
      role: "salesperson",
      supervisorId: null,
      assignedSegment: null,
    },
  });

  // Watch salespersonName to auto-generate username
  const watchedSalesperson = createForm.watch("salespersonName");
  const watchedRole = createForm.watch("role");
  
  useEffect(() => {
    if (watchedSalesperson) {
      const autoUsername = generateUsername(watchedSalesperson);
      createForm.setValue("username", autoUsername);
    }
  }, [watchedSalesperson, createForm]);

  // Helper function to determine if a role should show segment field
  const shouldShowSegmentField = (role: string | null | undefined) => {
    const rolesWithoutSegment = ["laboratorio", "produccion", "logistica_bodega", "planificacion", "bodega_materias_primas", "prevencion_riesgos", "tecnico_obra", "client", "reception"];
    return role && !rolesWithoutSegment.includes(role);
  };

  // Clear fields when role changes
  useEffect(() => {
    if (watchedRole !== "salesperson") {
      createForm.setValue("supervisorId", null);
    }
    if (watchedRole !== "supervisor") {
      createForm.setValue("assignedSegment", null);
    }
    if (!shouldShowSegmentField(watchedRole)) {
      createForm.setValue("assignedSegment", null);
    }
  }, [watchedRole, createForm]);

  // Form para editar usuario
  const editForm = useForm<InsertSalespersonUserInput>({
    resolver: zodResolver(insertSalespersonUserSchema),
    defaultValues: {
      salespersonName: "",
      username: "",
      email: "",
      password: "",
      isActive: true,
      role: "salesperson",
      supervisorId: null,
      assignedSegment: null,
    },
  });

  // Logic for edit form - watch role changes
  const watchedEditRole = editForm.watch("role");
  useEffect(() => {
    if (watchedEditRole !== "salesperson") {
      editForm.setValue("supervisorId", null);
    }
    // Removed segment clearing - all roles can have segments now
  }, [watchedEditRole, editForm]);

  const handleCreateSubmit = (data: InsertSalespersonUserInput) => {
    // Limpiar campos según el rol
    const cleanedData = {
      ...data,
      supervisorId: data.role === "salesperson" && data.supervisorId !== "none" ? data.supervisorId : null,
      assignedSegment: data.assignedSegment && data.assignedSegment !== "none" ? data.assignedSegment : null
    };
    console.log("Enviando datos:", cleanedData);
    createUserMutation.mutate(cleanedData);
  };

  const handleEditSubmit = (data: InsertSalespersonUserInput) => {
    if (!editingUser) return;
    // Limpiar campos según el rol
    const cleanedData = {
      ...data,
      supervisorId: data.role === "salesperson" && data.supervisorId !== "none" ? data.supervisorId : null,
      assignedSegment: data.assignedSegment && data.assignedSegment !== "none" ? data.assignedSegment : null
    };
    
    // Filtrar contraseñas vacías para evitar sobrescribir contraseñas existentes
    if (!data.password || data.password.trim() === "") {
      delete cleanedData.password;
    }
    
    console.log("Editando datos:", cleanedData);
    updateUserMutation.mutate({ id: editingUser.id, userData: cleanedData });
  };

  const handleEdit = (user: SalespersonUser) => {
    setEditingUser(user);
    editForm.reset({
      salespersonName: user.salespersonName,
      username: user.username ?? "",
      email: user.email ?? "",
      password: "", // No mostrar la contraseña actual
      isActive: user.isActive ?? true,
      role: (user.role ?? "salesperson") as "admin" | "supervisor" | "salesperson" | "tecnico_obra" | "client",
      supervisorId: user.supervisorId ?? "none",
      assignedSegment: user.assignedSegment ?? "none",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      deleteUserMutation.mutate(id);
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
    return null; // No renderizar nada si no es admin o supervisor
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Modern Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Users className="h-7 w-7 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
                <p className="text-slate-300 text-sm md:text-base mt-1">
                  Administra las cuentas de acceso y permisos del sistema
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-user" className="bg-indigo-600 hover:bg-indigo-700 border-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                    <DialogDescription>
                      Crea una cuenta de acceso para un vendedor del sistema
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rol de Usuario</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? "salesperson"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-role">
                                  <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="salesperson">Vendedor</SelectItem>
                                <SelectItem value="tecnico_obra">Técnico de Obra</SelectItem>
                                <SelectItem value="jefe_planta">Jefe de Planta</SelectItem>
                                <SelectItem value="mantencion">Mantención</SelectItem>
                                <SelectItem value="laboratorio">Laboratorio</SelectItem>
                                <SelectItem value="produccion">Producción</SelectItem>
                                <SelectItem value="logistica_bodega">Logística y Bodega</SelectItem>
                                <SelectItem value="planificacion">Planificación</SelectItem>
                                <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                                <SelectItem value="prevencion_riesgos">Prevención de Riesgos</SelectItem>
                            <SelectItem value="recursos_humanos">Recursos Humanos</SelectItem>
                            <SelectItem value="client">Cliente</SelectItem>
                            <SelectItem value="reception">Recepción</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Campo de nombre para todos los roles excepto cliente */}
                  {createForm.watch("role") !== "client" && (
                    <FormField
                      control={createForm.control}
                      name="salespersonName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Ingresa el nombre completo"
                              data-testid="input-user-name"
                            />
                          </FormControl>
                          <FormDescription>
                            Nombre de la persona que usará este usuario
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Campos específicos para vendedores */}
                  {createForm.watch("role") === "salesperson" && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <h4 className="font-medium text-blue-900">Configuración de Vendedor</h4>
                      </div>
                      
                      {availableSalespeople.filter(sp => !salespeopleUsers.some(user => user.salespersonName === sp)).length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          <p className="mb-1">O selecciona de vendedores con ventas registradas:</p>
                          <Select 
                            onValueChange={(value) => createForm.setValue("salespersonName", value)} 
                            value={availableSalespeople.includes(createForm.watch("salespersonName") || '') ? createForm.watch("salespersonName") : ''}
                          >
                            <SelectTrigger data-testid="select-salesperson-name" className="bg-white">
                              <SelectValue placeholder="Seleccionar de la lista" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSalespeople
                                .filter(sp => !salespeopleUsers.some(user => user.salespersonName === sp))
                                .map((salesperson) => (
                                  <SelectItem key={salesperson} value={salesperson}>
                                    {salesperson}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <FormField
                        control={createForm.control}
                        name="supervisorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supervisor Asignado</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-supervisor">
                                  <SelectValue placeholder="Selecciona un supervisor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Sin supervisor</SelectItem>
                                {availableSupervisors.map((supervisor) => (
                                  <SelectItem key={supervisor.id} value={supervisor.id}>
                                    {supervisor.salespersonName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  
                  {/* Buscador de Clientes */}
                  {createForm.watch("role") === "client" && (
                    <FormField
                      control={createForm.control}
                      name="salespersonName"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Seleccionar Cliente</FormLabel>
                          <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  data-testid="select-client-name"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? availableClients.find(
                                        (client) => client === field.value
                                      )
                                    : "Buscar cliente..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar cliente..." />
                                <CommandList>
                                  <CommandEmpty>No se encontró ningún cliente.</CommandEmpty>
                                  <CommandGroup>
                                    {availableClients
                                      .filter(client => !salespeopleUsers.some(user => user.salespersonName === client))
                                      .map((client) => (
                                        <CommandItem
                                          value={client}
                                          key={client}
                                          onSelect={() => {
                                            field.onChange(client);
                                            setClientSearchOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              client === field.value
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                          />
                                          {client}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Campo de texto para roles que no requieren selección de lista */}
                  {(createForm.watch("role") === "admin" || 
                    createForm.watch("role") === "supervisor" || 
                    createForm.watch("role") === "tecnico_obra" || 
                    createForm.watch("role") === "laboratorio" || 
                    createForm.watch("role") === "produccion" ||
                    createForm.watch("role") === "logistica_bodega" ||
                    createForm.watch("role") === "planificacion" ||
                    createForm.watch("role") === "bodega_materias_primas" ||
                    createForm.watch("role") === "prevencion_riesgos" ||
                    createForm.watch("role") === "reception") && (
                    <FormField
                      control={createForm.control}
                      name="salespersonName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              data-testid="input-user-name" 
                              placeholder="Ingresa el nombre completo" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {shouldShowSegmentField(watchedRole) && (
                    <FormField
                      control={createForm.control}
                      name="assignedSegment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Segmento Asignado</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-assigned-segment">
                                <SelectValue placeholder="Selecciona un segmento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sin segmento</SelectItem>
                              {availableSegments.map((segment) => (
                                <SelectItem key={segment} value={segment}>
                                  {segment}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={createForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de Usuario</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-username" placeholder="Se genera automáticamente" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (opcional)</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña (opcional)</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} data-testid="input-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Usuario Activo</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            El usuario puede acceder al sistema
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                            data-testid="switch-is-active"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-create">
                      {createUserMutation.isPending ? "Creando..." : "Crear Usuario"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
            </div>
          </div>
        </div>


      {/* Dialog de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica la información del usuario seleccionado
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="salespersonName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-salesperson-name" readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Usuario</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-edit-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva Contraseña (dejar vacío para no cambiar)</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-edit-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "salesperson"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-role">
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="salesperson">Vendedor</SelectItem>
                        <SelectItem value="tecnico_obra">Técnico de Obra</SelectItem>
                        <SelectItem value="jefe_planta">Jefe de Planta</SelectItem>
                        <SelectItem value="mantencion">Mantención</SelectItem>
                        <SelectItem value="laboratorio">Laboratorio</SelectItem>
                        <SelectItem value="produccion">Producción</SelectItem>
                        <SelectItem value="logistica_bodega">Logística y Bodega</SelectItem>
                        <SelectItem value="planificacion">Planificación</SelectItem>
                        <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                        <SelectItem value="prevencion_riesgos">Prevención de Riesgos</SelectItem>
                        <SelectItem value="recursos_humanos">Recursos Humanos</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="reception">Recepción</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editForm.watch("role") === "salesperson" && (
                <FormField
                  control={editForm.control}
                  name="supervisorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supervisor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-supervisor">
                            <SelectValue placeholder="Selecciona un supervisor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin supervisor</SelectItem>
                          {availableSupervisors.map((supervisor) => (
                            <SelectItem key={supervisor.id} value={supervisor.id}>
                              {supervisor.salespersonName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {shouldShowSegmentField(watchedEditRole) && (
                <FormField
                  control={editForm.control}
                  name="assignedSegment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segmento Asignado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-assigned-segment">
                            <SelectValue placeholder="Selecciona un segmento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin segmento</SelectItem>
                          {availableSegments.map((segment) => (
                            <SelectItem key={segment} value={segment}>
                              {segment}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Usuario Activo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        El usuario puede acceder al sistema
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-submit-edit">
                  {updateUserMutation.isPending ? "Actualizando..." : "Actualizar Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

        {/* Filters and Summary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-sm sm:text-base">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-indigo-600" />
                  Filtros de Usuario
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="flex-1">
                    <label className="text-xs sm:text-sm font-medium mb-2 block text-muted-foreground">Filtrar por rol</label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="bg-muted/30 border-muted focus:ring-indigo-500">
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los roles ({salespeopleUsers.length})</SelectItem>
                        <SelectItem value="admin">
                          Administradores ({salespeopleUsers.filter(u => u.role === 'admin').length})
                        </SelectItem>
                        <SelectItem value="supervisor">
                          Supervisores ({salespeopleUsers.filter(u => u.role === 'supervisor').length})
                        </SelectItem>
                        <SelectItem value="salesperson">
                          Vendedores ({salespeopleUsers.filter(u => u.role === 'salesperson').length})
                        </SelectItem>
                        <SelectItem value="tecnico_obra">
                          Técnicos de Obra ({salespeopleUsers.filter(u => u.role === 'tecnico_obra').length})
                        </SelectItem>
                        <SelectItem value="laboratorio">
                          Laboratorio ({salespeopleUsers.filter(u => u.role === 'laboratorio').length})
                        </SelectItem>
                        <SelectItem value="produccion">
                          Producción ({salespeopleUsers.filter(u => u.role === 'produccion').length})
                        </SelectItem>
                        <SelectItem value="logistica_bodega">
                          Logística y Bodega ({salespeopleUsers.filter(u => u.role === 'logistica_bodega').length})
                        </SelectItem>
                        <SelectItem value="planificacion">
                          Planificación ({salespeopleUsers.filter(u => u.role === 'planificacion').length})
                        </SelectItem>
                        <SelectItem value="bodega_materias_primas">
                          Bodega Materias Primas ({salespeopleUsers.filter(u => u.role === 'bodega_materias_primas').length})
                        </SelectItem>
                        <SelectItem value="prevencion_riesgos">
                          Prevención de Riesgos ({salespeopleUsers.filter(u => u.role === 'prevencion_riesgos').length})
                        </SelectItem>
                        <SelectItem value="client">
                          Clientes ({salespeopleUsers.filter(u => u.role === 'client').length})
                        </SelectItem>
                        <SelectItem value="reception">
                          Recepción ({salespeopleUsers.filter(u => u.role === 'reception').length})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/50 dark:to-indigo-900/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  Resumen
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total usuarios:</span>
                    <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{salespeopleUsers.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-green-50/50 dark:bg-green-950/30">
                    <span className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">Activos:</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-300">{salespeopleUsers.filter(u => u.isActive).length}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-red-50/50 dark:bg-red-950/30">
                    <span className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-400">Inactivos:</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-300">{salespeopleUsers.filter(u => !u.isActive).length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Users Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                Lista de Usuarios
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Gestiona los usuarios y sus permisos de acceso
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              {filteredUsers.length} usuarios
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <span className="text-muted-foreground text-sm">Cargando usuarios...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block rounded-lg overflow-hidden border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Nombre</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Usuario</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Rol</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Supervisor</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Segmento</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Estado</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-medium">{user.salespersonName}</TableCell>
                        <TableCell className="text-muted-foreground">{user.username || "Sin usuario"}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email || "Sin email"}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : user.role === 'supervisor' ? 'default' : 'secondary'} className={user.role === 'admin' || user.role === 'supervisor' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
                            {user.role === 'admin' ? 'Administrador' : 
                             user.role === 'supervisor' ? 'Supervisor' :
                             user.role === 'tecnico_obra' ? 'Técnico de Obra' :
                             user.role === 'jefe_planta' ? 'Jefe de Planta' :
                             user.role === 'mantencion' ? 'Mantención' :
                             user.role === 'laboratorio' ? 'Laboratorio' :
                             user.role === 'produccion' ? 'Producción' :
                             user.role === 'logistica_bodega' ? 'Logística y Bodega' :
                             user.role === 'planificacion' ? 'Planificación' :
                             user.role === 'bodega_materias_primas' ? 'Bodega Materias Primas' :
                             user.role === 'prevencion_riesgos' ? 'Prevención de Riesgos' :
                             user.role === 'recursos_humanos' ? 'Recursos Humanos' :
                             user.role === 'client' ? 'Cliente' : 
                             user.role === 'reception' ? 'Recepción' : 'Vendedor'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{getSupervisorName(user.supervisorId)}</TableCell>
                        <TableCell>
                          {user.assignedSegment ? (
                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                              {user.assignedSegment}
                            </span>
                          ) : (
                            <div>
                              <span className="text-blue-600 font-medium text-xs">Sin asignar</span>
                              {segmentsData[0] && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Sugerencia: {segmentsData[0].segment}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'destructive'} className={user.isActive ? 'bg-green-600 hover:bg-green-700' : ''}>
                            {user.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              data-testid={`button-edit-${user.id}`}
                              className="h-8 w-8 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              data-testid={`button-delete-${user.id}`}
                              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 text-muted-foreground"
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
              
              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{user.salespersonName}</h3>
                            <p className="text-xs text-muted-foreground">{user.username || "Sin usuario"}</p>
                          </div>
                          <div className="flex items-center space-x-2 ml-2">
                            <Badge variant={user.isActive ? 'default' : 'destructive'} className="text-xs">
                              {user.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Email:</span>
                            <p className="font-medium truncate">{user.email || "Sin email"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rol:</span>
                            <div className="mt-1">
                              <Badge variant={user.role === 'admin' || user.role === 'supervisor' ? 'default' : 'secondary'} className="text-xs">
                                {user.role === 'admin' ? 'Admin' : 
                                 user.role === 'supervisor' ? 'Supervisor' :
                                 user.role === 'tecnico_obra' ? 'Técnico' :
                                 user.role === 'jefe_planta' ? 'Jefe Planta' :
                                 user.role === 'mantencion' ? 'Mantención' :
                                 user.role === 'laboratorio' ? 'Laboratorio' :
                                 user.role === 'produccion' ? 'Producción' :
                                 user.role === 'logistica_bodega' ? 'Logística y Bodega' :
                                 user.role === 'planificacion' ? 'Planificación' :
                                 user.role === 'bodega_materias_primas' ? 'Bodega MP' :
                                 user.role === 'prevencion_riesgos' ? 'Prev. Riesgos' :
                                 user.role === 'client' ? 'Cliente' : 
                                 user.role === 'reception' ? 'Recepción' : 'Vendedor'}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Supervisor:</span>
                            <p className="font-medium text-xs">{getSupervisorName(user.supervisorId)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Segmento:</span>
                            <p className={`font-medium text-xs ${!user.assignedSegment ? "text-blue-600" : ""}`}>
                              {getSegmentSuggestion(user.assignedSegment)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex justify-end space-x-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                            data-testid={`button-edit-${user.id}`}
                            className="text-xs px-2 py-1"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            data-testid={`button-delete-${user.id}`}
                            className="text-xs px-2 py-1"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}