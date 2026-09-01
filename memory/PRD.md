# Ecoandes — Premium BIO E-commerce

## Problem Statement (verbatim)
Develop the new Ecoandes platform (https://productosecoandes.com/) with B2C retail + B2B professional sales, admin dashboard, Excel-based massive price import, Stripe+PayPal payments, Cloudinary media, Resend transactional emails, Natural Luxury UI inspired by penelope-care.com. Preserve SEO via /producto/[slug] URLs.

## Stack
- Backend: FastAPI (Python) + Motor (MongoDB async)
- Frontend: React 19 + Tailwind + shadcn/ui + framer-motion + sonner
- Payments: Stripe (emergentintegrations) + PayPal REST API (sandbox)
- Media: Cloudinary signed upload
- Email: Resend
- Auth: JWT + bcrypt

## Personas
- Shopper (Retail B2C) — guest checkout or optional account
- Profesional (B2B) — logs in to see special pricing, uses CIF/NIF
- Administrador (dueña) — manages catalog, orders, customers, price imports

## Implemented (Feb 2026)
- WordPress XML importer seeded 187 products across 20+ categories with variations (auto on startup)
- Product catalog with dual pricing (retail/PVP vs professional/B2B)
- Public: Home, Shop (filters + search + cat chips), PDP `/producto/[slug]`, About, Contact, Pro (B2B)
- Side-drawer cart (framer-motion) with free shipping progress bar (60 € threshold)
- Checkout (guest + logged-in) with dynamic shipping calc + server-side price recompute to prevent tampering
- Payment: Stripe (test key `sk_test_emergent`), PayPal (sandbox, needs keys)
- Admin Dashboard: metrics, recent orders, orders list+filters, order detail w/ status update, customers list+role change, products list+edit modal, Excel price import (SKU match, variation-aware, logs)
- JWT auth (login/register/me), admin auto-seeded (admin@ecoandes.com / Admin123!)
- Resend order confirmation email on order creation (needs RESEND_API_KEY)
- Cloudinary signed upload endpoint (needs keys)

## Environment keys to provide in /app/backend/.env (already scaffolded)
- STRIPE_API_KEY (default sk_test_emergent works)
- PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_MODE (sandbox|live)
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- RESEND_API_KEY, SENDER_EMAIL, ADMIN_NOTIFICATION_EMAIL

## Test Credentials
- Admin: admin@ecoandes.com / Admin123!
- Retail: retail@ecoandes.com / Retail123! (created during smoke test)

## Backlog (P1)
- Admin create-product flow with Cloudinary upload widget
- Order email template branding + logo
- Profesional account approval workflow (pending → approved)
- Webhook-triggered email dispatch (instead of background task on order creation)
- Invoice PDF generation & download

## Backlog (P2)
- Stock management with variation-level inventory
- Discount codes / coupons
- Hostinger deploy docs + GitHub Actions workflow

## Multilingual (7 languages) — Implemented (Jun 2026)
- Full site in ES (base), EN, ZH (Mandarin), FR, JA, IT, PT.
- UI strings: i18next locale JSON (342 keys/lang, 100% complete) regenerated via scripts/generate_translations.py (Gemini).
- Product content (name/short_description/description): translated via core/translator.py (Gemini gemini-2.5-flash), stored in MongoDB `products.translations.{lang}`. All 187 products done for all 6 target langs.
- Categories: cached in `meta.category_translations`; served as [{value,label}] via GET /api/products/categories?lang=.
- Backend serves localized content via `?lang=` on /api/products, /products/slug/{slug}, /products/{id} (translations field stripped from output).
- Frontend: axios interceptor attaches `lang` from localStorage `eco_lang`; Shop/Home/ProductDetail refetch on language change; LanguageSwitcher shows flag (flagcdn) + sigla.
- Auto-generation on startup (idempotent, only_missing) + admin endpoints POST /api/products/translations/run, GET /api/products/translations/status.
- Env added to /app/backend/.env: EMERGENT_LLM_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET.


## Enriched Product Pages + Admin Management (Jun 2026)
- Data ingested from productosecoandes.com **WooCommerce Store API** (`/wp-json/wc/store/v1/products`) via `scripts/ingest_ecoandes.py`: matched 147/187 DB products by normalized-name Jaccard. Report at `/app/memory/missing_data_report.md` (40 products had no web match; nutrition NOT published on source → blank for all).
- New Product fields (core/models.py): `highlights`, `badges[]` (certification images), `description_blocks{ingredients,origin,benefits,usage,storage,certifications}`, `nutrition[]` (blank, admin-filled), `tech_sheet{url,filename}`, `best_seller`, per-variation `image_url`, `web_rating`, `web_reviews`. Description blocks + highlights translated into 7 langs (translations.{lang}.highlights / .description_blocks).
- Best sellers: Maca Negra, Cacao Nibs, Quinoa Real Tricolor, Cúrcuma en polvo, Canela (x2).
- Storage: **Emergent Object Storage** (core/storage.py) — admin uploads via POST /api/admin/uploads (image/pdf), public serving via GET /api/files/{path}. init on startup.
- New endpoints: POST /api/products/by-ids, PATCH /api/products/{id}/stock, GET /api/products?best_seller=true, POST /api/newsletter/subscribe, /api/me/wishlist + /api/me/compare (GET/PUT/POST/DELETE, auth).
- Frontend: redesigned ProductDetail.jsx (hero gallery + thumbnails, trust badges, price range, format dropdown smallest→largest, qty, add-to-cart, wishlist/compare/ask(WhatsApp)/share, SKU+categories, tabs Description/Nutrition/TechSheet/Reviews, Related + Best-sellers carousels, mobile sticky CTA). New: WishlistContext (hybrid localStorage+server), Wishlist + Compare pages (/lista-deseos, /comparar), NewsletterForm, ProductGallery, ProductCarousel, TrustBadges, rebuilt ProductCard (hover wishlist/compare + rating + price range). Footer: newsletter band + Information + Customer Area columns. Navbar: wishlist + compare icons with counts.
- Admin: AdminProducts.jsx rebuilt (search + filters All/Best/LowStock, inline per-product stock save) + ProductEditorModal.jsx (tabs General/Images/Variations/Description/Nutrition/TechSheet; uploads per-format images + PDF; edit prices, nutrition rows, blocks, best_seller).
- Stock defaulted to 100 (sellable) for all; 5 web out-of-stock marked 0. Admin manages via dashboard.

## Fixes (Jun 2026) — Hero i18n + Ficha Técnica
- **Hero translatable**: Hero carousel texts moved from hardcoded Spanish into i18n. Added `hero` section (hero.soyProfesional + hero.slides[] with overline/h1/subtitle/cta) to all 7 locale JSONs (es base + 6 auto-translated via scripts/generate_translations.py). HeroCarousel.jsx now reads slide text via useTranslation; only image + CTA route remain in code.
- **Ficha Técnica tab always visible**: ProductDetail.jsx now always renders the 'Ficha técnica' tab (between Nutrition and Reviews) with an empty-state when no PDF exists.
- **Admin PDF upload bug fixed**: Root cause #1 — object storage failed to init because EMERGENT_LLM_KEY was missing from backend/.env (restored). Root cause #2 ("se sale del campo automáticamente") — ProductEditorModal closed when switching to a short tab (Nutrition/Ficha Técnica): the vertically-centered modal (items-center) resized per tab content, recentering upward so the click/mouseup landed on the backdrop (onClick={onClose}). Fixed by closing on onMouseDown with target===currentTarget guard + top-aligning the modal (items-start, scrollable). Verified end-to-end: all tab switches keep modal open, PDF upload + save works, download button appears on PDP.

## Hero/Portada revamp (Jun 2026)
- **Optimized images**: Replaced the 5 hero slides with the new brand banners. Source SVGs were ~2MB each (base64 PNG); rendered exact 1352x452 (3:1) crops to WebP -> /frontend/public/hero/slide-1..5.webp (total ~320KB, ~30x smaller). Old slide-*.png + cacao-hero/maca-hero pngs deleted.
- **DB-backed hero**: New collection `site_config` doc `_id="hero"` (slides[] + b2b). Seeded on startup from i18n locale JSONs (all 7 langs, no LLM). Endpoints in routes/hero.py: GET /api/hero?lang= (public, localized active slides), GET/PUT /api/admin/hero (admin), POST /api/admin/hero/translate. AI auto-translation via core/translator.generate_hero_translations() (Gemini) runs in background on save; changed Spanish fields drop stale translations then regenerate.
- **HeroCarousel.jsx**: Now fetches /api/hero (refetch on language change), banner layout aspect-[1352/452] max-h-[560px], text overlaid left on desktop (readability gradient), text stacked below image on mobile, dots nav. NOTE: data fetch uses api.get().then() (async setState) to avoid the MCP-only `react-hooks/set-state-in-effect` rule WITHOUT an eslint-disable comment (CRA's eslint lacks that rule, so a disable directive breaks the build with "Definition for rule ... was not found").
- **Admin 'Portada' page**: /admin/portada (AdminHero.jsx, sidebar link). Edit overline/H1/subtitle/CTA label+link per slide (Spanish base), upload image (1352x452 rec.), reorder (up/down), activate/deactivate, add/remove slide, edit shared B2B button. Save -> autotranslate to 6 langs. Verified end-to-end (rendering, ES/EN/FR switch, SPA nav, admin edit+save+autotranslate, image upload).

## Portabilidad entre entornos (añadido 2026-07)
- PROBLEMA RESUELTO: MongoDB no viaja con el repo; entornos nuevos sembraban el catálogo viejo de WordPress.
- SOLUCIÓN: auto-reconciliación al arranque (core/catalog_sync.py). Hash de backend/data/*.xlsx comparado con marcador en site_config._id="catalog_import". Si es entorno nuevo o cambian los Excel -> corre scripts.import_catalog automáticamente y luego regenera traducciones + SEO faltantes.
- Botón manual: Admin -> Importar precios -> "Sincronizar catálogo". Endpoints: POST /api/admin/catalog/sync, GET /api/admin/catalog/sync-status.
- En un entorno nuevo NO se requiere ninguna acción manual: el backend se auto-repara al arrancar.
- Lo que NO viaja (datos transaccionales, se pierden al saltar de entorno): pedidos, usuarios/clientes, leads de WhatsApp, archivos subidos (db.files). Si se necesitan, usar mongodump/mongorestore antes de saltar.
