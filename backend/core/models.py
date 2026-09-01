"""Pydantic data models for Ecoandes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Literal
import uuid

from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- helpers ----------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ---------- User ----------
UserRole = Literal["retail", "professional", "admin"]


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: Literal["retail", "professional"] = "retail"
    company: Optional[str] = None
    tax_id: Optional[str] = None
    business_type: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None  # mensaje opcional del registro profesional


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    company: Optional[str] = None
    tax_id: Optional[str] = None
    business_type: Optional[str] = None
    phone: Optional[str] = None
    approved: bool = True
    verification: Optional[str] = None  # auto | manual | failed (alta profesional)
    created_at: str


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    tax_id: Optional[str] = None
    business_type: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    approved: Optional[bool] = None


# ---------- Product ----------
class ProductVariation(BaseModel):
    sku: str
    name: str  # e.g. "500 g", "1 kg"
    price_retail: float  # PVP (B2C) SIN IVA
    price_professional: float  # B2B SIN IVA
    stock: int = 0
    image_url: str = ""  # optional per-format image
    weight_kg: float = 0.0  # net weight per unit, for shipping calc
    is_bulk: bool = False   # derived: weight_kg > 1.0 kg (granel)
    ean: str = ""
    available_retail: bool = True
    available_professional: bool = True
    active: bool = True  # per-format enable/disable (hidden from storefront when False)


class NutritionRow(BaseModel):
    key: str            # stable id, e.g. "energy", "protein"
    label: str          # display label (Spanish base), translated via i18n keys on FE when known
    value: str          # e.g. "389 kcal", "13 g"


class Badge(BaseModel):
    src: str
    alt: str = ""


class DescriptionBlocks(BaseModel):
    ingredients: str = ""
    origin: str = ""
    benefits: str = ""
    usage: str = ""
    storage: str = ""
    certifications: str = ""


class TechSheet(BaseModel):
    url: str = ""
    filename: str = ""


class SeoMeta(BaseModel):
    meta_title: str = ""
    meta_description: str = ""
    keywords: List[str] = Field(default_factory=list)
    geo_region: str = ""  # e.g. country/region of origin for GEO


class ProductBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sku: str
    slug: str
    name: str
    category: str = "General"
    description: str = ""
    short_description: str = ""
    highlights: str = ""  # premium subtitle / tagline from source site
    price_retail: float        # default/base format PVP, SIN IVA
    price_professional: float  # default/base format B2B, SIN IVA
    compare_at_price: Optional[float] = None  # precio anterior (retail, IVA incl.) para ofertas/descuentos
    vat_rate: int = 10         # 4 | 10 | 21 (% IVA aplicado dinámicamente)
    origin_country: str = ""   # país de origen (Excel "Origen")
    stock: int = 0
    image_url: str = ""
    gallery: List[str] = Field(default_factory=list)
    variations: List[ProductVariation] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    badges: List[Badge] = Field(default_factory=list)
    description_blocks: DescriptionBlocks = Field(default_factory=DescriptionBlocks)
    nutrition: List[NutritionRow] = Field(default_factory=list)
    tech_sheet: TechSheet = Field(default_factory=TechSheet)
    seo: SeoMeta = Field(default_factory=SeoMeta)
    featured: bool = False
    best_seller: bool = False
    recommended: bool = False  # "Recomendados por EcoAndes" (sección en Home)
    active: bool = True


class Product(ProductBase):
    id: str = Field(default_factory=_new_id)
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    highlights: Optional[str] = None
    price_retail: Optional[float] = None
    price_professional: Optional[float] = None
    compare_at_price: Optional[float] = None
    vat_rate: Optional[int] = None
    origin_country: Optional[str] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    gallery: Optional[List[str]] = None
    variations: Optional[List[ProductVariation]] = None
    tags: Optional[List[str]] = None
    badges: Optional[List[Badge]] = None
    description_blocks: Optional[DescriptionBlocks] = None
    nutrition: Optional[List[NutritionRow]] = None
    tech_sheet: Optional[TechSheet] = None
    seo: Optional[SeoMeta] = None
    featured: Optional[bool] = None
    best_seller: Optional[bool] = None
    recommended: Optional[bool] = None
    active: Optional[bool] = None


class StockUpdate(BaseModel):
    stock: Optional[int] = None
    variations: Optional[List[dict]] = None  # [{sku, stock}]


class NewsletterSubscribe(BaseModel):
    email: EmailStr


# ---------- Order ----------
OrderStatus = Literal["Pendiente portes", "Pendiente", "Pagado", "Enviado", "Completado", "Cancelado", "Reembolsado"]
PaymentMethod = Literal["stripe", "paypal", "transfer", "other", "pending_quote"]
DeliveryMethod = Literal["shipping", "pickup"]


class Address(BaseModel):
    full_name: str
    phone: Optional[str] = None
    street: str
    city: str
    province: str
    postal_code: str
    country: str = "España"
    notes: Optional[str] = None


class OrderItem(BaseModel):
    product_id: str
    sku: str
    name: str
    variation_name: Optional[str] = None
    unit_price: float
    quantity: int
    image_url: str = ""

    @property
    def line_total(self) -> float:
        return round(self.unit_price * self.quantity, 2)


class OrderCreate(BaseModel):
    email: EmailStr
    items: List[OrderItem]
    shipping_address: Address
    billing_address: Optional[Address] = None
    customer_type: Literal["retail", "professional"] = "retail"
    payment_method: PaymentMethod = "stripe"
    delivery_method: DeliveryMethod = "shipping"
    notes: Optional[str] = None
    coupon_code: Optional[str] = None
    origin_url: Optional[str] = None
    acquisition: Optional[dict] = None  # first-touch traffic attribution (referrer/utm)


class Order(BaseModel):
    id: str = Field(default_factory=_new_id)
    order_number: str
    email: EmailStr
    user_id: Optional[str] = None
    customer_type: Literal["retail", "professional"] = "retail"
    items: List[OrderItem]
    shipping_address: Address
    billing_address: Optional[Address] = None
    subtotal: float
    shipping_cost: float
    total: float
    coupon_code: Optional[str] = None
    discount: float = 0.0
    currency: str = "EUR"
    status: OrderStatus = "Pendiente"
    payment_method: PaymentMethod = "stripe"
    payment_status: str = "pending"
    payment_session_id: Optional[str] = None
    payment_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ---------- Payment Transaction ----------
class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=_new_id)
    order_id: str
    session_id: Optional[str] = None
    provider: Literal["stripe", "paypal"]
    amount: float
    currency: str = "EUR"
    email: EmailStr
    metadata: dict = Field(default_factory=dict)
    payment_status: str = "initiated"
    status: str = "initiated"
    processed: bool = False
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


# ---------- Price Log ----------
class PriceLogEntry(BaseModel):
    id: str = Field(default_factory=_new_id)
    sku: str
    old_retail: Optional[float] = None
    new_retail: Optional[float] = None
    old_professional: Optional[float] = None
    new_professional: Optional[float] = None
    source: str = "excel_import"
    created_at: str = Field(default_factory=_now_iso)


class ImportSummary(BaseModel):
    total_rows: int
    updated: int
    not_found: int
    errors: List[str]
    not_found_skus: List[str]


# ---------- Shipping ----------
class ShippingQuote(BaseModel):
    subtotal: float
    shipping_cost: float
    total: float
    free_shipping_threshold: float
    remaining_for_free_shipping: float
    free_shipping: bool


# ---------- Reviews ----------
class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class Review(BaseModel):
    id: str = Field(default_factory=_new_id)
    product_id: str
    user_id: str
    user_name: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)
