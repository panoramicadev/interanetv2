import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Eye, MousePointer, DollarSign, Users, Target, AlertTriangle, Link2, RefreshCw } from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { Link } from "wouter";
import type { Integration } from "@shared/schema";

interface MetaInsight {
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  ctr?: string;
  reach?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights?: {
    data?: Array<{
      impressions?: string;
      clicks?: string;
      spend?: string;
      reach?: string;
    }>;
  };
}

const DATE_PRESETS = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "last_7d", label: "Últimos 7 días" },
  { value: "last_14d", label: "Últimos 14 días" },
  { value: "last_30d", label: "Últimos 30 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
];

function formatNumber(value: string | number | undefined): string {
  if (!value) return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("es-CL").format(num);
}

function formatCurrency(value: string | number | undefined): string {
  if (!value) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num * 1000); // Assuming USD to CLP rough conversion
}

function formatPercentage(value: string | number | undefined): string {
  if (!value) return "0%";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `${num.toFixed(2)}%`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-green-100 text-green-800">Activo</Badge>;
    case "PAUSED":
      return <Badge className="bg-yellow-100 text-yellow-800">Pausado</Badge>;
    case "DELETED":
    case "ARCHIVED":
      return <Badge className="bg-gray-100 text-gray-800">Archivado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdsAnalyticsPage() {
  const [datePreset, setDatePreset] = useState("last_30d");

  const { data: integrations, isLoading: loadingIntegrations } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const metaIntegration = integrations?.find(i => i.platform === "meta_ads" && i.status === "active");

  const { data: insightsData, isLoading: loadingInsights, error: insightsError, refetch: refetchInsights } = useQuery<{
    insights: MetaInsight[];
    accountId: string;
    accountName: string;
    lastSync: string;
  }>({
    queryKey: ["/api/meta-ads/insights", datePreset],
    enabled: !!metaIntegration,
    retry: false,
  });

  const { data: campaignsData, isLoading: loadingCampaigns, error: campaignsError } = useQuery<{
    campaigns: MetaCampaign[];
    accountName: string;
  }>({
    queryKey: ["/api/meta-ads/campaigns"],
    enabled: !!metaIntegration,
    retry: false,
  });

  // Handle token expired error
  const isTokenExpired = 
    (insightsError as any)?.message?.includes("expirado") || 
    (campaignsError as any)?.message?.includes("expirado");

  if (loadingIntegrations) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metaIntegration) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-yellow-100 dark:bg-yellow-800/30 rounded-full">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-yellow-800 dark:text-yellow-200">
                No hay integración activa
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1 max-w-md">
                Para ver las métricas de Meta Ads, primero debes conectar tu cuenta de Facebook Ads
                desde la sección de Configuración.
              </p>
            </div>
            <Link href="/configuracion?tab=integraciones">
              <Button className="mt-2">
                <Link2 className="h-4 w-4 mr-2" />
                Ir a Integraciones
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const insight = insightsData?.insights?.[0] || {};

  // Show token expired warning
  if (isTokenExpired) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-red-100 dark:bg-red-800/30 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-red-800 dark:text-red-200">
                Token de Meta expirado
              </h3>
              <p className="text-red-700 dark:text-red-300 mt-1 max-w-md">
                El token de acceso a Meta Ads ha expirado. Necesitas reconectar la integración
                desde la sección de Configuración.
              </p>
            </div>
            <Link href="/configuracion?tab=integraciones">
              <Button className="mt-2" variant="destructive">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconectar Meta Ads
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SiFacebook className="text-blue-600" />
            Meta Ads Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Cuenta: {insightsData?.accountName || metaIntegration.accountName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchInsights()}
            disabled={loadingInsights}
          >
            <RefreshCw className={`h-4 w-4 ${loadingInsights ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loadingInsights ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Impresiones</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(insight.impressions)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Clics</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(insight.clicks)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    CTR: {formatPercentage(insight.ctr)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <MousePointer className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Gasto Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(insight.spend)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    CPC: {formatCurrency(insight.cpc)}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Alcance</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(insight.reach)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Usuarios únicos
                  </p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Campañas
          </CardTitle>
          <CardDescription>
            Rendimiento de tus campañas activas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCampaigns ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : campaignsData?.campaigns && campaignsData.campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Campaña</th>
                    <th className="text-left py-3 px-2 font-medium">Estado</th>
                    <th className="text-left py-3 px-2 font-medium">Objetivo</th>
                    <th className="text-right py-3 px-2 font-medium">Impresiones</th>
                    <th className="text-right py-3 px-2 font-medium">Clics</th>
                    <th className="text-right py-3 px-2 font-medium">Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignsData.campaigns.map((campaign) => {
                    const campaignInsight = campaign.insights?.data?.[0];
                    return (
                      <tr key={campaign.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-2">
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-xs text-gray-500">{campaign.id}</div>
                        </td>
                        <td className="py-3 px-2">{getStatusBadge(campaign.status)}</td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                          {campaign.objective?.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatNumber(campaignInsight?.impressions)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatNumber(campaignInsight?.clicks)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatCurrency(campaignInsight?.spend)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay campañas disponibles
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Sync Info */}
      {insightsData?.lastSync && (
        <p className="text-xs text-gray-500 text-right">
          Última sincronización: {new Date(insightsData.lastSync).toLocaleString("es-CL")}
        </p>
      )}
    </div>
  );
}
