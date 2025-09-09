import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSalespersonUserSchema, type InsertSalespersonUserInput, type SalespersonUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SalespersonUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("todos");

  // Verificar permisos de admin
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden acceder a esta página.",
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
    enabled: user?.role === 'admin',
  });

  // Filtrar usuarios según el filtro seleccionado
  const filteredUsers = salespeopleUsers.filter((userData) => {
    if (roleFilter === "todos") return true;
    return userData.role === roleFilter;
  });

  // Query para obtener vendedores disponibles
  const { data: availableSalespeople = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
    enabled: user?.role === 'admin',
  });

  // Query para obtener supervisores disponibles
  const { data: availableSupervisors = [] } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople/supervisors"],
    enabled: user?.role === 'admin',
  });

  // Query para obtener clientes disponibles
  const { data: availableClients = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/clients"],
    enabled: user?.role === 'admin',
  });

  // Mutation para crear usuario
  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertSalespersonUserInput) => {
      return await apiRequest("POST", "/api/users/salespeople", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Usuario creado",
        description: "El usuario se ha creado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario.",
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
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast({
        title: "Usuario actualizado",
        description: "El usuario se ha actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario.",
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

  // Clear fields when role changes
  useEffect(() => {
    if (watchedRole !== "salesperson") {
      createForm.setValue("supervisorId", null);
    }
    if (watchedRole !== "supervisor") {
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
    if (watchedEditRole !== "supervisor") {
      editForm.setValue("assignedSegment", null);
    }
  }, [watchedEditRole, editForm]);

  const handleCreateSubmit = (data: InsertSalespersonUserInput) => {
    // Limpiar campos según el rol
    const cleanedData = {
      ...data,
      supervisorId: data.role === "salesperson" && data.supervisorId !== "none" ? data.supervisorId : null,
      assignedSegment: data.role === "supervisor" && data.assignedSegment && data.assignedSegment !== "none" ? data.assignedSegment : null
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
      assignedSegment: data.role === "supervisor" && data.assignedSegment && data.assignedSegment !== "none" ? data.assignedSegment : null
    };
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
      role: (user.role ?? "salesperson") as "admin" | "supervisor" | "salesperson" | "client",
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

  if (user?.role !== 'admin') {
    return null; // No renderizar nada si no es admin
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            Administra las cuentas de acceso de los vendedores al sistema
          </p>
        </div>
        <div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
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
                            <SelectItem value="client">Cliente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Dropdown para Vendedores */}
                  {createForm.watch("role") === "salesperson" && (
                    <FormField
                      control={createForm.control}
                      name="salespersonName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seleccionar Vendedor</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-salesperson-name">
                                <SelectValue placeholder="Selecciona un vendedor" />
                              </SelectTrigger>
                            </FormControl>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Dropdown para Clientes */}
                  {createForm.watch("role") === "client" && (
                    <FormField
                      control={createForm.control}
                      name="salespersonName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seleccionar Cliente</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-client-name">
                                <SelectValue placeholder="Selecciona un cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableClients
                                .filter(client => !salespeopleUsers.some(user => user.salespersonName === client))
                                .map((client) => (
                                  <SelectItem key={client} value={client}>
                                    {client}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {/* Campo de texto para Administradores y Supervisores */}
                  {(createForm.watch("role") === "admin" || createForm.watch("role") === "supervisor") && (
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

                  {createForm.watch("role") === "supervisor" && (
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
                              <SelectItem value="CONSTRUCCION">CONSTRUCCION</SelectItem>
                              <SelectItem value="DIGITAL">DIGITAL</SelectItem>
                              <SelectItem value="FERRETERIAS">FERRETERIAS</SelectItem>
                              <SelectItem value="MCT">MCT</SelectItem>
                              <SelectItem value="PANORAMICA STORE">PANORAMICA STORE</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {createForm.watch("role") === "salesperson" && (
                    <FormField
                      control={createForm.control}
                      name="supervisorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supervisor</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
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
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rol</FormLabel>
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
                            <SelectItem value="client">Cliente</SelectItem>
                          </SelectContent>
                        </Select>
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


      {/* Dialog de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
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
                    <FormLabel>Nombre del Vendedor</FormLabel>
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
                        <SelectItem value="client">Cliente</SelectItem>
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

              {editForm.watch("role") === "supervisor" && (
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
                          <SelectItem value="CONSTRUCCION">CONSTRUCCION</SelectItem>
                          <SelectItem value="DIGITAL">DIGITAL</SelectItem>
                          <SelectItem value="FERRETERIAS">FERRETERIAS</SelectItem>
                          <SelectItem value="MCT">MCT</SelectItem>
                          <SelectItem value="PANORAMICA STORE">PANORAMICA STORE</SelectItem>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Filtros de Usuario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Filtrar por rol</label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger>
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
                        <SelectItem value="client">
                          Clientes ({salespeopleUsers.filter(u => u.role === 'client').length})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total usuarios:</span>
                    <Badge variant="outline">{salespeopleUsers.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Usuarios activos:</span>
                    <Badge variant="default">{salespeopleUsers.filter(u => u.isActive).length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Usuarios inactivos:</span>
                    <Badge variant="destructive">{salespeopleUsers.filter(u => !u.isActive).length}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            Gestiona los usuarios y sus permisos de acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <span className="text-muted-foreground">Cargando usuarios...</span>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.salespersonName}</TableCell>
                      <TableCell>{user.username || "Sin usuario"}</TableCell>
                      <TableCell>{user.email || "Sin email"}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' || user.role === 'supervisor' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? 'Administrador' : 
                           user.role === 'supervisor' ? 'Supervisor' :
                           user.role === 'client' ? 'Cliente' : 'Vendedor'}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.supervisorId || "Sin supervisor"}</TableCell>
                      <TableCell>{user.assignedSegment || "Sin segmento"}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            data-testid={`button-delete-${user.id}`}
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
  );
}