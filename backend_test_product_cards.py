"""Backend API tests for Product Card Redesign (Quick Buy + Reviews)."""
import requests
import sys

class ProductCardAPITester:
    def __init__(self, base_url="https://eco-andes-test.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:300]}")

            return success, response.json() if response.text and response.status_code < 500 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_products_have_ratings_and_variations(self):
        """Test GET /api/products?limit=5 - verify web_rating >= 4, web_reviews >= 11, variations have display_price"""
        print("\n" + "="*70)
        print("TEST 1: PRODUCTS HAVE RATINGS AND VARIATIONS WITH DISPLAY_PRICE")
        print("="*70)
        
        success, products = self.run_test(
            "Get Products with limit=5",
            "GET",
            "/api/products?limit=5",
            200
        )
        
        if not success or not isinstance(products, list):
            print("❌ Failed to get products list")
            return False
        
        if len(products) == 0:
            print("❌ No products returned")
            return False
        
        print(f"\n📊 Checking {len(products)} products...")
        all_valid = True
        
        for i, product in enumerate(products, 1):
            print(f"\n  Product {i}: {product.get('name', 'Unknown')[:50]}")
            print(f"    ID: {product.get('id')}")
            
            # Check web_rating
            web_rating = product.get('web_rating', 0)
            print(f"    web_rating: {web_rating}")
            if web_rating < 4:
                print(f"    ❌ web_rating {web_rating} is less than 4")
                all_valid = False
            else:
                print(f"    ✅ web_rating >= 4")
            
            # Check web_reviews
            web_reviews = product.get('web_reviews', 0)
            print(f"    web_reviews: {web_reviews}")
            if web_reviews < 11:
                print(f"    ❌ web_reviews {web_reviews} is less than 11")
                all_valid = False
            else:
                print(f"    ✅ web_reviews >= 11")
            
            # Check variations have display_price
            variations = product.get('variations', [])
            print(f"    variations count: {len(variations)}")
            if len(variations) > 0:
                for j, var in enumerate(variations[:3], 1):  # Check first 3
                    display_price = var.get('display_price')
                    print(f"      Variation {j} ({var.get('name', 'Unknown')}): display_price = {display_price}")
                    if display_price is None:
                        print(f"      ❌ Variation missing display_price")
                        all_valid = False
                    else:
                        print(f"      ✅ Has display_price")
            else:
                # Check if product itself has display_price
                display_price = product.get('display_price')
                print(f"    No variations, product display_price: {display_price}")
        
        if all_valid:
            print("\n✅ All products have valid ratings and variations")
        else:
            print("\n❌ Some products failed validation")
            self.failed_tests.append("Products validation: Some products missing required fields")
        
        return all_valid

    def test_product_reviews_endpoint(self):
        """Test GET /api/products/{id}/reviews - verify summary.count >= 11, items list, distribution"""
        print("\n" + "="*70)
        print("TEST 2: PRODUCT REVIEWS ENDPOINT")
        print("="*70)
        
        # First get a product ID
        success, products = self.run_test(
            "Get Products for review test",
            "GET",
            "/api/products?limit=3",
            200
        )
        
        if not success or not isinstance(products, list) or len(products) == 0:
            print("❌ Failed to get products for review test")
            return False
        
        product_id = products[0]['id']
        product_name = products[0].get('name', 'Unknown')
        print(f"\n📊 Testing reviews for product: {product_name}")
        print(f"   Product ID: {product_id}")
        
        success, response = self.run_test(
            f"Get Reviews for product {product_id}",
            "GET",
            f"/api/products/{product_id}/reviews",
            200
        )
        
        if not success:
            print("❌ Failed to get reviews")
            return False
        
        # Check response structure
        if 'summary' not in response:
            print("❌ Response missing 'summary' key")
            self.failed_tests.append("Reviews endpoint: Missing 'summary' key")
            return False
        
        if 'items' not in response:
            print("❌ Response missing 'items' key")
            self.failed_tests.append("Reviews endpoint: Missing 'items' key")
            return False
        
        summary = response['summary']
        items = response['items']
        
        print(f"\n  Summary:")
        print(f"    count: {summary.get('count', 0)}")
        print(f"    average: {summary.get('average', 0)}")
        print(f"    distribution: {summary.get('distribution', {})}")
        
        # Check count >= 11
        count = summary.get('count', 0)
        if count < 11:
            print(f"  ❌ Review count {count} is less than 11")
            self.failed_tests.append(f"Reviews count: {count} < 11")
            return False
        else:
            print(f"  ✅ Review count >= 11")
        
        # Check items list is non-empty
        if not isinstance(items, list) or len(items) == 0:
            print(f"  ❌ Items list is empty or invalid")
            self.failed_tests.append("Reviews items: Empty or invalid list")
            return False
        else:
            print(f"  ✅ Items list has {len(items)} reviews")
        
        # Check first few items have required fields
        print(f"\n  Checking first 3 reviews:")
        for i, item in enumerate(items[:3], 1):
            print(f"    Review {i}:")
            print(f"      user_name: {item.get('user_name', 'MISSING')}")
            print(f"      rating: {item.get('rating', 'MISSING')}")
            print(f"      comment: {item.get('comment', 'None')[:50] if item.get('comment') else 'None'}")
            
            if not item.get('user_name'):
                print(f"      ❌ Missing user_name")
                self.failed_tests.append(f"Review {i}: Missing user_name")
                return False
            if not item.get('rating'):
                print(f"      ❌ Missing rating")
                self.failed_tests.append(f"Review {i}: Missing rating")
                return False
        
        # Check distribution (should be mostly 5-star)
        distribution = summary.get('distribution', {})
        five_star = distribution.get(5, 0) if isinstance(distribution, dict) else distribution.get('5', 0)
        four_star = distribution.get(4, 0) if isinstance(distribution, dict) else distribution.get('4', 0)
        total_reviews = five_star + four_star
        
        if total_reviews > 0:
            five_star_pct = (five_star / total_reviews) * 100
            print(f"\n  Distribution analysis:")
            print(f"    5-star: {five_star} ({five_star_pct:.1f}%)")
            print(f"    4-star: {four_star}")
            
            if five_star_pct >= 90:
                print(f"  ✅ Mostly 5-star reviews (>90%)")
            else:
                print(f"  ⚠️  5-star percentage is {five_star_pct:.1f}% (expected ~97%)")
        
        print("\n✅ Reviews endpoint validation passed")
        return True

def main():
    print("\n" + "="*70)
    print("ECOANDES PRODUCT CARD REDESIGN - BACKEND API TESTS")
    print("="*70)
    
    tester = ProductCardAPITester()
    
    # Run tests
    test1_passed = tester.test_products_have_ratings_and_variations()
    test2_passed = tester.test_product_reviews_endpoint()
    
    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    
    if tester.failed_tests:
        print("\n❌ Failed tests:")
        for failure in tester.failed_tests:
            print(f"  - {failure}")
    
    if tester.tests_passed == tester.tests_run:
        print("\n✅ ALL BACKEND TESTS PASSED")
        return 0
    else:
        print("\n❌ SOME BACKEND TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
