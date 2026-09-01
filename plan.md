# EcoAndes BIO — Plan de Continuación (UI → Blogs → Testing → Catálogo/Precios/IVA → Envíos → Pagos → SEO/GEO → Imágenes → **SEO Manual + Nombres Legacy + Redirecciones** → **UX/Operaciones (Lote 9)** → **Recuperación de Carritos (Lote 10)** → **Lote 11 (Splash + Recetas + Media links + Emails + Hero dots + 2º recordatorio + Links universales)** → **Fase 14 / Lote 12 (Blog Admin + Site Images Admin + Bug carrusel categorías)** → **Fase 15 / Lote 13 (Carrusel Coverflow 3D de categorías)** → **Fase 16 / Lote 14 (Envíos/Pagos/Reembolsos/Registro: v2)** → **Fase 17 / Lote 15 (Carrito estilo Amazon + UX móvil + Mensajes a cliente)** → **Fase 18 / Lote 16 (Recomendados EcoAndes + UX móvil tienda/cartas + logout destacado)** → **Fase 19 / Lote 17 (Envíos retail v3 + verificación dirección + reembolsos WooCommerce + solicitud factura + buscador + menú móvil + paginación tienda)** → **Fase 20 / Lote 18 (Cartas con compra rápida + reseñas sembradas)** → **Fase 21 / Lote 19 (Refinamientos Storefront + Envíos B2B granel + UX móvil + ajustes PDP y cards)**

## 1) Objetivos

### Objetivos ya completados (iteraciones anteriores)
- Modernizar la UI manteniendo identidad de marca (sage/terracotta/bone) con **bordes redondeados** y **micro‑animaciones** sin romper flujos. **(COMPLETADO)**
- Actualizar el **Blog**: 12 posts mantenidos, ahora gestionables desde dashboard con SEO y JSON‑LD Article. **(COMPLETADO)**
- Ejecutar **testing end‑to‑end** para asegurar estabilidad (checkout/cupón/búsqueda/registro/blogs/UI). **(COMPLETADO)**
- **Carrusel categorías Coverflow 3D**: navegación por click + edición admin + descripciones auto/manual. **(COMPLETADO; iteration_21 100%)**
- **Carrito estilo Amazon**: confirmación dentro del drawer + carruseles + “Seguir comprando” + pagos por rol + panel de mensajes al cliente. **(COMPLETADO; iteration_23 100%)**
- **Recomendados por EcoAndes** en Home + UX móvil tienda/cartas + logout destacado. **(COMPLETADO; verificación visual)**
- **Envíos retail v3 + verificación dirección + reembolsos WooCommerce + solicitar factura + buscador + menú móvil + paginación tienda**. **(COMPLETADO; iteration_24 backend 100% 13/13; issue LOW confirmado como falso negativo)**
- **Cartas con compra rápida + reseñas sembradas** (formatos/precios en tarjetas, quick‑buy, estrellas, reseñas). **(COMPLETADO; iteration_26 retest 100%)**

### Objetivos del scope mayor (estado actual)
- **Fase 1 (P0): Catálogo + Precios + IVA (Excel‑driven)**
  - **Estado:** **COMPLETADO**.
- **Fase 2 (P0): Motor de envíos (V1/V2/V3)** por tipo de usuario + zona + peso.
  - **Estado:** **COMPLETADO (V3)** + validado (shipping_config version=3).
  - **Refinamiento B2B “granel” (formatos >1kg)**: **COMPLETADO** en Fase 21 (ver más abajo).
- **Fase 3 (P1): Métodos de pago (V1/V2)** por rol (sin contrareembolso) + scaffolding.
  - **Estado:** **COMPLETADO (V2)**.
  - **Operativa real (pendiente de credenciales/dominio):**
    - PayPal sandbox sin credenciales.
    - Resend restringido hasta verificar dominio (solo permite envíos con dominio verificado).
- **Fase 4 (P1): SEO + GEO** multi‑idioma.
  - **Estado:** **EN PROGRESO** (infra completada; pendiente spot-check y cierre).
- **Fase 5 (P1): Migración P0 de imágenes** a almacenamiento propio (WebP + resize + caché 1 año).
  - **Estado:** **PENDIENTE**.
- **Fase 6 (P0/P1): SEO Manual + Nombres Legacy + Redirecciones**
  - **Estado:** **COMPLETADO**.

### Objetivos actuales (último lote solicitado por el usuario)
> **Fase 21 / Lote 19: Refinamientos Storefront + Envíos B2B granel + UX móvil + ajustes PDP y cards**

**Estado global:** **COMPLETADO (agent-tested; iteration_27 + iteration_28) — pendiente confirmación del usuario**.

