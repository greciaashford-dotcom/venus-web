#!/usr/bin/env python3
"""
EcoAndes Backend Smoke Tests
Tests all major backend endpoints after repository restoration.
"""
import requests
import sys
import json
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://green-andes.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@ecoandes.com"
ADMIN_PASSWORD = "Admin123!"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.tests = []
    
    def add_pass(self, name: str, details: str = ""):
        self.passed += 1
        self.tests.append({"name": name, "status": "PASS", "details": details})
        print(f"{GREEN}✓{RESET} {name}")
        if details:
            print(f"  {details}")
    
    def add_fail(self, name: str, error: str):
        self.failed += 1
        self.tests.append({"name": name, "status": "FAIL", "error": error})
        print(f"{RED}✗{RESET} {name}")
        print(f"  {RED}Error: {error}{RESET}")
    
    def add_warning(self, name: str, warning: str):
        self.warnings += 1
        self.tests.append({"name": name, "status": "WARNING", "warning": warning})
        print(f"{YELLOW}⚠{RESET} {name}")
        print(f"  {YELLOW}Warning: {warning}{RESET}")
    
    def summary(self):
        total = self.passed + self.failed + self.warnings
        print(f"\n{'='*60}")
        print(f"Test Summary:")
        print(f"  Total: {total}")
        print(f"  {GREEN}Passed: {self.passed}{RESET}")
        print(f"  {RED}Failed: {self.failed}{RESET}")
        print(f"  {YELLOW}Warnings: {self.warnings}{RESET}")
        print(f"{'='*60}\n")
        return self.failed == 0

results = TestResults()

