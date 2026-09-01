"""Database and app-level config for Ecoandes backend."""
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_EXPIRES_HOURS = int(os.environ.get("JWT_EXPIRES_HOURS", "72"))

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_SECRET = os.environ.get("PAYPAL_SECRET", "")
PAYPAL_MODE = os.environ.get("PAYPAL_MODE", "sandbox")
PAYPAL_API_BASE = (
    "https://api-m.sandbox.paypal.com" if PAYPAL_MODE == "sandbox" else "https://api-m.paypal.com"
)

CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
ADMIN_NOTIFICATION_EMAIL = os.environ.get("ADMIN_NOTIFICATION_EMAIL", "")
STORE_NOTIFICATION_EMAIL = os.environ.get("STORE_NOTIFICATION_EMAIL", "")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@ecoandes.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin123!")

FREE_SHIPPING_THRESHOLD = float(os.environ.get("FREE_SHIPPING_THRESHOLD", "50"))
SHIPPING_BASE = float(os.environ.get("SHIPPING_BASE", "6.5"))
SHIPPING_PROFESSIONAL = float(os.environ.get("SHIPPING_PROFESSIONAL", "4.5"))

# ECOBONUS: 5€ off on the FIRST order, minimum 60€ subtotal. Stacks with free shipping.
COUPON_CODE = os.environ.get("COUPON_CODE", "ECOBONUS")
COUPON_DISCOUNT = float(os.environ.get("COUPON_DISCOUNT", "5"))
COUPON_MIN_SUBTOTAL = float(os.environ.get("COUPON_MIN_SUBTOTAL", "60"))
