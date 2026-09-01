import json
from pathlib import Path

ES = Path("/app/frontend/src/i18n/locales/es.json")
d = json.loads(ES.read_text(encoding="utf-8"))


def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst.setdefault(k, v) if False else dst.update({k: dst.get(k, v) if isinstance(v, str) and k in dst else v})


NEW = {
    "common": {
        "currencyFrom": "Desde",
        "to": "hasta",
        "close": "Cerrar",
    },
    "nav": {
        "wishlist": "Lista de deseos",
        "compare": "Comparar",
    },
    "product": {
        "tabDescription": "Descripción",
        "tabNutrition": "Información nutricional",
        "tabTechSheet": "Ficha técnica",
        "tabReviews": "Valoraciones",
        "inStock": "En stock",
        "outOfStock": "Agotado",
        "quantity": "Cantidad",
        "addToWishlist": "Lista de deseos",
        "removeFromWishlist": "Quitar de deseos",
        "compare": "Comparar",
        "ask": "Preguntar",
        "share": "Compartir",
        "categories": "Categorías",
        "priceRange": "Rango de precios",
        "askTitle": "¿Tienes una pregunta sobre este producto?",
        "askDesc": "Escríbenos por WhatsApp y te ayudamos enseguida.",
        "askButton": "Preguntar por WhatsApp",
        "shareCopied": "Enlace copiado al portapapeles",
        "addedToWishlist": "Añadido a tu lista de deseos",
        "removedFromWishlist": "Quitado de tu lista de deseos",
        "addedToCompare": "Añadido a comparar",
        "removedFromCompare": "Quitado de comparar",
        "compareMax": "Puedes comparar hasta 4 productos",
        "blocks": {
            "ingredients": "Ingredientes",
            "origin": "Origen",
            "benefits": "Beneficios",
            "usage": "Modo de empleo",
            "storage": "Almacenamiento",
            "certifications": "Certificaciones",
        },
        "nutritionTitle": "Valores nutricionales (por 100 g)",
        "nutritionEmpty": "Información nutricional no disponible para este producto.",
        "nutritionColNutrient": "Nutriente",
        "nutritionColValue": "Por 100 g",
        "techSheetTitle": "Ficha técnica del producto",
        "techSheetDesc": "Descarga la ficha técnica en PDF con toda la información detallada.",
        "downloadPdf": "Descargar PDF",
        "techSheetEmpty": "Ficha técnica no disponible para este producto.",
        "relatedTitle": "Productos relacionados",
        "bestSellersTitle": "Los más vendidos",
        "addToCartShort": "Añadir",
        "viewProduct": "Ver producto",
    },
    "productCard": {
        "addToCart": "Añadir al carrito",
        "b2b": "B2B",
        "wishlist": "Añadir a deseos",
        "compare": "Comparar",
        "bestSeller": "Más vendido",
    },
    "newsletter": {
        "title": "Únete a la comunidad EcoAndes",
        "subtitle": "Recetas, novedades BIO y ofertas exclusivas directamente en tu correo.",
        "placeholder": "Tu correo electrónico",
        "subscribe": "Suscribirme",
        "success": "¡Gracias por suscribirte!",
        "already": "Este correo ya está suscrito.",
        "error": "No se pudo completar la suscripción.",
        "invalid": "Introduce un correo válido.",
        "privacy": "Al suscribirte aceptas nuestra Política de Privacidad.",
    },
    "wishlist": {
        "title": "Lista de deseos",
        "overline": "Tus favoritos",
        "empty": "Tu lista de deseos está vacía.",
        "browse": "Explorar productos",
        "count": "{{count}} productos guardados",
    },
    "compare": {
        "title": "Comparar productos",
        "overline": "Comparativa",
        "empty": "No has añadido productos para comparar.",
        "browse": "Explorar productos",
        "remove": "Quitar",
        "clear": "Vaciar",
        "feature": "Característica",
        "price": "Precio",
        "category": "Categoría",
        "rating": "Valoración",
        "stock": "Disponibilidad",
        "action": "Acción",
        "max": "Puedes comparar hasta 4 productos.",
    },
    "footer": {
        "newsletterTitle": "Newsletter",
        "information": "Información",
        "customerArea": "Área de clientes",
        "myOrders": "Mis pedidos",
        "returns": "Devoluciones",
        "policies": "Políticas",
        "wishlist": "Lista de deseos",
    },
}

merge(d, NEW)
ES.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("es.json updated. top keys:", sorted(d.keys()))
