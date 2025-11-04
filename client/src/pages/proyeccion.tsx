import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, LineChart } from "lucide-react";
import ProyeccionManual from "./proyeccion-manual";
import ProyeccionAutomatica from "./proyeccion-automatica";

export default function ProyeccionPage() {
  const [activeTab, setActiveTab] = useState<string>("manual");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" className="flex items-center space-x-2" data-testid="tab-proyeccion-manual">
            <LineChart className="h-4 w-4" />
            <span>Proyección Manual</span>
          </TabsTrigger>
          <TabsTrigger value="visualizacion" className="flex items-center space-x-2" data-testid="tab-proyeccion-visualizacion">
            <BarChart3 className="h-4 w-4" />
            <span>Visualización</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          <ProyeccionManual />
        </TabsContent>

        <TabsContent value="visualizacion" className="mt-6">
          <ProyeccionAutomatica />
        </TabsContent>
      </Tabs>
    </div>
  );
}
