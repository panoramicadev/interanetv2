import { Truck, Clock, MapPin, Phone, Mail, MessageCircle } from 'lucide-react';

interface Props {
  config?: {
    siteName?: string;
    contactInfo?: { phone?: string; email?: string; whatsapp?: string } | null;
  };
}

const LINKS = [
  { href: '/', label: 'Catálogo' },
  { href: '/donde-comprar', label: 'Dónde comprar' },
  { href: '/seguimiento', label: 'Seguir mi pedido' },
];

export default function CotizadorFooter({ config }: Props) {
  const contacto = config?.contactInfo;
  const whatsapp = contacto?.whatsapp?.replace(/\D/g, '');

  return (
    <footer className="bg-slate-950 text-slate-400 mt-16">
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <img src="/panoramica-logo-white.png" alt={config?.siteName || 'Pinturas Panorámica'} className="h-9 w-auto mb-4" />
            <p className="text-sm leading-relaxed max-w-xs">
              Pinturas, esmaltes, estucos y más, por mayor y al detalle. Cotiza sin compromiso y sin registro.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4">Tienda</h3>
            <ul className="space-y-2.5 text-sm">
              {LINKS.map((l) => (
                <li key={l.href}><a href={l.href} className="hover:text-white transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4">Despacho</h3>
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2"><Truck className="w-4 h-4 text-[#fd6301] flex-shrink-0 mt-0.5" />Envío gratis en Temuco</li>
              <li className="flex gap-2"><Clock className="w-4 h-4 text-[#fd6301] flex-shrink-0 mt-0.5" />Pedidos hasta las 12:00 salen el mismo día</li>
              <li className="flex gap-2"><MapPin className="w-4 h-4 text-[#fd6301] flex-shrink-0 mt-0.5" />A domicilio o a obra</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4">Contacto</h3>
            <ul className="space-y-2.5 text-sm">
              {contacto?.phone && <li><a href={`tel:${contacto.phone}`} className="flex gap-2 hover:text-white transition-colors"><Phone className="w-4 h-4 flex-shrink-0 mt-0.5" />{contacto.phone}</a></li>}
              {contacto?.email && <li><a href={`mailto:${contacto.email}`} className="flex gap-2 hover:text-white transition-colors break-all"><Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />{contacto.email}</a></li>}
              {whatsapp && <li><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex gap-2 hover:text-white transition-colors"><MessageCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />WhatsApp</a></li>}
              <li><a href="/donde-comprar" className="flex gap-2 hover:text-white transition-colors"><MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />Sucursales y distribuidores</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-2 justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {config?.siteName || 'Pinturas Panorámica'}. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