Entregables del lote (completados):
1) **Envío B2B con regla de granel (>1kg)**
   - Profesionales **<150€ base imponible**: portes según tabla por kg **sobre todo el pedido** (sin cambios).
   - Profesionales **≥150€ base imponible**: envío gratis **excepto** formatos **>1kg** (considerados “a granel”):
     - se cobra transporte **solo** por el peso total de los ítems granel (>1kg),
     - el resto de ítems (≤1kg) llevan portes gratuitos.
2) **PDP (ProductDetail) móvil: reordenar el contenido (solo orden, sin rediseño)**
   - orden (móvil): **categoría + nombre** → **estrellas** → **descripción (highlights)** → **imagen/galería** → **precio** → **formatos** → **resto**.
   - escritorio: mantiene el layout original (galería izq, info dcha).
3) **PDP (ProductDetail): categorías más estéticas**
   - Sección “Explora más categorías” convertida en **desplegable/colapsable** (web y móvil), manteniendo chips.
4) **Móvil: barra inferior fija con iconos**
   - Barra fija con iconos: **Menú**, **Inicio**, **Acceder/Cuenta** (botón central elevado), **Favoritos** (badge), **Carrito** (badge).
   - Fondo igual al AnnouncementBar (`bg-sage-800`).
   - Header móvil liberado: **se quita personita y carrito del header en móvil**.
5) **Cartas de producto (toda la tienda): mejoras solicitadas**
   - Se mantiene el layout móvil **horizontal** (imagen izquierda; info derecha) y el de escritorio vertical.
   - **Formatos** en píldoras con **formato arriba y precio abajo** (más estético).
   - **Selector de cantidad** (stepper -/+) en **todas** las tarjetas de producto.
   - **Importante:** **NO** mostrar descripción ni categoría en las tarjetas (incluida /tienda).
6) **Texto carrito**
   - “EXPLORAR MÁS ARTICULOS” → **“EXPLORAR MÁS PRODUCTOS”** (y equivalentes en EN/FR/IT/PT).

---

## 2) Pasos de Implementación

### Fase 1 — POC (Core UI Modernization) — **COMPLETADO**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 2 — Desarrollo V1 (UI Modernization completa) — **COMPLETADO**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 3 — Blogs (12 posts en `blogPosts.js`) — **COMPLETADO**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 4 — Testing end‑to‑end (Phase G) — **COMPLETADO**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 5 — Catálogo + Precios + IVA (Excel‑driven) — **COMPLETADO (P0)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 6 — Motor de Envíos (V1) — **COMPLETADO (P0)**
- Existe `core/shipping.py` con detección de zonas y reglas.

**Actualización v2 (Lote 14) — COMPLETADA:** ver Fase 16.

**Actualización v3 (Lote 17) — COMPLETADA:** ver Fase 19.

---

### Fase 7 — Métodos de Pago (V1) — **COMPLETADO (P1)**
- Existe lógica de métodos de pago + UI.

**Actualización v2 (Lote 14) — COMPLETADA:** ver Fase 16.

---

### Fase 8 — SEO + GEO (multi‑idioma) — **EN PROGRESO (P1)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 9 — Migración P0 de Imágenes — **PENDIENTE (P1)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 10 — SEO Manual + Nombres Legacy + Redirecciones — **COMPLETADO (P0/P1)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 11 — Lote 9: UX + Operaciones — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 12 — Lote 10: Recuperación de Carritos Abandonados — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 13 — Lote 11 — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 14 — Lote 12 — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 15 — Lote 13 — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 16 — Lote 14: Envíos/Pagos/Reembolsos/Registro (v2) — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 17 — Lote 15: Carrito estilo Amazon + UX móvil + Mensajes a cliente — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 18 — Lote 16: Recomendados EcoAndes + UX móvil tienda/cartas + logout destacado — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 19 — Lote 17: Envíos retail v3 + verificación dirección + reembolsos WooCommerce + solicitud factura + buscador + menú móvil + paginación tienda — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 20 — Lote 18: Cartas con compra rápida + reseñas sembradas — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

### Fase 21 — Lote 19: Refinamientos Storefront + Envíos B2B granel + UX móvil + ajustes PDP y cards — **COMPLETADO (2026-08/2026-09)**
> **Estado:** **COMPLETADO (agent-tested; iteration_27 + iteration_28) — pendiente confirmación del usuario**.

#### 21.1 Envíos B2B: “portes solo para granel (>1kg)” cuando base ≥ 150€ — **COMPLETADO**
**Regla implementada:**
- Profesional verificado **<150€ base**: envío por **tabla de kg** calculada con el **peso total** del pedido.
- Profesional verificado **≥150€ base**:
  - si NO hay granel (>1kg): portes **0€**.
  - si HAY granel: calcular portes por **tabla de kg** usando **solo el peso total de ítems granel** (`bulk_weight_kg`); los ítems ≤1kg quedan con portes gratis.

