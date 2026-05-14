import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Tag, Truck, CreditCard, Headphones, Star, ShieldCheck, Clock,
  Package, Percent, Zap, Award, Users, Loader2, Check, Rocket,
  ArrowRight, PlayCircle, Phone, Mail,
} from "lucide-react";

const BRAND = "#FF6E23";

interface Beneficio {
  icono: string;
  titulo: string;
  descripcion: string;
}

interface LandingConfig {
  heroBadge: string;
  heroTitulo: string;
  heroSubtitulo: string;
  ctaPrimario: string;
  videoYoutubeUrl: string;
  videoTitulo: string;
  beneficios: Beneficio[];
  formularioTitulo: string;
  formularioSubtitulo: string;
  contactoTelefono: string;
  contactoEmail: string;
}

const ICON_MAP: Record<string, any> = {
  Tag, Truck, CreditCard, Headphones, Star, ShieldCheck, Clock,
  Package, Percent, Zap, Award, Users,
};

function BeneficioIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Star;
  return <Icon className={className} />;
}

function youtubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  return null;
}

const EMPTY_FORM = { empresa: "", rut: "", contacto: "", email: "", telefono: "", ciudad: "" };

export default function Registro() {
  const { data: config } = useQuery<LandingConfig>({
    queryKey: ["/api/panoramica-market/landing"],
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredFilled =
    form.empresa && form.rut && form.contacto && form.email && form.telefono;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiredFilled) {
      setError("Por favor completa todos los campos marcados con *.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ecommerce/account-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("request failed");
      setSuccess(true);
      setForm(EMPTY_FORM);
    } catch {
      setError("Ocurrió un error al enviar la solicitud. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById("registro-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const embedUrl = youtubeEmbedUrl(config?.videoYoutubeUrl || "");
  const beneficios = config?.beneficios?.length ? config.beneficios : [];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <img src="/panoramica-logo.png" alt="Panorámica" className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Iniciar sesión
            </Link>
            <button
              onClick={scrollToForm}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              {config?.ctaPrimario || "Activar mi cuenta"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,110,35,0.12), transparent)",
          }}
        />
        <div className="max-w-6xl mx-auto px-5 pt-16 pb-12 lg:pt-24 lg:pb-20 text-center">
          {config?.heroBadge && (
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-6"
              style={{ backgroundColor: "rgba(255,110,35,0.1)", color: BRAND }}
            >
              <Zap className="h-3.5 w-3.5" />
              {config.heroBadge}
            </span>
          )}
          <h1 className="text-4xl lg:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl mx-auto">
            {config?.heroTitulo || "Compra materiales a precio mayorista"}
          </h1>
          <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto font-medium">
            {config?.heroSubtitulo ||
              "Registra tu empresa y accede a precios exclusivos, despacho a obra y atención personalizada."}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg transition-all hover:opacity-90"
              style={{ backgroundColor: BRAND, boxShadow: "0 10px 25px -5px rgba(255,110,35,0.4)" }}
            >
              <Rocket className="h-4 w-4" />
              {config?.ctaPrimario || "Activar mi cuenta"}
            </button>
            {embedUrl && (
              <a
                href="#video"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:border-slate-300 transition-all"
              >
                <PlayCircle className="h-4 w-4" />
                Ver video
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Video */}
      <section id="video" className="max-w-4xl mx-auto px-5 pb-16 lg:pb-24">
        <div className="text-center mb-6">
          <h2 className="text-2xl lg:text-3xl font-black tracking-tight">
            {config?.videoTitulo || "Conoce Panorámica Market"}
          </h2>
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-2xl ring-1 ring-slate-200">
          {embedUrl ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={embedUrl}
              title={config?.videoTitulo || "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
              <PlayCircle className="h-16 w-16" />
              <p className="text-sm font-medium">Video disponible próximamente</p>
            </div>
          )}
        </div>
      </section>

      {/* Beneficios */}
      {beneficios.length > 0 && (
        <section className="bg-slate-50 border-y border-slate-100">
          <div className="max-w-6xl mx-auto px-5 py-16 lg:py-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-black tracking-tight">
                Beneficios de tu cuenta
              </h2>
              <p className="mt-3 text-slate-500 font-medium">
                Todo lo que obtienes al registrarte en Panorámica Market
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {beneficios.map((b, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white p-6 border border-slate-100 hover:shadow-lg transition-all"
                >
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: "rgba(255,110,35,0.1)" }}
                  >
                    <BeneficioIcon name={b.icono} className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-1.5">{b.titulo}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{b.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Formulario */}
      <section id="registro-form" className="max-w-2xl mx-auto px-5 py-16 lg:py-24">
        {success ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-3">¡Solicitud enviada!</h3>
            <p className="text-slate-500 font-medium mb-6 leading-relaxed">
              Nuestro equipo comercial revisará tus datos y te contactará a la brevedad
              para habilitar tu acceso a Panorámica Market.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Enviar otra solicitud
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl lg:text-4xl font-black tracking-tight">
                {config?.formularioTitulo || "Solicita la activación de tu cuenta"}
              </h2>
              <p className="mt-3 text-slate-500 font-medium">
                {config?.formularioSubtitulo ||
                  "Completa tus datos y nuestro equipo te contactará para habilitar tu acceso."}
              </p>
            </div>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Empresa" required value={form.empresa}
                  onChange={(v) => setForm((p) => ({ ...p, empresa: v }))}
                  placeholder="Constructora ABC" />
                <Field label="RUT" required value={form.rut}
                  onChange={(v) => setForm((p) => ({ ...p, rut: v }))}
                  placeholder="76.123.456-7" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nombre de contacto" required value={form.contacto}
                  onChange={(v) => setForm((p) => ({ ...p, contacto: v }))}
                  placeholder="Juan Pérez" />
                <Field label="Teléfono" required type="tel" value={form.telefono}
                  onChange={(v) => setForm((p) => ({ ...p, telefono: v }))}
                  placeholder="+56 9 1234 5678" />
              </div>
              <Field label="Correo electrónico" required type="email" value={form.email}
                onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                placeholder="contacto@empresa.cl" />
              <Field label="Ciudad" value={form.ciudad}
                onChange={(v) => setForm((p) => ({ ...p, ciudad: v }))}
                placeholder="Santiago" />

              {error && (
                <p className="text-sm font-medium text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !requiredFilled}
                className="w-full py-4 rounded-xl text-white font-black uppercase text-sm tracking-wide transition-all shadow-lg disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={
                  loading || !requiredFilled
                    ? {}
                    : { backgroundColor: BRAND, boxShadow: "0 10px 25px -5px rgba(255,110,35,0.4)" }
                }
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {loading ? "Enviando..." : "Solicitar activación"}
              </button>
              <p className="text-xs text-slate-400 text-center">
                Al enviar aceptas que un ejecutivo se comunique contigo para validar tu cuenta.
              </p>
            </form>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/panoramica-logo.png" alt="Panorámica" className="h-7 w-auto opacity-70" />
          <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500 font-medium">
            {config?.contactoTelefono && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {config.contactoTelefono}
              </span>
            )}
            {config?.contactoEmail && (
              <a
                href={`mailto:${config.contactoEmail}`}
                className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
              >
                <Mail className="h-4 w-4" />
                {config.contactoEmail}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 mb-1.5 block uppercase tracking-wide">
        {label} {required && <span style={{ color: BRAND }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all text-sm"
      />
    </div>
  );
}
