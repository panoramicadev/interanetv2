const fs = require('fs');
const file = 'client/src/pages/marketing.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`import PresupuestoMarketing from "./marketing/presupuesto-marketing";
import PreciosCompetencia from "./marketing/precios-competencia";
import CalendarioHitos from "./marketing/calendario-hitos";
import TareasMarketing from "./marketing/tareas-marketing";
import CreatividadesMarketing from "@/components/marketing/creatividades-marketing";
import MetricCard from "@/components/metrics/MetricCard";
  id: string;`,
`import PresupuestoMarketing from "./marketing/presupuesto-marketing";
import PreciosCompetencia from "./marketing/precios-competencia";
import CalendarioHitos from "./marketing/calendario-hitos";
import TareasMarketing from "./marketing/tareas-marketing";
import CreatividadesMarketing from "@/components/marketing/creatividades-marketing";
import MetricCard from "@/components/metrics/MetricCard";

interface SolicitudMarketing {
  id: string;`
);

fs.writeFileSync(file, content);
console.log('Fixed interface declaration in marketing.tsx');
