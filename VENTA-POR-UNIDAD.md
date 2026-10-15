# Venta por unidad (venta al detalle)

**Desde oct-2026 la pintura se vende por unidad.** Antes solo se vendía por
bulto:

| Formato     | Antes (bulto)        | Ahora          |
|-------------|----------------------|----------------|
| ¼ de galón  | mínimo 6, de a 6     | desde 1, de a 1 |
| Galón       | mínimo 4, de a 4     | desde 1, de a 1 |
| Balde 4/5 GL| mínimo 1, de a 1     | desde 1, de a 1 |

El cambio aplica a todo el sitio: tienda B2B, cotizador B2C, catálogo público
(`/catalogo/:slug`), carrito, tomador de pedidos, pedido sugerido y la lectura de
OC en PDF. En el cotizador y el catálogo público, además, la cantidad ahora se
puede **escribir**: antes solo se podía ajustar con los botones + y −.

## Cómo está hecho

Todo cuelga de un único interruptor:

```ts
// shared/venta-por-unidad.ts
export const VENTA_POR_UNIDAD = true;
```

**No se borró ninguna configuración de bulto.** Sigue intacta en:

- `PRODUCT_FORMATS` en `shared/format-utils.ts` (galón = 4, ¼ = 6).
- `CART_CONFIG.QUANTITY_RULES` en `shared/schema.ts`.
- Las columnas `min_unit` y `step_size` de `ecommerce_products` (se siguen
  importando desde el CSV del catálogo igual que antes).

El interruptor solo hace que el sistema las ignore. Los puntos donde se consulta:

| Dónde | Qué hace con el interruptor encendido |
|---|---|
| `shared/format-utils.ts` → `getFormatQuantityRules` | Devuelve 1 y de a 1 para cualquier formato. De aquí leen el carrito, la tienda, el tomador de pedidos, el pedido sugerido y `MultiColorProductCard`. |
| `reglaDeVenta()` en el servidor: `server/routes.ts` (producto por slug, `/api/public/catalogos/:slug`, `/api/products/grouped-catalog`, `/api/store/groups`, `/api/store/products/sku-lookup`), `server/services/catalog.service.ts` (`/api/b2c/catalog`), `server/storage.ts` (catálogo público y agrupado) | Entrega `minUnit: 1, stepSize: 1` a las pantallas, aunque la base diga otra cosa. |
| Validación de cotizaciones: `POST /api/public/catalogos/:slug/cotizacion` (`server/routes.ts`) y la cotización B2C (`server/routes-b2c.ts`) | Ya no rechaza con `INVALID_QUANTITY` las cantidades que no son múltiplo del bulto. |
| `server/oc-parser.ts` | Al leer una OC ya no sube la cantidad pedida al múltiplo del bulto. |
| `client/src/components/cart/CartPageItem.tsx` | Al cambiar el envase de un ítem del carrito no ajusta la cantidad a 4 o 6. |
| `CartContext.tsx` / `QuoteContext.tsx` | Los carritos y listas de cotización guardados en el navegador traen la regla con la que se armaron; al cargarlos se recalcula con la regla vigente. |
| `ProductCardExpandable.tsx` (tienda y cotizador), `public-catalog-products.tsx` (catálogo público), `CotizadorProductCard/Detail/QuotePanel.tsx` | La cantidad se puede escribir. Con el interruptor apagado vuelve a ser solo lectura (+/−), con el aviso "Cantidades por bulto". |
| Preguntas frecuentes de la tienda (`client/src/pages/tienda.tsx`) | Muestra el texto de venta por unidad; con el interruptor apagado vuelve el texto anterior. |

**Lo que NO cambió, a propósito:**

- **Venta por pallet** (`addPalletToCart` en `tienda.tsx`): es un régimen
  comercial aparte, con su propia cantidad y descuento.
- **Colores a pedido / tintometría** (`CustomColorRequestModal.tsx`,
  `custom-color.service.ts`): el mínimo de 20 galones / tinetas es de
  producción, no de bulto.
- La carga del catálogo por CSV sigue guardando `min_unit` / `step_size`, así
  que si se revierte, los bultos vuelven con los valores actuales del catálogo.

## Cómo revertir (volver a vender por bulto)

1. En `shared/venta-por-unidad.ts` cambiar a:
   ```ts
   export const VENTA_POR_UNIDAD = false;
   ```
2. Desplegar. No hay migraciones ni datos que tocar.

Con eso vuelven las reglas por formato, las validaciones del servidor y los
selectores de solo lectura.

**Un detalle al revertir:** una lista de cotización B2C que alguien haya armado
en su navegador durante la venta por unidad queda con "de a 1" hasta que vacíe
la lista (se guarda en el navegador sin el formato del bulto). El servidor igual
valida el bulto al enviarla, así que no puede entrar una cotización inválida;
solo verá el aviso al enviar. El carrito B2B no tiene este problema: recalcula
la regla al cargar.

Si se quiere quitar el código del todo en vez de apagarlo, este cambio entró en
la rama `feature/venta-por-unidad`; revertir ese merge deja todo como estaba.
