{
  "design_personality": {
    "brand": "EcoAndes",
    "north_star": "Natural Luxury — premium organic-food PDP that feels editorial, calm, and conversion-focused (Penelope-care-like restraint).",
    "keywords": ["sage + bone calm", "thin borders", "serif display headings", "uppercase tracked overlines", "generous whitespace", "quiet micro-motion"],
    "do_not_change": [
      "Do NOT invent a new palette. Use existing Tailwind tokens: sage, bone, ink, terracotta.",
      "Keep existing utility classes: .btn-primary, .btn-outline, .btn-ghost, .overline, .card hover shadows.",
      "Keep multilingual flow intact (7 languages). Avoid hard-coded strings; use i18n keys.",
      "Do NOT break cart drawer/checkout behavior."
    ]
  },
  "design_tokens_and_css": {
    "notes": "Extend existing tokens in index.css without changing the overall look. Avoid transition: all (see appended rules).",
    "css_custom_properties": {
      "add_to_/app/frontend/src/index.css": [
        "/* EcoAndes PDP extensions (keep palette; add only missing tokens) */",
        ":root {",
        "  --shadow-soft: 0 10px 30px rgba(45, 51, 47, 0.06);",
        "  --shadow-hover: 0 18px 50px rgba(45, 51, 47, 0.10);",
        "  --ring-offset: 40 18% 97%; /* bone background */",
        "  --radius-card: 0.5rem;",
        "  --radius-control: 0.375rem;",
        "  --pdp-max: 72rem; /* 1152px */",
        "  --pdp-gutter: 1rem;",
        "  --pdp-gutter-lg: 2rem;",
        "}",
        "@layer components {",
        "  .card-eco { @apply bg-white border border-bone-200 rounded-[var(--radius-card)] shadow-[var(--shadow-soft)]; }",
        "  .card-eco:hover { box-shadow: var(--shadow-hover); }",
        "  .pill-eco { @apply inline-flex items-center gap-2 rounded-full border border-bone-200 bg-white px-3 py-1 text-xs text-ink; }",
        "  .meta-eco { @apply text-xs text-ink-muted; }",
        "  .divider-eco { @apply h-px w-full bg-bone-200; }",
        "  .focus-eco { @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bone-100; }",
        "  .thumb-eco { @apply relative overflow-hidden rounded-sm border border-bone-200 bg-white; }",
        "  .thumb-eco-active { @apply border-sage-500 ring-1 ring-sage-500; }",
        "  .sticky-cta-shadow { box-shadow: 0 -12px 30px rgba(45, 51, 47, 0.08); }",
        "}",
        "/* Reduce motion support */",
        "@media (prefers-reduced-motion: reduce) {",
        "  .motion-safe\:animate-none { animation: none !important; }",
        "}"
      ]
    },
    "typography": {
      "keep_existing": ["font-heading for display headings", "body sans for paragraphs"],
      "hierarchy_tailwind": {
        "h1": "font-heading text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-ink",
        "h2": "font-heading text-2xl sm:text-3xl leading-tight text-ink",
        "h3": "font-heading text-xl sm:text-2xl leading-snug text-ink",
        "subtitle": "text-base md:text-lg text-ink-muted leading-relaxed",
        "body": "text-sm sm:text-base text-ink leading-relaxed",
        "overline": "overline"
      },
      "tracking_rules": {
        "overlines": "uppercase tracking-[0.28em]",
        "buttons": "uppercase tracking-[0.22em]",
        "avoid": ["over-tracking body text", "all-caps long paragraphs"]
      }
    },
    "color_usage": {
      "backgrounds": {
        "page": "bg-bone-100 (or existing bone background)",
        "cards": "bg-white with border-bone-200",
        "subtle_panels": "bg-sage-50 or bg-bone-200/40"
      },
      "accents": {
        "primary_actions": "sage-500/600",
        "highlights": "terracotta (sparingly: price emphasis, small badges)",
        "text": "ink / ink-muted"
      },
      "gradients": {
        "allowed": "Only as a very subtle hero background wash (<=20% viewport), e.g. bone -> sage-50 diagonal.",
        "example": "bg-[radial-gradient(1200px_circle_at_20%_10%,theme(colors.sage.50),transparent_55%),radial-gradient(900px_circle_at_90%_0%,theme(colors.bone.200),transparent_50%)]",
        "restriction": "Follow GRADIENT RESTRICTION RULE appended below."
      }
    }
  },
  "layout_and_grid": {
    "page_container": {
      "max_width": "max-w-[var(--pdp-max)]",
      "padding": "px-4 sm:px-6 lg:px-8",
      "vertical_rhythm": "space-y-10 sm:space-y-14"
    },
    "pdp_hero_grid": {
      "desktop": "lg:grid lg:grid-cols-12 lg:gap-x-10",
      "left_gallery": "lg:col-span-7",
      "right_buybox": "lg:col-span-5",
      "mobile": "stacked; gallery first, buybox second; keep CTA visible via sticky bar"
    },
    "section_spacing": {
      "between_sections": "py-10 sm:py-14",
      "within_cards": "p-4 sm:p-6",
      "micro_spacing": "Use gap-3/4/6; avoid dense clusters"
    }
  },
  "component_path": {
    "shadcn_primary": {
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "button": "/app/frontend/src/components/ui/button.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "separator": "/app/frontend/src/components/ui/separator.jsx",
      "carousel": "/app/frontend/src/components/ui/carousel.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "sheet_drawer": "/app/frontend/src/components/ui/sheet.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx"
    },
    "existing_utilities": {
      "buttons": [".btn-primary", ".btn-outline", ".btn-ghost"],
      "inputs": [".input-eco"],
      "typography": [".overline"],
      "scroll": [".eco-scroll"]
    },
    "carousel_stack": {
      "note": "embla-carousel-react already installed; use shadcn carousel wrapper if present, otherwise direct Embla hook."
    }
  },
  "pdp_components_breakdown": {
    "hero_section": {
      "structure": {
        "left": [
          "Main image area (AspectRatio 1/1 on mobile; 4/5 on desktop if lifestyle images)",
          "Thumbnail strip (horizontal scroll on mobile; grid row on desktop)",
          "If per-format images missing: thumbnail becomes a neutral tile with weight label (e.g., '250g') and subtle border"
        ],
        "right": [
          "Overline category (e.g., 'BIO • Andean Superfoods')",
          "Product title (H1)",
          "Short subtitle/highlights (2–3 bullets max)",
          "Trust badges row (Organic Certified, Gluten-Free, Pesticide-Free)",
          "Price or price range",
          "Variation selector dropdown (format/weight ordered smallest→largest)",
          "Availability status pill",
          "Quantity selector + primary Add to cart",
          "Secondary actions row: Wishlist, Compare, Ask, Share",
          "Metadata row: SKU + Categories"
        ]
      },
      "gallery_interactions": {
        "thumbnail_click": "Updates main image with crossfade (Framer Motion opacity only).",
        "keyboard": "Thumbnails are buttons with aria-label and focus ring.",
        "zoom": "Optional: click main image opens Dialog with larger image + next/prev. Keep minimal."
      },
      "thumbnail_styles": {
        "container": "mt-3 flex gap-2 overflow-x-auto pb-1 eco-scroll",
        "thumb_button": "thumb-eco focus-eco shrink-0 w-16 h-16",
        "active": "thumb-eco-active",
        "missing_image_tile": "flex items-center justify-center text-[11px] uppercase tracking-[0.22em] text-ink-muted bg-bone-100"
      },
      "trust_badges": {
        "component": "Use shadcn Badge but restyle to pill-eco feel.",
        "layout": "flex flex-wrap gap-2 mt-4",
        "badge_class": "pill-eco",
        "icons": "lucide-react: Leaf, WheatOff, ShieldCheck (no emojis)."
      },
      "price_block": {
        "style": "text-2xl font-heading text-ink; range in ink-muted",
        "accent": "Use terracotta only for small 'Save X%' or 'Best value' micro-badge, not for large blocks.",
        "testid": "data-testid=\"product-price\""
      },
      "variation_selector": {
        "use": "shadcn Select",
        "ordering": "Sort by numeric weight ascending; show label like '250g • Pouch'",
        "classes": "w-full",
        "testid": "data-testid=\"product-variant-select\"",
        "empty_state": "If only one variant, show a disabled SelectTrigger with the single value."
      },
      "availability": {
        "style": "pill-eco; in-stock uses text-sage-700 bg-sage-50 border-sage-200",
        "out_of_stock": "text-terracotta-700 bg-bone-100 border-bone-200 + disable Add to cart",
        "testid": "data-testid=\"product-availability\""
      },
      "quantity_and_cta": {
        "quantity_selector": {
          "pattern": "- / + buttons with numeric input in middle",
          "a11y": "Buttons have aria-label; input type=number min=1",
          "classes": "inline-flex items-stretch rounded-sm border border-bone-200 bg-white",
          "testids": {
            "minus": "quantity-decrement-button",
            "input": "quantity-input",
            "plus": "quantity-increment-button"
          }
        },
        "primary_cta": {
          "class": "btn-primary w-full sm:w-auto",
          "micro_motion": "hover: bg shift only; active: scale-[0.99] (apply to button only)",
          "testid": "data-testid=\"add-to-cart-button\""
        },
        "layout": "mt-5 flex flex-col sm:flex-row gap-3"
      },
      "secondary_actions": {
        "buttons": [
          {"label": "Wishlist", "icon": "Heart", "testid": "wishlist-button"},
          {"label": "Compare", "icon": "Scale", "testid": "compare-button"},
          {"label": "Ask", "icon": "MessageCircle", "testid": "ask-about-product-button"},
          {"label": "Share", "icon": "Share2", "testid": "share-button"}
        ],
        "style": "btn-ghost + Tooltip labels on desktop; on mobile keep text visible",
        "layout": "mt-4 flex flex-wrap gap-2"
      },
      "metadata": {
        "style": "mt-6 pt-4 border-t border-bone-200 flex flex-wrap gap-x-6 gap-y-2 meta-eco",
        "testids": {"sku": "product-sku", "categories": "product-categories"}
      }
    },
    "mobile_sticky_add_to_cart": {
      "goal": "Keep conversion controls reachable without breaking layout.",
      "behavior": [
        "On screens < lg: show a bottom sticky bar when user scrolls past hero title.",
        "Bar contains: small thumbnail, product name (1 line), price, qty stepper (compact), Add to cart button.",
        "Use position: sticky bottom-0; background white; border-t bone-200; sticky-cta-shadow.",
        "Respect safe-area-inset-bottom (pb-[calc(env(safe-area-inset-bottom)+12px)])."
      ],
      "testids": {
        "bar": "sticky-add-to-cart-bar",
        "cta": "sticky-add-to-cart-button"
      }
    },
    "detailed_info_tabs": {
      "use": "shadcn Tabs",
      "tabs": ["Description", "Nutritional info", "Technical sheet", "Reviews"],
      "layout": {
        "tabs_list": "sticky-ish feel on desktop: top-2 within section (optional); on mobile horizontal scroll TabsList",
        "classes": {
          "wrapper": "mt-10",
          "list": "w-full justify-start gap-2 overflow-x-auto eco-scroll bg-transparent p-0",
          "trigger": "rounded-full border border-bone-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.22em] text-ink data-[state=active]:border-sage-500 data-[state=active]:text-sage-700",
          "content": "mt-6"
        }
      },
      "tab1_description": {
        "content_blocks": ["Ingredients", "Origin", "Benefits", "Usage", "Storage", "Certifications"],
        "pattern": "Two-column editorial blocks on lg (label left, content right).",
        "classes": "grid gap-6 lg:grid-cols-12",
        "label": "lg:col-span-3 overline",
        "body": "lg:col-span-9 text-sm sm:text-base text-ink leading-relaxed",
        "testid": "data-testid=\"product-description-tab\""
      },
      "tab2_nutrition_table": {
        "use": "shadcn Table",
        "styling": {
          "table": "w-full overflow-hidden rounded-[var(--radius-card)] border border-bone-200 bg-white",
          "thead": "bg-bone-100",
          "th": "text-xs uppercase tracking-[0.22em] text-ink-muted font-medium",
          "td": "text-sm text-ink",
          "row_hover": "hover:bg-sage-50/60 transition-colors"
        },
        "empty_state": {
          "when": "nutrition data missing",
          "ui": "card-eco p-6 text-center",
          "copy": "Show tasteful message + link/button 'Ask about product'",
          "testid": "nutrition-empty-state"
        },
        "testid": "data-testid=\"product-nutrition-tab\""
      },
      "tab3_technical_sheet": {
        "ui": "If PDF exists: show a card with filename, size (if known), and a Download button (.btn-outline).",
        "download_button": "data-testid=\"technical-sheet-download-button\"",
        "missing_behavior": "If no PDF: either hide the tab entirely OR show empty-state card with 'Not available for this product'. Prefer hiding tab to reduce clutter.",
        "testid": "data-testid=\"product-technical-sheet-tab\""
      },
      "tab4_reviews": {
        "top_summary": "Average score + star row + count; include 'Write a review' anchor.",
        "comments": "List in cards with name, date, rating, comment; paginate if needed.",
        "review_form": {
          "fields": ["name", "email", "rating", "comment"],
          "components": "Input, Textarea, custom StarRating (lucide Star) as buttons",
          "validation": "Inline errors in ink-muted/terracotta; aria-describedby",
          "submit": "btn-primary",
          "testids": {
            "form": "review-form",
            "name": "review-name-input",
            "email": "review-email-input",
            "rating": "review-rating-input",
            "comment": "review-comment-textarea",
            "submit": "review-submit-button"
          }
        },
        "stars": {
          "implementation": "Render 5 buttons; on hover preview fill; on click set rating; use motion for subtle scale 1.03 on hover.",
          "a11y": "Each star button aria-label='Set rating to X'"
        },
        "testid": "data-testid=\"product-reviews-tab\""
      }
    },
    "cross_selling_carousels": {
      "sections": ["Related products", "Best sellers"],
      "use": "embla-carousel-react + shadcn carousel wrapper if already used in codebase",
      "card": {
        "layout": "image top (AspectRatio 4/5), title, price range, rating stars",
        "hover_actions": "Top-right overlay icons (wishlist/compare) appear on hover (desktop) and always visible on mobile as small ghost buttons.",
        "classes": {
          "card": "card-eco group overflow-hidden",
          "image_wrap": "relative",
          "overlay": "absolute top-3 right-3 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity",
          "icon_btn": "h-9 w-9 rounded-full bg-white/90 backdrop-blur border border-bone-200 text-ink hover:border-sage-500 focus-eco",
          "title": "mt-3 font-heading text-base text-ink line-clamp-2",
          "price": "mt-1 text-sm text-ink",
          "rating": "mt-2"
        },
        "testids": {
          "card": "product-card",
          "wishlist": "product-card-wishlist-button",
          "compare": "product-card-compare-button"
        }
      },
      "carousel_controls": {
        "prev_next": "Use subtle outline circular buttons; hide if not scrollable.",
        "dots": "Optional; if used, keep tiny bone dots with active sage.",
        "testids": {"related": "related-products-carousel", "bestsellers": "best-sellers-carousel"}
      }
    },
    "footer": {
      "top_newsletter": {
        "layout": "Full-width band with bone background; inner card-eco with input + button.",
        "form": {
          "input": "input-eco",
          "button": "btn-primary",
          "testids": {"email": "newsletter-email-input", "submit": "newsletter-submit-button"}
        },
        "microcopy": "Short, premium tone; include privacy note link."
      },
      "columns": {
        "layout": "grid grid-cols-2 sm:grid-cols-4 gap-8",
        "groups": [
          {"title": "Information", "links": ["About us", "Legal Notice", "Policies", "Blog"], "testid": "footer-information-links"},
          {"title": "Customer Area", "links": ["My Account", "My Orders", "Returns"], "testid": "footer-customer-area-links"}
        ],
        "link_style": "text-sm text-ink-muted hover:text-ink transition-colors",
        "a11y": "Ensure focus-visible ring on links"
      }
    }
  },
  "micro_interactions_and_motion": {
    "library": "framer-motion (already installed)",
    "principles": [
      "Use motion for opacity/translateY entrance only (6–12px).",
      "Hover: subtle elevation via shadow + border color shift (bone->sage).",
      "Buttons: active scale 0.99; avoid scaling containers.",
      "Carousels: momentum swipe; keep controls understated.",
      "Respect prefers-reduced-motion."
    ],
    "recommended_durations": {
      "hover": "150–220ms",
      "entrance": "450–700ms",
      "easing": "cubic-bezier(0.2, 0.8, 0.2, 1)"
    }
  },
  "accessibility_and_i18n": {
    "a11y": [
      "All icon-only buttons must have aria-label.",
      "Use focus-visible rings (sage) with ring-offset (bone).",
      "Ensure color contrast: ink on bone/white; avoid sage text on bone for long paragraphs.",
      "Tabs triggers must be keyboard navigable (shadcn handles).",
      "Images require alt text; if decorative, alt=''."
    ],
    "i18n": [
      "No hard-coded strings; use translation keys for labels, badges, empty states.",
      "Allow longer strings (German/French) by avoiding fixed widths; use flex-wrap and min-w-0.",
      "Price formatting via locale; do not concatenate currency manually."
    ]
  },
  "data_and_empty_states": {
    "missing_variant_images": "Show weight-label thumbnail tile; keep selection state visible.",
    "missing_nutrition": "Show empty-state card with 'Nutritional information not available' + Ask button.",
    "missing_technical_sheet": "Prefer hiding the tab; if shown, empty-state card.",
    "no_reviews": "Show calm empty state + invite to write first review; keep form visible."
  },
  "images": {
    "image_urls": [
      {
        "category": "pdp_gallery_lifestyle_optional",
        "description": "Neutral, premium organic still-life/lifestyle placeholders (only if product lacks imagery).",
        "urls": [
          "https://images.pexels.com/photos/6311985/pexels-photo-6311985.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
          "https://images.pexels.com/photos/14832252/pexels-photo-14832252.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
          "https://images.unsplash.com/photo-1559813888-2826a13588ca?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
        ]
      }
    ]
  },
  "instructions_to_main_agent": {
    "implementation_sequence": [
      "1) Build PDP Hero layout (gallery + buy box) with responsive grid and testids.",
      "2) Implement gallery state: selectedImageIndex + selectedVariant; handle missing per-variant images.",
      "3) Add mobile sticky add-to-cart bar (intersection observer / scroll threshold).",
      "4) Implement Tabs with 4 panels; hide/empty-state based on data availability.",
      "5) Build Nutrition table with shadcn Table + empty state.",
      "6) Build Reviews: summary, list, StarRating input, form validation + sonner toast.",
      "7) Build ProductCard component + Embla carousels for Related/Best sellers.",
      "8) Enhance Footer: newsletter band + link columns; ensure i18n and testids."
    ],
    "js_files_note": "Project uses .jsx/.js. Create components as .jsx and follow named exports for components, default export for pages.",
    "testing_hooks": "Every interactive element and key info must include data-testid in kebab-case (role-based)."
  },
  "append_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
