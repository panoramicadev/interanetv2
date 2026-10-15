# Venta por unidad (venta al detalle)

**Desde oct-2026 el cotizador web público vende por unidad.** El resto del
sistema sigue vendiendo por bulto:

| Formato     | Bulto (interno)      | Cotizador web   |
|-------------|----------------------|-----------------|
| ¼ de galón  | mínimo 6, de a 6     | desde 1, de a 1 |
| Galón       | mínimo 4, de a 4     | desde 1, de a 1 |
| Balde 4/5 GL| mínimo 1, de a 1     | desde 1, de a 1 |

- **Por unidad:** cotizador B2C público (`/cotizador` y `/catalogo`). Ahí la
  cantidad además se puede **escribir**, no solo ajustar con + y −.
- **Por bulto:** tienda B2B, tomador de pedidos, carrito, pedido sugerido,
  lectura de OC en PDF, ficha pública de producto y catálogos compartidos
  (`/catalogo/:slug`).

> Historia: la primera versión (PR #481) pasó todo el sistema a venta por
> unidad. Se acotó al cotizador web porque el interno y el tomador de pedidos
> deben seguir por bulto.

## Cómo está hecho

Dos interruptores en `shared/venta-por-unidad.ts`:

```ts
export const VENTA_POR_UNIDAD = false;              // interno
export const VENTA_POR_UNIDAD_COTIZADOR_WEB = true; // cotizador web público
```

**No se borró ninguna configuración de bulto.** Sigue intacta en:

- `PRODUCT_FORMATS` en `shared/format-utils.ts` (galón = 4, ¼ = 6).
- `CART_CONFIG.QUANTITY_RULES` en `shared/schema.ts`.
- Las columnas `min_unit` y `step_size` de `ecommerce_products` (se siguen
  importando desde el CSV del catálogo igual que antes).

### `VENTA_POR_UNIDAD_COTIZADOR_WEB` (encendido)

| Dónde | Qué hace |
|---|---|
| `reglaDeVentaCotizadorWeb()` en `server/services/catalog.service.ts` (`/api/b2c/catalog`) | Entrega `minUnit: 1, stepSize: 1` al cotizador. |
| Cotización B2C (`server/routes-b2c.ts`) | No rechaza con `INVALID_QUANTITY` las cantidades que no son múltiplo del bulto. |
| `QuoteContext.tsx` | La lista de cotización guardada en el navegador se recalcula con la regla vigente al cargar. |
| `CotizadorProductCard/Detail/QuotePanel.tsx` y `ProductCardExpandable.tsx` en modo `cotizador` | La cantidad se puede escribir. |

### `VENTA_POR_UNIDAD` (apagado)

| Dónde | Qué hace si se enciende |
|---|---|
| `shared/format-utils.ts` → `getFormatQuantityRules` | Devuelve 1 y de a 1 para cualquier formato. De aquí leen el carrito, la tienda, el tomador de pedidos, el pedido sugerido y `MultiColorProductCard`. |
| `reglaDeVenta()` en `server/routes.ts` (producto por slug, `/api/public/catalogos/:slug`, `/api/products/grouped-catalog`, `/api/store/groups`, `/api/store/products/sku-lookup`) y `server/storage.ts` | Entrega `minUnit: 1, stepSize: 1` a las pantallas. |
| `POST /api/public/catalogos/:slug/cotizacion` (`server/routes.ts`) | Deja de validar el bulto. |
| `server/oc-parser.ts` | Al leer una OC ya no sube la cantidad al múltiplo del bulto. |
| `CartPageItem.tsx` | Al cambiar el envase no ajusta la cantidad a 4 o 6. |
| `CartContext.tsx` | El carrito guardado se recalcula con la regla vigente al cargar. |
| `ProductCardExpandable.tsx` en modo `store`, `public-catalog-products.tsx` | La cantidad se puede escribir. |
| Preguntas frecuentes de la tienda (`client/src/pages/tienda.tsx`) | Muestra el texto de venta por unidad. |

**Lo que no depende de estos interruptores:**

- **Venta por pallet** (`addPalletToCart` en `tienda.tsx`): régimen comercial
  aparte, con su propia cantidad y descuento.
- **Colores a pedido / tintometría** (`CustomColorRequestModal.tsx`,
  `custom-color.service.ts`): el mínimo de 20 galones / tinetas es de
  producción, no de bulto.

## Cómo cambiar el modo

Cambiar el interruptor que corresponda en `shared/venta-por-unidad.ts` y
desplegar. No hay migraciones ni datos que tocar.

**Un detalle al volver a bulto en el cotizador:** una lista de cotización B2C
armada en el navegador durante la venta por unidad queda con "de a 1" hasta que
se vacíe (se guarda sin el formato del bulto). El servidor igual valida el
bulto al enviarla, así que no puede entrar una cotización inválida; solo se ve
el aviso al enviar.
