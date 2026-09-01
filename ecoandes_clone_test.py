"""EcoAndes Clone E2E Backend Tests - Specific requirements from review request."""
import requests
import sys
from typing import Dict, List, Optional

BASE_URL = "https://eco-andes-test.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@ecoandes.com"
ADMIN_PASSWORD = "Admin123!"


class TestRunner:
    def __init__(self):
        self.token: Optional[str] = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures: List[Dict] = []

    def test(self, name: str, method: str, endpoint: str, expected_status: int, 
             data: Optional[dict] = None, params: Optional[dict] = None, 
             auth: bool = False, validate_fn=None) -> tuple:
        """Run a single test."""
        url = f"{BASE_URL}/{endpoint}"
        headers = {"Content-Type": "application/json"}
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")

        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=20)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=20)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                if validate_fn:
                    try:
                        resp_data = response.json() if response.text else {}
                        validation_result = validate_fn(resp_data)
                        if not validation_result:
                            success = False
                            print(f"❌ FAILED - Validation failed")
                            self.failures.append({
                                "test": name,
                                "reason": "Validation failed",
                                "endpoint": endpoint
                            })
                    except Exception as e:
                        success = False
                        print(f"❌ FAILED - Validation error: {e}")
                        self.failures.append({
                            "test": name,
                            "reason": f"Validation error: {e}",
                            "endpoint": endpoint
                        })
                
                if success:
                    self.tests_passed += 1
                    print(f"✅ PASSED - Status: {response.status_code}")
                    return True, response.json() if response.text and response.headers.get('content-type', '').startswith('application/json') else {}
                else:
                    self.tests_failed += 1
                    return False, {}
            else:
                self.tests_failed += 1
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Response: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failures.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            self.tests_failed += 1
            print(f"❌ FAILED - Error: {str(e)}")
            self.failures.append({
                "test": name,
                "reason": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Total tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failures:
            print("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failures, 1):
                print(f"\n{i}. {failure['test']}")
                print(f"   Endpoint: {failure.get('endpoint', 'N/A')}")
                if 'expected' in failure:
                    print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                if 'reason' in failure:
                    print(f"   Reason: {failure['reason']}")
        print("="*60)


def main():
    runner = TestRunner()

    print("\n" + "="*60)
    print("🧪 ECOANDES CLONE E2E BACKEND TESTS")
    print("="*60)

    # Test 1: GET /api/products returns ~174 products
    print("\n" + "="*60)
    print("📦 PRODUCTS CATALOG")
    print("="*60)
    
    def validate_products_list(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        count = len(data)
        print(f"   ✓ Total products: {count}")
        if count < 170 or count > 180:
            print(f"   ⚠️  Expected ~174 products, got {count}")
            return False
        
        # Check first product has required fields
        if count > 0:
            p = data[0]
            required = ['id', 'name', 'slug', 'display_price', 'display_price_ex_vat', 'vat_rate']
            missing = [f for f in required if f not in p]
            if missing:
                print(f"   ⚠️  Missing fields in product: {missing}")
                return False
            print(f"   ✓ Sample product: {p['name']}")
            print(f"   ✓ display_price: {p['display_price']}€")
            print(f"   ✓ display_price_ex_vat: {p['display_price_ex_vat']}€")
            print(f"   ✓ vat_rate: {p['vat_rate']}%")
            
            # Check variations if present
            if 'variations' in p and p['variations']:
                v = p['variations'][0]
                print(f"   ✓ Variation: {v.get('format', 'N/A')}")
                if 'weight_kg' in v:
                    print(f"   ✓ weight_kg: {v['weight_kg']}")
                if 'ean' in v:
                    print(f"   ✓ ean: {v['ean']}")
        
        return True
    
    runner.test(
        "GET /api/products (174 products with pricing)",
        "GET",
        "products",
        200,
        params={"limit": 200},
        validate_fn=validate_products_list
    )

    # Test 2: GET /api/products/slug/cacao-nibs-criollo-bio
    def validate_product_detail(data):
        if not isinstance(data, dict):
            return False
        print(f"   ✓ Product: {data.get('name', 'N/A')}")
        print(f"   ✓ Slug: {data.get('slug', 'N/A')}")
        print(f"   ✓ Price: {data.get('display_price', 'N/A')}€")
        return True
    
    runner.test(
        "GET /api/products/slug/cacao-nibs-criollo-bio",
        "GET",
        "products/slug/cacao-nibs-criollo-bio",
        200,
        validate_fn=validate_product_detail
    )

    # Test 3: GET /api/products/categories?lang=es
    def validate_categories(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        print(f"   ✓ Categories count: {len(data)}")
        if len(data) > 0:
            cat = data[0]
            print(f"   ✓ Sample category: {cat.get('label', 'N/A')} (value: {cat.get('value', 'N/A')})")
        return len(data) > 0
    
    runner.test(
        "GET /api/products/categories?lang=es",
        "GET",
        "products/categories",
        200,
        params={"lang": "es"},
        validate_fn=validate_categories
    )

    # Test 4: GET /api/hero returns 5 slides
    def validate_hero(data):
        if not isinstance(data, dict):
            return False
        slides = data.get('slides', [])
        print(f"   ✓ Hero slides: {len(slides)}")
        if len(slides) != 5:
            print(f"   ⚠️  Expected 5 slides, got {len(slides)}")
            return False
        
        # Check first slide
        if slides:
            s = slides[0]
            print(f"   ✓ First slide title: {s.get('h1', 'N/A')[:60]}")
            print(f"   ✓ First slide image: {s.get('image', 'N/A')}")
        
        return True
    
    runner.test(
        "GET /api/hero (5 slides)",
        "GET",
        "hero",
        200,
        validate_fn=validate_hero
    )
    
    # Test hero in EN
    runner.test(
        "GET /api/hero?lang=en (localized)",
        "GET",
        "hero",
        200,
        params={"lang": "en"}
    )

    # Test 5: Admin login
    print("\n" + "="*60)
    print("🔐 AUTHENTICATION")
    print("="*60)
    
    success, response = runner.test(
        "POST /api/auth/login (admin@ecoandes.com)",
        "POST",
        "auth/login",
        200,
        data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if success:
        if "token" in response:
            runner.token = response["token"]
            print(f"   ✓ Token obtained")
        elif "access_token" in response:
            runner.token = response["access_token"]
            print(f"   ✓ Token obtained")

    # Test 6: Register new retail user
    import time
    test_email = f"retail_{int(time.time())}@test.com"
    
    def validate_register(data):
        if not isinstance(data, dict):
            return False
        print(f"   ✓ User registered: {data.get('email', 'N/A')}")
        print(f"   ✓ Role: {data.get('role', 'N/A')}")
        return True
    
    success, user_data = runner.test(
        "POST /api/auth/register (new retail user)",
        "POST",
        "auth/register",
        200,
        data={
            "email": test_email,
            "password": "Test123!",
            "first_name": "Test",
            "last_name": "User",
            "role": "retail"
        },
        validate_fn=validate_register
    )
    
    # Login with new user
    if success:
        runner.test(
            "POST /api/auth/login (new retail user)",
            "POST",
            "auth/login",
            200,
            data={"email": test_email, "password": "Test123!"}
        )

    # Test 7: Shipping quote - ES peninsular
    print("\n" + "="*60)
    print("🚚 SHIPPING QUOTES")
    print("="*60)
    
    def validate_shipping_below_50(data):
        if not isinstance(data, dict):
            return False
        print(f"   ✓ Subtotal: 40€")
        print(f"   ✓ Shipping cost: {data.get('shipping_cost', 'N/A')}€")
        print(f"   ✓ Free shipping: {data.get('free_shipping', False)}")
        if data.get('shipping_cost') != 4.99:
            print(f"   ⚠️  Expected 4.99€ shipping for <50€")
            return False
        return True
    
    runner.test(
        "POST /api/orders/shipping-quote (ES, 40€ -> 4.99€)",
        "POST",
        "orders/shipping-quote",
        200,
        data={"subtotal": 40.0, "customer_type": "retail"},
        validate_fn=validate_shipping_below_50
    )
    
    def validate_shipping_free(data):
        if not isinstance(data, dict):
            return False
        print(f"   ✓ Subtotal: 60€")
        print(f"   ✓ Shipping cost: {data.get('shipping_cost', 'N/A')}€")
        print(f"   ✓ Free shipping: {data.get('free_shipping', False)}")
        if data.get('shipping_cost') != 0:
            print(f"   ⚠️  Expected free shipping for >=50€")
            return False
        return True
    
    runner.test(
        "POST /api/orders/shipping-quote (ES, 60€ -> free)",
        "POST",
        "orders/shipping-quote",
        200,
        data={"subtotal": 60.0, "customer_type": "retail"},
        validate_fn=validate_shipping_free
    )

    # Test 8: GET /api/orders/shipping-config (public)
    def validate_shipping_config(data):
        if not isinstance(data, dict):
            return False
        print(f"   ✓ Shipping config retrieved")
        if 'rules' in data:
            print(f"   ✓ Rules count: {len(data['rules'])}")
        return True
    
    runner.test(
        "GET /api/orders/shipping-config (public)",
        "GET",
        "orders/shipping-config",
        200,
        validate_fn=validate_shipping_config
    )

    # Test 9: ECOBONUS coupon validation
    print("\n" + "="*60)
    print("🎟️  COUPON VALIDATION")
    print("="*60)
    
    test_coupon_email = f"coupon_{int(time.time())}@test.com"
    
    def validate_coupon_valid(data):
        if not isinstance(data, dict):
            return False
        if not data.get('valid'):
            print(f"   ⚠️  Coupon should be valid")
            return False
        if data.get('discount') != 5.0:
            print(f"   ⚠️  Expected 5€ discount")
            return False
        print(f"   ✓ Coupon valid: -5€ discount")
        return True
    
    runner.test(
        "POST /api/orders/validate-coupon (ECOBONUS, 65€, first order)",
        "POST",
        "orders/validate-coupon",
        200,
        data={"code": "ECOBONUS", "email": test_coupon_email, "subtotal": 65.0},
        validate_fn=validate_coupon_valid
    )
    
    def validate_coupon_min(data):
        if not isinstance(data, dict):
            return False
        if data.get('valid'):
            print(f"   ⚠️  Coupon should be invalid for <60€")
            return False
        print(f"   ✓ Coupon rejected: {data.get('message', 'N/A')}")
        return True
    
    runner.test(
        "POST /api/orders/validate-coupon (ECOBONUS, 50€ -> invalid)",
        "POST",
        "orders/validate-coupon",
        200,
        data={"code": "ECOBONUS", "email": test_coupon_email, "subtotal": 50.0},
        validate_fn=validate_coupon_min
    )

    runner.print_summary()
    return 0 if runner.tests_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
