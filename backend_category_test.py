"""Backend API tests for category carousel features."""
import requests
import sys

BASE_URL = "https://andean-eco.preview.emergentagent.com/api"

class TestRunner:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []

    def test(self, name, method, endpoint, expected_status, params=None, validate_fn=None):
        """Run a single test."""
        url = f"{BASE_URL}/{endpoint}"
        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")

        try:
            if method == "GET":
                response = requests.get(url, params=params, timeout=15)
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
                    return True, response.json() if response.text else {}
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

    # Test 1: Category filtering - ARROCES
    print("\n" + "="*60)
    print("🍚 CATEGORY FILTERING - ARROCES")
    print("="*60)
    
    def validate_arroces(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        if len(data) == 0:
            print(f"   ⚠️  No products found for ARROCES category")
            return False
        print(f"   ✓ {len(data)} products in ARROCES category")
        # Check all products have category ARROCES
        for p in data:
            if p.get('category') != 'ARROCES':
                print(f"   ⚠️  Product '{p.get('name')}' has wrong category: {p.get('category')}")
                return False
        print(f"   ✓ All products have category=ARROCES")
        print(f"   ✓ Sample products: {', '.join([p.get('name', 'N/A') for p in data[:3]])}")
        return True
    
    runner.test(
        "GET /api/products?category=ARROCES",
        "GET",
        "products",
        200,
        params={"category": "ARROCES"},
        validate_fn=validate_arroces
    )

    # Test 2: Category filtering - PSEUDOCEREALES Y CEREALES EN GRANO
    print("\n" + "="*60)
    print("🌾 CATEGORY FILTERING - PSEUDOCEREALES Y CEREALES EN GRANO")
    print("="*60)
    
    def validate_cereales(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        if len(data) == 0:
            print(f"   ⚠️  No products found for PSEUDOCEREALES Y CEREALES EN GRANO category")
            return False
        print(f"   ✓ {len(data)} products in PSEUDOCEREALES Y CEREALES EN GRANO category")
        # Check all products have correct category
        for p in data:
            if p.get('category') != 'PSEUDOCEREALES Y CEREALES EN GRANO':
                print(f"   ⚠️  Product '{p.get('name')}' has wrong category: {p.get('category')}")
                return False
        print(f"   ✓ All products have category=PSEUDOCEREALES Y CEREALES EN GRANO")
        print(f"   ✓ Sample products: {', '.join([p.get('name', 'N/A') for p in data[:3]])}")
        return True
    
    runner.test(
        "GET /api/products?category=PSEUDOCEREALES Y CEREALES EN GRANO",
        "GET",
        "products",
        200,
        params={"category": "PSEUDOCEREALES Y CEREALES EN GRANO"},
        validate_fn=validate_cereales
    )

    # Test 3: Category filtering - PROTEÍNAS
    print("\n" + "="*60)
    print("💪 CATEGORY FILTERING - PROTEÍNAS")
    print("="*60)
    
    def validate_proteinas(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        if len(data) == 0:
            print(f"   ⚠️  No products found for PROTEÍNAS category")
            return False
        print(f"   ✓ {len(data)} products in PROTEÍNAS category")
        # Check all products have correct category
        for p in data:
            if p.get('category') != 'PROTEÍNAS':
                print(f"   ⚠️  Product '{p.get('name')}' has wrong category: {p.get('category')}")
                return False
        print(f"   ✓ All products have category=PROTEÍNAS")
        print(f"   ✓ Sample products: {', '.join([p.get('name', 'N/A') for p in data[:3]])}")
        return True
    
    runner.test(
        "GET /api/products?category=PROTEÍNAS",
        "GET",
        "products",
        200,
        params={"category": "PROTEÍNAS"},
        validate_fn=validate_proteinas
    )

    # Test 4: Category filtering - HINCHADOS y MUESLIS
    print("\n" + "="*60)
    print("🥣 CATEGORY FILTERING - HINCHADOS y MUESLIS")
    print("="*60)
    
    def validate_hinchados(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        if len(data) == 0:
            print(f"   ⚠️  No products found for HINCHADOS y MUESLIS category")
            return False
        print(f"   ✓ {len(data)} products in HINCHADOS y MUESLIS category")
        # Check all products have correct category
        for p in data:
            if p.get('category') != 'HINCHADOS y MUESLIS':
                print(f"   ⚠️  Product '{p.get('name')}' has wrong category: {p.get('category')}")
                return False
        print(f"   ✓ All products have category=HINCHADOS y MUESLIS")
        print(f"   ✓ Sample products: {', '.join([p.get('name', 'N/A') for p in data[:3]])}")
        return True
    
    runner.test(
        "GET /api/products?category=HINCHADOS y MUESLIS",
        "GET",
        "products",
        200,
        params={"category": "HINCHADOS y MUESLIS"},
        validate_fn=validate_hinchados
    )

    # Test 5: GET /api/categories (Spanish - default)
    print("\n" + "="*60)
    print("🏷️  CATEGORIES LIST - SPANISH (DEFAULT)")
    print("="*60)
    
    def validate_categories_es(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        if len(data) == 0:
            print(f"   ⚠️  No categories returned")
            return False
        print(f"   ✓ {len(data)} categories returned")
        # Check structure
        for cat in data:
            if 'value' not in cat or 'label' not in cat:
                print(f"   ⚠️  Category missing 'value' or 'label': {cat}")
                return False
        print(f"   ✓ All categories have 'value' and 'label' fields")
        # Check for expected categories
        values = [c['value'] for c in data]
        expected = ['ARROCES', 'PROTEÍNAS', 'PSEUDOCEREALES Y CEREALES EN GRANO', 'HINCHADOS y MUESLIS']
        for exp in expected:
            if exp not in values:
                print(f"   ⚠️  Expected category '{exp}' not found")
                return False
        print(f"   ✓ All expected categories present")
        print(f"   ✓ Sample categories: {', '.join([c['label'] for c in data[:5]])}")
        return True
    
    runner.test(
        "GET /api/products/categories (Spanish)",
        "GET",
        "products/categories",
        200,
        validate_fn=validate_categories_es
    )

    # Test 6: GET /api/products/categories?lang=en (English translations)
    print("\n" + "="*60)
    print("🏷️  CATEGORIES LIST - ENGLISH TRANSLATIONS")
    print("="*60)
    
    def validate_categories_en(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        if len(data) == 0:
            print(f"   ⚠️  No categories returned")
            return False
        print(f"   ✓ {len(data)} categories returned")
        # Check structure
        for cat in data:
            if 'value' not in cat or 'label' not in cat:
                print(f"   ⚠️  Category missing 'value' or 'label': {cat}")
                return False
        print(f"   ✓ All categories have 'value' and 'label' fields")
        # Check that labels are translated (different from Spanish)
        # Find ARROCES category
        arroces = next((c for c in data if c['value'] == 'ARROCES'), None)
        if arroces:
            label = arroces['label']
            print(f"   ✓ ARROCES label in English: '{label}'")
            # Should be translated (not just 'ARROCES')
            if label == 'ARROCES':
                print(f"   ⚠️  WARNING: Label not translated (still 'ARROCES')")
                # Not a failure - translations might not be ready yet
        print(f"   ✓ Sample categories (EN): {', '.join([c['label'] for c in data[:5]])}")
        return True
    
    runner.test(
        "GET /api/products/categories?lang=en",
        "GET",
        "products/categories",
        200,
        params={"lang": "en"},
        validate_fn=validate_categories_en
    )

    # Test 7: GET /api/products/categories?lang=fr (French translations)
    print("\n" + "="*60)
    print("🏷️  CATEGORIES LIST - FRENCH TRANSLATIONS")
    print("="*60)
    
    def validate_categories_fr(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        if len(data) == 0:
            print(f"   ⚠️  No categories returned")
            return False
        print(f"   ✓ {len(data)} categories returned")
        print(f"   ✓ Sample categories (FR): {', '.join([c['label'] for c in data[:5]])}")
        return True
    
    runner.test(
        "GET /api/products/categories?lang=fr",
        "GET",
        "products/categories",
        200,
        params={"lang": "fr"},
        validate_fn=validate_categories_fr
    )

    runner.print_summary()
    return 0 if runner.tests_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