**Cambios implementados (backend):**
- `backend/core/shipping.py`
  - `evaluate_shipping()` acepta `bulk_weight_kg` (nuevo) además de `total_weight_kg`.
  - En `weight_scale_conditional_free`:
    - si `amount >= free_min_amount` y `bulk_weight_kg > 0`: aplica tabla por kg con `bulk_weight_kg`.
    - si `amount >= free_min_amount` y `bulk_weight_kg == 0`: portes 0.
    - si `amount < free_min_amount`: tabla por kg con `total_weight_kg`.
  - Devuelve campos informativos:
    - `bulk_only_shipping: true|false`
    - `charged_weight_kg`
    - `bulk_weight_kg`
- `backend/routes/orders.py`
  - `ShippingRequest`: `bulk_weight_kg: float`.
  - En `create_order`: calcula `bulk_weight_kg` sumando `weight_kg * qty` solo donde `weight_kg > 1.0`.
  - Guarda `bulk_weight_kg` en la orden.

**Cambios implementados (frontend):**
- `frontend/src/context/CartContext.jsx`
  - expone `bulkWeightKg`.
- `frontend/src/pages/Checkout.jsx`
  - envía `bulk_weight_kg` al endpoint `/api/orders/shipping-quote`.
  - muestra nota `summary-bulk-note` cuando aplica y ajusta la línea del tramo para reflejar el peso cobrado.

**Verificación:**
- Testing Agent `iteration_27.json`: backend **100% (23/23)** incluyendo casos:
  - pro <150€ (cobra peso total),
  - pro ≥150€ sin granel (free),
  - pro ≥150€ con granel (cobra solo bulk),
  - Canarias manual_quote.

#### 21.2 PDP móvil: reordenar contenido (solo orden, sin rediseño) — **COMPLETADO**
**Requisito (corregido):** el reorden solicitado aplica a **la página de detalle del producto** (PDP), no a las tarjetas.

**Implementación:**
- `frontend/src/pages/ProductDetail.jsx`
  - Añadido bloque `pdp-mobile-header` (`lg:hidden`) antes de la galería con:
    - categoría, nombre, estrellas, highlights.
  - El header de escritorio queda en `hidden lg:block` para evitar duplicación en móvil.
  - Reorden móvil (columna derecha) sin rediseño, usando `flex flex-col` + `order-*` (móvil):
    - precio `order-1`
    - formatos `order-2`
    - trust badges `order-3`
    - disponibilidad `order-4`
    - cantidad + añadir `order-5`
    - acciones secundarias `order-6`
    - metadata `order-7`
    - certificaciones `order-8`
    - “Explora más categorías” `order-9`
  - En escritorio: `lg:order-none` restaura el orden/layout original.

**Verificación:**
- Testing Agent `iteration_28.json`: validó orden móvil PDP y que `pdp-mobile-header` está oculto en desktop.

#### 21.3 PDP: “Explora más categorías” como desplegable (web+móvil) — **COMPLETADO**
- `frontend/src/pages/ProductDetail.jsx`
  - Sección colapsable:
    - `data-testid="pdp-categories-toggle"`
    - `data-testid="pdp-categories-panel"`
  - Cerrado por defecto.

#### 21.4 Móvil: barra inferior fija de navegación + liberar header — **COMPLETADO**
**Requisito implementado:**
- Barra inferior fija (solo `<1024px`): Menú, Inicio, Acceder/Cuenta (centro elevado), Favoritos (badge), Carrito (badge).
- Fondo igual al AnnouncementBar: `bg-sage-800`.
- Header móvil sin iconos de cuenta ni carrito.

**Implementación:**
- `frontend/src/components/Navbar.jsx`
  - barra inferior mediante portal a `document.body`.
  - `nav-cart-btn` queda como `hidden lg:flex` (solo desktop).
  - icono header de cuenta móvil eliminado.
- `frontend/src/index.css`
  - `body` añade `padding-bottom` en móvil para evitar que la barra tape contenido.
- `frontend/src/components/WhatsappFab.jsx`
  - se reposiciona para quedar por encima de la barra inferior en móvil.
- `frontend/src/components/CookieBanner.jsx`
  - aumenta padding inferior para no solaparse con la barra inferior.

#### 21.5 Cartas de producto: formatos estéticos + selector de cantidad — **COMPLETADO**
**Requisito actualizado:** mantener tarjetas sin categoría/descripcion; layout móvil horizontal; añadir selector de cantidad.

