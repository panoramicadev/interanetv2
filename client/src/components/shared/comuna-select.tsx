/**
 * Selector de comuna de Chile — único control para capturar comuna en toda la app.
 *
 * Es un combobox sobre el catálogo canónico (@shared/chile-geo): 346 comunas
 * buscables, agrupadas por región. Reemplaza los inputs de texto libre que
 * había en el alta y el detalle del CRM y en "Dónde Comprar", que dejaban
 * entrar "las condes", "LAS CONDES" y "Las  Condes" como tres valores
 * distintos.
 *
 * La región NO se pide por separado: se deriva de la comuna elegida y se
 * muestra como texto. Ese es el invariante — la comuna es el dato, la región
 * es una consecuencia.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  COMUNAS_CHILE, REGIONES_CHILE, normalizeGeoKey, regionDeComuna, resolveComuna,
} from "@shared/chile-geo";

interface ComunaSelectProps {
  /** Id del trigger, para que un <Label htmlFor> lo alcance. */
  id?: string;
  /** Comuna actual. Se resuelve contra el catálogo, así que acepta valores históricos sucios. */
  value?: string | null;
  /** Recibe el nombre canónico, o `null` si se limpió la selección. */
  onChange: (comuna: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function ComunaSelect({
  id,
  value,
  onChange,
  placeholder = "Seleccionar comuna...",
  disabled,
  className,
  "data-testid": testId,
}: ComunaSelectProps) {
  const [open, setOpen] = useState(false);

  const comunaActual = resolveComuna(value);
  const region = comunaActual ? regionDeComuna(comunaActual.nombre) : null;

  const porRegion = useMemo(
    () => REGIONES_CHILE.map((r) => ({
      region: r,
      comunas: COMUNAS_CHILE.filter((c) => c.regionCodigo === r.codigo),
    })),
    []
  );

  return (
    <div className={cn("space-y-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
            data-testid={testId}
          >
            <span className={cn("truncate", !comunaActual && "text-muted-foreground")}>
              {comunaActual?.nombre ?? (value?.trim() || placeholder)}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            // Buscar sin tildes ni mayúsculas: "nunoa" tiene que encontrar "Ñuñoa".
            filter={(itemValue, search) =>
              normalizeGeoKey(itemValue).includes(normalizeGeoKey(search)) ? 1 : 0
            }
          >
            <CommandInput placeholder="Buscar comuna..." />
            <CommandList>
              <CommandEmpty>No hay ninguna comuna con ese nombre.</CommandEmpty>
              {value ? (
                <CommandGroup>
                  <CommandItem
                    value="__limpiar__"
                    onSelect={() => { onChange(null); setOpen(false); }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Sin comuna
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {porRegion.map(({ region: r, comunas }) => (
                <CommandGroup key={r.codigo} heading={r.nombreCorto}>
                  {comunas.map((c) => (
                    <CommandItem
                      key={c.nombre}
                      value={c.nombre}
                      onSelect={() => { onChange(c.nombre); setOpen(false); }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          comunaActual?.nombre === c.nombre ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {c.nombre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {region ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {region.nombre}
        </p>
      ) : value?.trim() ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          "{value.trim()}" no es una comuna de Chile — elegí una de la lista para que
          quede clasificada por región.
        </p>
      ) : null}
    </div>
  );
}
