import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, TrendingUp, Target, Award, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SalespersonData {
  id: string;
  salespersonName: string;
  email: string;
  totalSales: number;
  transactionCount: number;
  lastSale: string;
  goals: Array<{
    id: string;
    description: string;
    targetAmount: number;
    currentSales: number;
    remaining: number;
    period: string;
    progress: number;
  }>;
}

export default function MisVendedoresPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Only fetch if user is a supervisor
  const { data: salespeople, isLoading } = useQuery<SalespersonData[]>({
    queryKey: [`/api/supervisor/${user?.id}/salespeople`],
    enabled: !!user && user.role === 'supervisor',
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getProgressLabel = (percentage: number) => {
    if (percentage >= 100) return "Completada";
    if (percentage >= 75) return "Excelente";
    if (percentage >= 50) return "En progreso";
    return "Requiere atención";
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'supervisor') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center space-x-2">
              <Users className="h-6 w-6" />
              <span>Mis Vendedores</span>
            </h1>
            <p className="text-muted-foreground">
              Gestiona tu equipo de vendedores y supervisa su rendimiento
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Vendedores</p>
                  <p className="text-2xl font-bold">{salespeople?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Ventas Totales</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      salespeople?.reduce((sum, sp) => sum + sp.totalSales, 0) || 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Transacciones</p>
                  <p className="text-2xl font-bold">
                    {salespeople?.reduce((sum, sp) => sum + sp.transactionCount, 0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Metas Activas</p>
                  <p className="text-2xl font-bold">
                    {salespeople?.reduce((sum, sp) => sum + sp.goals.length, 0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Salespeople Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Detalle de Vendedores</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            ) : salespeople && salespeople.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ventas Totales</TableHead>
                      <TableHead>Transacciones</TableHead>
                      <TableHead>Última Venta</TableHead>
                      <TableHead>Meta Principal</TableHead>
                      <TableHead>Progreso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salespeople.map((salesperson) => {
                      const primaryGoal = salesperson.goals[0]; // Primera meta (principal)
                      return (
                        <TableRow 
                          key={salesperson.id} 
                          data-testid={`salesperson-row-${salesperson.id}`}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <TableCell className="font-medium">
                            <Link 
                              href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}
                              className="flex items-center space-x-2 hover:text-primary transition-colors"
                            >
                              <span>{salesperson.salespersonName}</span>
                              <ExternalLink className="h-3 w-3 opacity-50" />
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <Link 
                              href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}
                              className="hover:text-primary transition-colors"
                            >
                              {salesperson.email}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link 
                              href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}
                              className="hover:text-primary transition-colors"
                            >
                              <span className="font-semibold">
                                {formatCurrency(salesperson.totalSales)}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link 
                              href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}
                              className="hover:text-primary transition-colors"
                            >
                              <Badge variant="secondary">
                                {salesperson.transactionCount}
                              </Badge>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link 
                              href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}
                              className="hover:text-primary transition-colors"
                            >
                              {salesperson.lastSale ? 
                                new Date(salesperson.lastSale).toLocaleDateString('es-CL') : 
                                '-'
                              }
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link 
                              href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}
                              className="hover:text-primary transition-colors"
                            >
                              {primaryGoal ? (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {formatCurrency(primaryGoal.targetAmount)}
                                  </div>
                                  <div className="text-muted-foreground text-xs">
                                    {primaryGoal.period}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Sin meta</span>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link 
                              href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}
                              className="hover:text-primary transition-colors block"
                            >
                              {primaryGoal ? (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <Badge 
                                      variant={primaryGoal.progress >= 75 ? "default" : "secondary"}
                                    >
                                      {getProgressLabel(primaryGoal.progress)}
                                    </Badge>
                                    <span className="text-sm font-semibold">
                                      {primaryGoal.progress}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(primaryGoal.progress)}`}
                                      style={{ width: `${Math.min(primaryGoal.progress, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tienes vendedores asignados aún</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}