**Implementación:**
- `frontend/src/components/ProductCard.jsx`
  - Layout:
    - móvil: horizontal (imagen izquierda, contenido derecha)
    - desktop: vertical (imagen arriba)
  - Píldoras de formato muestran:
    - nombre arriba
    - precio abajo
  - Añadido stepper de cantidad `(- / qty / +)` en todas las tarjetas:
    - `product-card-qty-dec-{id}` / `product-card-qty-inc-{id}` / `product-card-qty-value-{id}`
    - `addItem(..., qty)` y reset `qty` a 1 tras añadir.
  - Sin categoría ni descripción.
- `frontend/src/pages/Shop.jsx`
  - deja de usar cualquier modo `detailed` (ya no existe).

**Verificación:**
- Testing Agent `iteration_28.json`:
  - stepper presente en Home/Tienda/carruseles,
  - +/- no navega,
  - añade con cantidad correcta y se resetea.

#### 21.6 Copy carrito: “Explorar más artículos” → “Explorar más productos” — **COMPLETADO**
- i18n `cart.explore`:
  - ES: “Explorar más productos”
  - EN: “Explore more products”
  - FR/IT/PT ajustado a equivalente.

#### 21.7 Verificación — **COMPLETADO**
- Build frontend (ESBUILD): **OK**.
- Testing Agent:
  - `iteration_27.json`: backend **100% (23/23)** + frontend **100%** (regla B2B, bottom nav, copy, PDP categories).
  - `iteration_28.json`: frontend **98%** (solo aviso menor de accesibilidad; `aria-pressed` verificado manualmente como OK).

---

## 3) Próximas Acciones (inmediatas)
1) **Confirmación del usuario** del Lote 19 (Fase 21) en preview:
   - validar regla B2B granel en un caso real de profesional (≥150€ con y sin formatos >1kg),
   - validar el nuevo orden móvil en la PDP,
   - validar tarjetas con selector de cantidad,
   - validar barra inferior móvil y header liberado.
2) **Cierre Fase 8 (SEO/GEO)**: spot-check 10–15 productos ES/EN/FR.
3) **Fase 9** migración de imágenes.
4) **Resend**: verificación de dominio remitente y retest de emails.
5) **PayPal sandbox**: aportar credenciales y retest.
6) **Verifactu**: definir alcance/implementación.

---

## 4) Criterios de Éxito

**Se mantienen los criterios anteriores** y los de Fase 21 quedan como cumplidos (agent-tested) a la espera de validación del usuario.

### Fase 20 (ya cumplidos)
- Cartas:
  - muestran estrellas + nº de valoraciones,
  - muestran formatos con precios seleccionables,
  - quick-buy añade la variación seleccionada,
  - mobile: 1 columna con layout horizontal,
  - drawer minicards no se sobrecargan.
- Reseñas:
  - >= 11 por producto,
  - distribución ~97% 5★ / ~3% 4★,
  - `web_rating` / `web_reviews` reflejan la media y el conteo.
- Product detail:
  - slug inexistente muestra “Producto no encontrado” sin overlay de error.

### Fase 21 (cumplidos; agent-tested)
1) **Envíos B2B granel**
   - Pro verificado <150€ base: se cobra por peso total (tabla).
   - Pro verificado ≥150€ base:
     - sin granel (>1kg): portes 0.
     - con granel: portes calculados por tabla usando solo el peso de ítems granel.
2) **PDP móvil (orden de contenido)**
   - se ve primero: categoría + nombre + estrellas + descripción,
   - luego imagen,
   - luego precio y formatos,
   - y después el resto.
   - Desktop sin cambios.
3) **PDP categorías**
   - listado de categorías más ordenado mediante colapsable, sin perder chips/enlaces.
4) **Barra inferior móvil**
   - visible solo en móvil,
   - color de fondo igual al AnnouncementBar,
   - abre menú y carrito correctamente,
   - header móvil sin iconos de cuenta y carrito,
   - no tapa contenido ni botones flotantes.
5) **Cartas con selector de cantidad**
   - stepper presente en todas las tarjetas,
   - añade la cantidad correcta y se resetea,
   - formato mostrado arriba y precio abajo en píldoras,
   - sin categoría ni descripción en cards.
6) **Copy**
   - “Explorar más productos” aplicado en el carrito.

---

## 5) Clonación a nuevo entorno (2026-07) — COMPLETADO
(Se mantiene igual que en la versión anterior del plan.)

---

## 6) Mejoras Dashboard + Credenciales (2026-07) — COMPLETADO
(Se mantiene igual que en la versión anterior del plan.)

---

## 7) Lote de 12 mejoras (2026-07) — COMPLETADO
(Se mantiene igual que en la versión anterior del plan.)

---

## 8) Lote de 7 mejoras (mensaje 338) — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)

---

## 9) Lote 8 — **Editor SEO Manual + Aplicar Nombres Legacy + Redirecciones** — **COMPLETADO (2026-08)**
(Se mantiene igual que en la versión anterior del plan.)