def test_health():
    """Test 1: GET /api/health"""
    print(f"\n{BLUE}[Test 1]{RESET} Health Check")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ok":
                results.add_pass("GET /api/health", f"Status: {data.get('status')}, Timestamp: {data.get('ts')}")
            else:
                results.add_fail("GET /api/health", f"Unexpected status: {data.get('status')}")
        else:
            results.add_fail("GET /api/health", f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        results.add_fail("GET /api/health", str(e))

def test_products_list():
    """Test 2: GET /api/products (should return ~174 products)"""
    print(f"\n{BLUE}[Test 2]{RESET} Products List")
    try:
        # Test with limit=200 to get all products
        response = requests.get(f"{BASE_URL}/products", params={"limit": 200}, timeout=10)
        if response.status_code == 200:
            products = response.json()
            count = len(products)
            if count >= 170 and count <= 180:
                # Check product structure
                if products and isinstance(products[0], dict):
                    sample = products[0]
                    has_variations = "variations" in sample
                    has_price = "display_price" in sample
                    results.add_pass(
                        "GET /api/products",
                        f"Found {count} products. Sample has variations: {has_variations}, display_price: {has_price}"
                    )
                    return products  # Return for use in other tests
                else:
                    results.add_fail("GET /api/products", "Products list is empty or malformed")
            else:
                results.add_warning(
                    "GET /api/products",
                    f"Expected ~174 products, got {count}"
                )
                return products
        else:
            results.add_fail("GET /api/products", f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        results.add_fail("GET /api/products", str(e))
    return []

def test_products_filters(products):
    """Test 3: GET /api/products with category filter and search"""
    print(f"\n{BLUE}[Test 3]{RESET} Products Filters")
    
    # Test category filter
    try:
        response = requests.get(
            f"{BASE_URL}/products",
            params={"category": "CACAO Y DERIVADOS"},
            timeout=10
        )
        if response.status_code == 200:
            filtered = response.json()
            if len(filtered) > 0:
                results.add_pass(
                    "GET /api/products?category=CACAO Y DERIVADOS",
                    f"Found {len(filtered)} products in category"
                )
            else:
                results.add_warning(
                    "GET /api/products?category=CACAO Y DERIVADOS",
                    "No products found in this category"
                )
        else:
            results.add_fail(
                "GET /api/products?category=CACAO Y DERIVADOS",
                f"HTTP {response.status_code}"
            )
    except Exception as e:
        results.add_fail("GET /api/products?category=CACAO Y DERIVADOS", str(e))
    
    # Test search
    try:
        response = requests.get(
            f"{BASE_URL}/products",
            params={"q": "cacao", "limit": 200},
            timeout=10
        )
        if response.status_code == 200:
            search_results = response.json()
            if len(search_results) > 0:
                results.add_pass(
                    "GET /api/products?q=cacao",
                    f"Found {len(search_results)} products matching 'cacao'"
                )
            else:
                results.add_warning(
                    "GET /api/products?q=cacao",
                    "No products found for search term 'cacao'"
                )
        else:
            results.add_fail("GET /api/products?q=cacao", f"HTTP {response.status_code}")
    except Exception as e:
        results.add_fail("GET /api/products?q=cacao", str(e))

def test_product_detail(products):
    """Test 4: GET /api/products/slug/{slug}"""
    print(f"\n{BLUE}[Test 4]{RESET} Product Detail by Slug")
    
    if not products:
        results.add_fail("GET /api/products/slug/{slug}", "No products available to test")
        return None
    
    # Get first product's slug
    product = products[0]
    slug = product.get("slug")
    
    if not slug:
        results.add_fail("GET /api/products/slug/{slug}", "First product has no slug")
        return None
    
    try:
        response = requests.get(f"{BASE_URL}/products/slug/{slug}", timeout=10)
        if response.status_code == 200:
            detail = response.json()
            has_name = "name" in detail
            has_price = "display_price" in detail
            has_variations = "variations" in detail
            results.add_pass(
                f"GET /api/products/slug/{slug}",
                f"Product: {detail.get('name', 'N/A')}, has variations: {has_variations}"
            )
            return detail
        else:
            results.add_fail(
                f"GET /api/products/slug/{slug}",
                f"HTTP {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        results.add_fail(f"GET /api/products/slug/{slug}", str(e))
    return None

def test_hero():
    """Test 5: GET /api/hero (should return 5 slides)"""
    print(f"\n{BLUE}[Test 5]{RESET} Hero Slides")
    try:
        response = requests.get(f"{BASE_URL}/hero", timeout=10)
        if response.status_code == 200:
            data = response.json()
            slides = data.get("slides", [])
            if len(slides) == 5:
                # Check that images don't start with /api/files/
                invalid_images = []
                for i, slide in enumerate(slides):
                    img = slide.get("image", "")
                    if img.startswith("/api/files/"):
                        invalid_images.append(f"Slide {i+1}: {img}")
                
                if invalid_images:
                    results.add_fail(
                        "GET /api/hero",
                        f"Found {len(invalid_images)} slides with /api/files/ images (should be /hero/*.webp or external URLs)"
                    )
                else:
                    # Check image paths
                    sample_images = [s.get("image", "")[:50] for s in slides[:2]]
                    results.add_pass(
                        "GET /api/hero",
                        f"Found {len(slides)} slides. Sample images: {sample_images}"
                    )
            else:
                results.add_warning(
                    "GET /api/hero",
                    f"Expected 5 slides, got {len(slides)}"
                )
        else:
            results.add_fail("GET /api/hero", f"HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        results.add_fail("GET /api/hero", str(e))

def test_carousel_categories():
    """Test 6: GET /api/carousel-categories"""
    print(f"\n{BLUE}[Test 6]{RESET} Carousel Categories")
    try:
        response = requests.get(f"{BASE_URL}/carousel-categories", timeout=10)
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            if len(items) > 0:
                results.add_pass(
                    "GET /api/carousel-categories",
                    f"Found {len(items)} category items"
                )
            else:
                results.add_warning("GET /api/carousel-categories", "No category items found")
        else:
            results.add_fail("GET /api/carousel-categories", f"HTTP {response.status_code}")
    except Exception as e:
        results.add_fail("GET /api/carousel-categories", str(e))

def test_blog():
    """Test 7: GET /api/blog (should return 12 posts)"""
    print(f"\n{BLUE}[Test 7]{RESET} Blog Posts")
    try:
        response = requests.get(f"{BASE_URL}/blog", timeout=10)
        if response.status_code == 200:
            posts = response.json()
            count = len(posts)
            if count == 12:
                results.add_pass("GET /api/blog", f"Found {count} blog posts")
            elif count > 0:
                results.add_warning("GET /api/blog", f"Expected 12 posts, got {count}")
            else:
                results.add_fail("GET /api/blog", "No blog posts found")
        else:
            results.add_fail("GET /api/blog", f"HTTP {response.status_code}")
    except Exception as e:
        results.add_fail("GET /api/blog", str(e))

def test_legal_pages():
    """Test 8: GET /api/legal/{slug} for all legal pages"""
    print(f"\n{BLUE}[Test 8]{RESET} Legal Pages")
    
    legal_slugs = ["aviso-legal", "politica-cookies", "politica-privacidad", "condiciones"]
    
    for slug in legal_slugs:
        try:
            response = requests.get(f"{BASE_URL}/legal/{slug}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                title = data.get("title", "")
                sections = data.get("sections", [])
                results.add_pass(
                    f"GET /api/legal/{slug}",
                    f"Title: {title}, Sections: {len(sections)}"
                )
            else:
                results.add_fail(f"GET /api/legal/{slug}", f"HTTP {response.status_code}")
        except Exception as e:
            results.add_fail(f"GET /api/legal/{slug}", str(e))

def test_admin_login():
    """Test 9: POST /api/auth/login with admin credentials"""
    print(f"\n{BLUE}[Test 9]{RESET} Admin Login")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            user = data.get("user", {})
            if token and user.get("role") == "admin":
                results.add_pass(
                    "POST /api/auth/login (admin)",
                    f"Admin: {user.get('email')}, Role: {user.get('role')}"
                )
                return token
            else:
                results.add_fail(
                    "POST /api/auth/login (admin)",
                    "Missing token or incorrect role"
                )
        else:
            results.add_fail(
                "POST /api/auth/login (admin)",
                f"HTTP {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        results.add_fail("POST /api/auth/login (admin)", str(e))
    return None

def test_user_registration_and_login():
    """Test 10: Register a retail user and login"""
    print(f"\n{BLUE}[Test 10]{RESET} User Registration and Login")
    
    # Generate unique email
    import time
    timestamp = int(time.time())
    test_email = f"test.user.{timestamp}@ecoandes-test.com"
    test_password = "TestUser123!"
    
    # Register
    try:
        register_payload = {
            "email": test_email,
            "password": test_password,
            "first_name": "María",
            "last_name": "García",
            "role": "retail",
            "company": None,
            "tax_id": None,
            "business_type": None,
            "phone": "+34612345678"
        }
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=register_payload,
            timeout=10
        )
        if response.status_code == 200:
            user_data = response.json()
            results.add_pass(
                "POST /api/auth/register (retail)",
                f"User: {user_data.get('email')}, Role: {user_data.get('role')}"
            )
        else:
            results.add_fail(
                "POST /api/auth/register (retail)",
                f"HTTP {response.status_code}: {response.text[:200]}"
            )
            return None
    except Exception as e:
        results.add_fail("POST /api/auth/register (retail)", str(e))
        return None
    
    # Login with new user
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": test_email, "password": test_password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            user = data.get("user", {})
            if token and user.get("email") == test_email:
                results.add_pass(
                    "POST /api/auth/login (retail user)",
                    f"User: {user.get('email')}, Token received"
                )
                return token
            else:
                results.add_fail(
                    "POST /api/auth/login (retail user)",
                    "Missing token or email mismatch"
                )
        else:
            results.add_fail(
                "POST /api/auth/login (retail user)",
                f"HTTP {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        results.add_fail("POST /api/auth/login (retail user)", str(e))
    return None

def test_cart_tracking():
    """Test 11: POST /api/cart/track"""
    print(f"\n{BLUE}[Test 11]{RESET} Cart Tracking")
    
    import uuid
    cart_id = str(uuid.uuid4())
    
    try:
        cart_payload = {
            "cart_id": cart_id,
            "email": "test.cart@ecoandes.com",
            "items": [
                {
                    "product_id": "test-product-id",
                    "name": "Cacao Nibs Bio 250g",
                    "variation_name": "250g",
                    "quantity": 2,
                    "unit_price": 8.50,
                    "image_url": "https://example.com/cacao.jpg"
                }
            ],
            "subtotal": 17.00
        }
        response = requests.post(
            f"{BASE_URL}/cart/track",
            json=cart_payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("status") == "active":
                results.add_pass(
                    "POST /api/cart/track",
                    f"Cart tracked successfully, status: {data.get('status')}"
                )
            else:
                results.add_fail(
                    "POST /api/cart/track",
                    f"Unexpected response: {data}"
                )
        else:
            results.add_fail(
                "POST /api/cart/track",
                f"HTTP {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        results.add_fail("POST /api/cart/track", str(e))

def test_shipping_calculation():
    """Test 12: POST /api/orders/shipping-quote"""
    print(f"\n{BLUE}[Test 12]{RESET} Shipping Calculation")
    
    # Test 1: Free shipping (over 50€)
    try:
        shipping_payload = {
            "customer_type": "retail",
            "country": "España",
            "postal_code": "28001",
            "subtotal_with_vat": 60.00,
            "subtotal_ex_vat": 54.55,
            "total_weight_kg": 2.5,
            "has_bulk": False,
            "bulk_weight_kg": 0.0
        }
        response = requests.post(
            f"{BASE_URL}/orders/shipping-quote",
            json=shipping_payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            shipping_cost = data.get("shipping_cost", 0)
            if shipping_cost == 0:
                results.add_pass(
                    "POST /api/orders/shipping-quote (free shipping >50€)",
                    f"Shipping cost: {shipping_cost}€ (free shipping applied)"
                )
            else:
                results.add_warning(
                    "POST /api/orders/shipping-quote (free shipping >50€)",
                    f"Expected 0€, got {shipping_cost}€"
                )
        else:
            results.add_fail(
                "POST /api/orders/shipping-quote (free shipping)",
                f"HTTP {response.status_code}"
            )
    except Exception as e:
        results.add_fail("POST /api/orders/shipping-quote (free shipping)", str(e))
    
    # Test 2: Base shipping (under 50€)
    try:
        shipping_payload = {
            "customer_type": "retail",
            "country": "España",
            "postal_code": "28001",
            "subtotal_with_vat": 30.00,
            "subtotal_ex_vat": 27.27,
            "total_weight_kg": 1.5,
            "has_bulk": False,
            "bulk_weight_kg": 0.0
        }
        response = requests.post(
            f"{BASE_URL}/orders/shipping-quote",
            json=shipping_payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            shipping_cost = data.get("shipping_cost", 0)
            # Base shipping should be around 6.5€ + VAT
            if shipping_cost > 0:
                results.add_pass(
                    "POST /api/orders/shipping-quote (base shipping <50€)",
                    f"Shipping cost: {shipping_cost}€"
                )
            else:
                results.add_warning(
                    "POST /api/orders/shipping-quote (base shipping)",
                    f"Expected >0€, got {shipping_cost}€"
                )
        else:
            results.add_fail(
                "POST /api/orders/shipping-quote (base shipping)",
                f"HTTP {response.status_code}"
            )
    except Exception as e:
        results.add_fail("POST /api/orders/shipping-quote (base shipping)", str(e))

def main():
    print(f"\n{'='*60}")
    print(f"EcoAndes Backend Smoke Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"{'='*60}")
    
    # Run all tests
    test_health()
    products = test_products_list()
    test_products_filters(products)
    product_detail = test_product_detail(products)
    test_hero()
    test_carousel_categories()
    test_blog()
    test_legal_pages()
    admin_token = test_admin_login()
    user_token = test_user_registration_and_login()
    test_cart_tracking()
    test_shipping_calculation()
    
    # Summary
    success = results.summary()
    
    # Exit code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
