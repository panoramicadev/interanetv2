import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Search, 
  ExternalLink, 
  User, 
  Phone, 
  Mail, 
  FileText,
  Check,
  X,
  Loader2,
  Link as LinkIcon,
  Eye
} from 'lucide-react';

type SalespersonUser = {
  id: string;
  salespersonName: string;
  email?: string | null;
  role: string;
  isActive: boolean;
  publicSlug?: string | null;
  profileImageUrl?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  bio?: string | null;
  catalogEnabled?: boolean;
};

const catalogFormSchema = z.object({
  publicSlug: z.string()
    .regex(/^[a-z0-9-]+$/, "Slug debe contener solo letras minúsculas, números y guiones")
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres"),
  publicEmail: z.string().email("Email inválido").or(z.literal("")).optional(),
  publicPhone: z.string().optional(),
  bio: z.string().max(500, "Máximo 500 caracteres").optional(),
  catalogEnabled: z.boolean(),
});

type CatalogFormData = z.infer<typeof catalogFormSchema>;

export default function AdminCatalogos() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<SalespersonUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<CatalogFormData>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      publicSlug: '',
      publicEmail: '',
      publicPhone: '',
      bio: '',
      catalogEnabled: false,
    },
  });

  const { data: users = [], isLoading } = useQuery<SalespersonUser[]>({
    queryKey: ['/api/users/salespeople'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CatalogFormData }) => {
      const normalizedData = {
        publicSlug: data.publicSlug,
        catalogEnabled: data.catalogEnabled,
        publicEmail: data.publicEmail?.trim() || null,
        publicPhone: data.publicPhone?.trim() || null,
        bio: data.bio?.trim() || null,
      };
      return await apiRequest(`/api/users/salespeople/${id}`, {
        method: 'PUT',
        data: normalizedData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Catálogo actualizado',
        description: 'La configuración del catálogo se guardó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users/salespeople'] });
      setIsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el catálogo',
      });
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const openEditDialog = (user: SalespersonUser) => {
    setSelectedUser(user);
    form.reset({
      publicSlug: user.publicSlug || generateSlug(user.salespersonName),
      publicEmail: user.publicEmail || user.email || '',
      publicPhone: user.publicPhone || '',
      bio: user.bio || '',
      catalogEnabled: user.catalogEnabled ?? false,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: CatalogFormData) => {
    if (!selectedUser) return;
    updateMutation.mutate({ id: selectedUser.id, data });
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.salespersonName.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.publicSlug?.toLowerCase().includes(search)
    );
  });

  const salespeopleOnly = filteredUsers.filter(u => u.role === 'salesperson' || u.role === 'supervisor');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Catálogos Públicos</h1>
          <p className="text-muted-foreground">
            Configura el catálogo público de cada vendedor
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vendedores</CardTitle>
          <CardDescription>
            Habilita y configura el catálogo público para cada vendedor
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {salespeopleOnly.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No se encontraron vendedores
              </p>
            ) : (
              salespeopleOnly.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{user.salespersonName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {user.publicSlug ? (
                          <span className="flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />
                            /catalogo/{user.publicSlug}
                          </span>
                        ) : (
                          <span className="italic">Sin URL configurada</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {user.catalogEnabled ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <X className="h-3 w-3 mr-1" />
                        Inactivo
                      </Badge>
                    )}

                    {user.catalogEnabled && user.publicSlug && (
                      <a
                        href={`/catalogo/${user.publicSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        data-testid={`link-preview-${user.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                      data-testid={`button-edit-${user.id}`}
                    >
                      Configurar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Catálogo Público</DialogTitle>
            <DialogDescription>
              {selectedUser?.salespersonName}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="catalogEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Catálogo Habilitado</FormLabel>
                      <FormDescription>
                        Activa el catálogo público para este vendedor
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publicSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL del Catálogo</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          /catalogo/
                        </span>
                        <Input
                          {...field}
                          placeholder="nombre-vendedor"
                          data-testid="input-slug"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      URL amigable para compartir (solo letras minúsculas, números y guiones)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publicEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Contacto</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="vendedor@empresa.cl"
                          className="pl-10"
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publicPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono de Contacto</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="+56 9 1234 5678"
                          className="pl-10"
                          data-testid="input-phone"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biografía</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Breve descripción del vendedor..."
                        rows={3}
                        data-testid="input-bio"
                      />
                    </FormControl>
                    <FormDescription>
                      Máximo 500 caracteres
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-save"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
