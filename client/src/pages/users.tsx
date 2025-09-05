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
import { Plus, Edit, Trash2, Users, UserPlus, Building2, Menu, X, LogOut, BarChart3, Settings, Target } from "lucide-react";
import { useLocation, Link } from "wouter";
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
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("todos");

  // Sidebar navigation items
  const sidebarItems = [
    { icon: BarChart3, label: "Dashboard", href: "/" },
    { icon: Users, label: "Gestión de Usuarios", href: "/usuarios" },
    { icon: Target, label: "Gestión de Metas", href: "/metas" },
  ];

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (name?: string) => {
    if (!name) return "A";
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  };

  const getDisplayName = () => {
    return user?.salespersonName || "Administrador";
  };

  // Verificar permisos de admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden acceder a esta página.",
        variant: "destructive",
      });
      window.location.href = '/';
    }
  }, [user, toast]);

  // Query para obtener usuarios
  const { data: salespeopleUsers = [], isLoading } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople"],
    enabled: user?.role === 'admin',
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
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden glass-card p-2"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Panel Admin</h1>
                <p className="text-sm text-slate-400">Gestión del Sistema</p>
              </div>
            </div>
          </div>
        
          <nav className="flex-1 p-4 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                      isActive ? "bg-slate-800 text-white" : ""
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-6 border-t border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {getInitials(user?.salespersonName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {getDisplayName()}
                </p>
                <p className="text-xs text-slate-400">Administrador</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
      
      <div className="lg:ml-64 transition-all duration-300">
        <div className="p-6 space-y-6">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Usuarios del Sistema
              </CardTitle>
              <CardDescription>
                Lista de todos los usuarios con acceso al sistema de análisis de ventas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Filtrar por rol:</span>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40" data-testid="filter-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="supervisor">Supervisores</SelectItem>
                  <SelectItem value="salesperson">Vendedores</SelectItem>
                  <SelectItem value="client">Clientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando usuarios...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salespeopleUsers
                  .filter((user) => {
                    if (roleFilter === "todos") return true;
                    return user.role === roleFilter;
                  })
                  .map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-medium">{user.salespersonName}</TableCell>
                    <TableCell className="font-mono text-sm">{user.username || "-"}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' || user.role === 'supervisor' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Administrador' : 
                         user.role === 'supervisor' ? 'Supervisor' :
                         user.role === 'client' ? 'Cliente' : 'Vendedor'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
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
                {salespeopleUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay usuarios creados. Usa "Nuevo Usuario" para crear cuentas individuales para los vendedores.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
        </div>
      </div>
    </>
  );
}