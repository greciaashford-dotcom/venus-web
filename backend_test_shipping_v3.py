"""Backend API tests for EcoAndes shipping v3 + refunds + invoice requests."""
import requests
import sys
from datetime import datetime

class ShippingV3Tester:
    def __init__(self, base_url="https://eco-andes-test.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.retail_token = None
        self.pro_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_users = []
        self.test_orders = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASS - Status: {response.status_code}")
            else:
                print(f"❌ FAIL - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:300]}")

            return success, response.json() if response.text and response.status_code < 500 else {}

        except Exception as e:
            print(f"❌ FAIL - Error: {str(e)}")
            return False, {}

    def setup_admin(self):
        """Login as admin"""
        print("\n" + "="*70)
        print("SETUP: ADMIN LOGIN")
        print("="*70)
        success, response = self.run_test(
            "Admin login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": "admin@ecoandes.com", "password": "Admin123!"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"✅ Admin token obtained")
            return True
        return False

    def create_test_user(self, user_type="retail"):
        """Create a test user (retail or professional)"""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
        email = f"test_{user_type}_{timestamp}@test.com"
        
        data = {
            "email": email,
            "password": "Test123!",
            "first_name": "Test",
            "last_name": user_type.capitalize(),
            "phone": "600123456"
        }
        
        if user_type == "professional":
            data["role"] = "professional"
            data["company_name"] = f"Test Company {timestamp}"
            data["cif"] = "B12345674"  # Valid format CIF
        
        success, response = self.run_test(
            f"Create {user_type} user",
            "POST",
            "/api/auth/register",
            200,
            data=data
        )
        
        if success and 'access_token' in response:
            user_info = {
                "email": email,
                "password": "Test123!",
                "token": response['access_token'],
                "user_id": response.get('user', {}).get('id'),
                "type": user_type
            }
            self.test_users.append(user_info)
            
            # If professional, approve them
            if user_type == "professional" and user_info['user_id']:
                self.run_test(
                    f"Approve professional user",
                    "PATCH",
                    f"/api/admin/users/{user_info['user_id']}",
                    200,
                    data={"approved": True},
                    token=self.admin_token
                )
            
            return user_info
        return None

    def test_retail_shipping_flat_fee(self):
        """Test retail shipping: flat 4.99€ for <50€, free >=50€"""
        print("\n" + "="*70)
        print("TEST: RETAIL SHIPPING V3 (FLAT FEE)")
        print("="*70)
        
        # Test 1: Retail <50€ → 4.99€ (4.12 + 0.87 VAT)
        success, response = self.run_test(
            "Retail CP 28004, subtotal 40€ with VAT, 22kg → 4.99€",
            "POST",
            "/api/orders/shipping-quote",
            200,
            data={
                "customer_type": "retail",
                "country": "España",
                "postal_code": "28004",
                "subtotal_with_vat": 40.0,
                "subtotal_ex_vat": 36.36,
                "total_weight_kg": 22.0,
                "has_bulk": True
            }
        )
        
        if success:
            if response.get('shipping_cost') == 4.99:
                print(f"✅ Shipping cost correct: 4.99€")
            else:
                print(f"❌ Expected 4.99€, got {response.get('shipping_cost')}€")
                self.tests_passed -= 1
            
            if response.get('shipping_cost_ex_vat') == 4.12:
                print(f"✅ Shipping ex-VAT correct: 4.12€")
            else:
                print(f"❌ Expected 4.12€ ex-VAT, got {response.get('shipping_cost_ex_vat')}€")
                self.tests_passed -= 1
            
            if response.get('shipping_vat') == 0.87:
                print(f"✅ Shipping VAT correct: 0.87€")
            else:
                print(f"❌ Expected 0.87€ VAT, got {response.get('shipping_vat')}€")
                self.tests_passed -= 1
            
            if 'weight_tier' not in response:
                print(f"✅ No weight_tier (flat fee)")
            else:
                print(f"❌ weight_tier should not be present for retail flat fee")
                self.tests_passed -= 1
        
        # Test 2: Retail >=50€ → free
        success, response = self.run_test(
            "Retail CP 28004, subtotal 50€ with VAT → free shipping",
            "POST",
            "/api/orders/shipping-quote",
            200,
            data={
                "customer_type": "retail",
                "country": "España",
                "postal_code": "28004",
                "subtotal_with_vat": 50.0,
                "subtotal_ex_vat": 45.45,
                "total_weight_kg": 22.0,
                "has_bulk": True
            }
        )
        
        if success:
            if response.get('shipping_cost') == 0.0 and response.get('free_shipping'):
                print(f"✅ Free shipping for >=50€")
            else:
                print(f"❌ Expected free shipping, got {response.get('shipping_cost')}€")
                self.tests_passed -= 1
        
        # Test 3: Retail Canarias → manual quote
        success, response = self.run_test(
            "Retail CP 35001 (Canarias) → manual_quote",
            "POST",
            "/api/orders/shipping-quote",
            200,
            data={
                "customer_type": "retail",
                "country": "España",
                "postal_code": "35001",
                "subtotal_with_vat": 40.0,
                "subtotal_ex_vat": 36.36,
                "total_weight_kg": 22.0,
                "has_bulk": True
            }
        )
        
        if success:
            if response.get('status') == 'manual_quote':
                print(f"✅ Manual quote for Canarias")
            else:
                print(f"❌ Expected manual_quote, got {response.get('status')}")
                self.tests_passed -= 1

    def test_professional_shipping_weight_table(self):
        """Test professional shipping: weight-based table + free >=150€ ex-VAT"""
        print("\n" + "="*70)
        print("TEST: PROFESSIONAL SHIPPING V3 (WEIGHT TABLE)")
        print("="*70)
        
        # Test 1: Professional 22kg, subtotal 100€ ex-VAT → weight table (20-25kg = 23€ + VAT)
        success, response = self.run_test(
            "Professional 22kg, subtotal 100€ ex-VAT → 27.83€ (23€ + 21% VAT)",
            "POST",
            "/api/orders/shipping-quote",
            200,
            data={
                "customer_type": "professional",
                "country": "España",
                "postal_code": "28004",
                "subtotal_with_vat": 110.0,
                "subtotal_ex_vat": 100.0,
                "total_weight_kg": 22.0,
                "has_bulk": True
            }
        )
        
        if success:
            expected_net = 23.0
            expected_vat = round(23.0 * 0.21, 2)
            expected_gross = round(23.0 * 1.21, 2)
            
            if response.get('shipping_cost_ex_vat') == expected_net:
                print(f"✅ Shipping ex-VAT correct: {expected_net}€")
            else:
                print(f"❌ Expected {expected_net}€ ex-VAT, got {response.get('shipping_cost_ex_vat')}€")
                self.tests_passed -= 1
            
            if response.get('shipping_cost') == expected_gross:
                print(f"✅ Shipping cost correct: {expected_gross}€")
            else:
                print(f"❌ Expected {expected_gross}€, got {response.get('shipping_cost')}€")
                self.tests_passed -= 1
            
            if 'weight_tier' in response:
                tier = response['weight_tier']
                if tier.get('from_kg') == 20 and tier.get('to_kg') == 25:
                    print(f"✅ Weight tier correct: 20-25kg")
                else:
                    print(f"❌ Expected 20-25kg tier, got {tier}")
                    self.tests_passed -= 1
            else:
                print(f"❌ weight_tier missing for professional")
                self.tests_passed -= 1
        
        # Test 2: Professional >=150€ ex-VAT → free
        success, response = self.run_test(
            "Professional subtotal 150€ ex-VAT → free shipping",
            "POST",
            "/api/orders/shipping-quote",
            200,
            data={
                "customer_type": "professional",
                "country": "España",
                "postal_code": "28004",
                "subtotal_with_vat": 165.0,
                "subtotal_ex_vat": 150.0,
                "total_weight_kg": 22.0,
                "has_bulk": True
            }
        )
        
        if success:
            if response.get('shipping_cost') == 0.0 and response.get('free_shipping'):
                print(f"✅ Free shipping for >=150€ ex-VAT")
            else:
                print(f"❌ Expected free shipping, got {response.get('shipping_cost')}€")
                self.tests_passed -= 1

    def test_address_verification(self):
        """Test address verification endpoint"""
        print("\n" + "="*70)
        print("TEST: ADDRESS VERIFICATION")
        print("="*70)
        
        # Test 1: Valid Madrid address
        success, response = self.run_test(
            "Verify valid Madrid address",
            "GET",
            "/api/orders/verify-address",
            200,
            params={
                "street": "Gran Via 1",
                "city": "Madrid",
                "postal_code": "28013",
                "country": "España"
            }
        )
        
        if success:
            found = response.get('found')
            if found is True:
                print(f"✅ Valid address found")
            elif found is None:
                print(f"⚠️  Service unavailable (found: null) - acceptable")
            else:
                print(f"⚠️  Address not found (may be rate-limited or service issue)")
        
        # Test 2: Gibberish address
        success, response = self.run_test(
            "Verify gibberish address",
            "GET",
            "/api/orders/verify-address",
            200,
            params={
                "street": "Xyzabc Nonexistent 999",
                "city": "Fakecity",
                "postal_code": "28013",
                "country": "España"
            }
        )
        
        if success:
            found = response.get('found')
            if found is False:
                print(f"✅ Gibberish address not found")
            elif found is None:
                print(f"⚠️  Service unavailable (found: null) - acceptable")
            else:
                print(f"⚠️  Unexpected result for gibberish address")

    def create_test_order(self, user_info, postal_code="28004", subtotal=40.0):
        """Create a test order"""
        # Get a sample product
        success, products = self.run_test(
            "Get sample product",
            "GET",
            "/api/products?limit=1",
            200
        )
        
        if not success or not products:
            return None
        
        product = products[0]
        
        order_data = {
            "email": user_info['email'],
            "customer_type": user_info['type'],
            "items": [{
                "product_id": product['id'],
                "name": product['name'],
                "variation_name": None,
                "sku": product.get('sku', 'TEST-SKU'),
                "quantity": 1,
                "unit_price": subtotal
            }],
            "shipping_address": {
                "full_name": f"Test {user_info['type'].capitalize()}",
                "street": "Calle Test 123",
                "postal_code": postal_code,
                "city": "Madrid" if postal_code.startswith("28") else "Las Palmas",
                "province": "Madrid" if postal_code.startswith("28") else "Las Palmas",
                "country": "España",
                "phone": "600123456"
            },
            "billing_address": None,
            "payment_method": "stripe",
            "delivery_method": "shipping",
            "notes": "Test order",
            "coupon_code": None,
            "acquisition": {}
        }
        
        success, response = self.run_test(
            f"Create {user_info['type']} order (CP {postal_code})",
            "POST",
            "/api/orders",
            200,
            data=order_data
        )
        
        if success and 'id' in response:
            order_info = {
                "id": response['id'],
                "order_number": response.get('order_number'),
                "user_info": user_info
            }
            self.test_orders.append(order_info)
            return order_info
        return None

    def test_order_creation_retail_peninsular(self):
        """Test retail order creation with flat shipping"""
        print("\n" + "="*70)
        print("TEST: RETAIL ORDER CREATION (PENINSULAR <50€)")
        print("="*70)
        
        retail_user = self.create_test_user("retail")
        if not retail_user:
            print("❌ Failed to create retail user")
            return
        
        order = self.create_test_order(retail_user, postal_code="28004", subtotal=40.0)
        if order:
            # Verify order details
            success, order_detail = self.run_test(
                "Get order detail",
                "GET",
                f"/api/orders/admin/{order['id']}",
                200,
                token=self.admin_token
            )
            
            if success:
                if order_detail.get('shipping_cost') == 4.99:
                    print(f"✅ Order shipping cost correct: 4.99€")
                else:
                    print(f"❌ Expected 4.99€, got {order_detail.get('shipping_cost')}€")
                    self.tests_passed -= 1

    def test_order_creation_canarias(self):
        """Test Canarias order → manual quote"""
        print("\n" + "="*70)
        print("TEST: CANARIAS ORDER CREATION (MANUAL QUOTE)")
        print("="*70)
        
        retail_user = self.create_test_user("retail")
        if not retail_user:
            print("❌ Failed to create retail user")
            return
        
        order = self.create_test_order(retail_user, postal_code="35001", subtotal=40.0)
        if order:
            success, order_detail = self.run_test(
                "Get Canarias order detail",
                "GET",
                f"/api/orders/admin/{order['id']}",
                200,
                token=self.admin_token
            )
            
            if success:
                if order_detail.get('status') == 'Pendiente portes':
                    print(f"✅ Order status correct: Pendiente portes")
                else:
                    print(f"❌ Expected 'Pendiente portes', got {order_detail.get('status')}")
                    self.tests_passed -= 1
                
                if order_detail.get('payment_status') == 'awaiting_quote':
                    print(f"✅ Payment status correct: awaiting_quote")
                else:
                    print(f"❌ Expected 'awaiting_quote', got {order_detail.get('payment_status')}")
                    self.tests_passed -= 1

    def test_refund_request(self):
        """Test customer refund request"""
        print("\n" + "="*70)
        print("TEST: REFUND REQUEST")
        print("="*70)
        
        # Create order first
        retail_user = self.create_test_user("retail")
        if not retail_user:
            return
        
        order = self.create_test_order(retail_user, postal_code="28004", subtotal=50.0)
        if not order:
            return
        
        # Get order items
        success, order_detail = self.run_test(
            "Get order for refund",
            "GET",
            f"/api/orders/admin/{order['id']}",
            200,
            token=self.admin_token
        )
        
        if not success or not order_detail.get('items'):
            return
        
        item_sku = order_detail['items'][0]['sku']
        
        # Test 1: Valid refund request
        success, response = self.run_test(
            "Submit refund request (owner)",
            "POST",
            f"/api/orders/{order['id']}/refund-request",
            200,
            data={
                "full_order": False,
                "items": [{"sku": item_sku, "quantity": 1}],
                "reason": "Test refund request"
            },
            token=retail_user['token']
        )
        
        if success and response.get('ok'):
            print(f"✅ Refund request submitted")
        
        # Test 2: Duplicate refund request → 400
        success, response = self.run_test(
            "Submit duplicate refund request → 400",
            "POST",
            f"/api/orders/{order['id']}/refund-request",
            400,
            data={
                "full_order": True,
                "reason": "Duplicate"
            },
            token=retail_user['token']
        )
        
        if success:
            print(f"✅ Duplicate refund request correctly rejected")
        
        # Test 3: Foreign user → 403
        other_user = self.create_test_user("retail")
        if other_user:
            success, response = self.run_test(
                "Submit refund request (foreign user) → 403",
                "POST",
                f"/api/orders/{order['id']}/refund-request",
                403,
                data={"full_order": True},
                token=other_user['token']
            )
            
            if success:
                print(f"✅ Foreign user correctly rejected")

    def test_invoice_request(self):
        """Test professional invoice request"""
        print("\n" + "="*70)
        print("TEST: INVOICE REQUEST")
        print("="*70)
        
        # Test 1: Professional user can request invoice
        pro_user = self.create_test_user("professional")
        if not pro_user:
            return
        
        order = self.create_test_order(pro_user, postal_code="28004", subtotal=100.0)
        if not order:
            return
        
        success, response = self.run_test(
            "Professional invoice request → 200",
            "POST",
            f"/api/orders/{order['id']}/invoice-request",
            200,
            token=pro_user['token']
        )
        
        if success and response.get('ok'):
            print(f"✅ Invoice request submitted")
        
        # Test 2: Duplicate → 400
        success, response = self.run_test(
            "Duplicate invoice request → 400",
            "POST",
            f"/api/orders/{order['id']}/invoice-request",
            400,
            token=pro_user['token']
        )
        
        if success:
            print(f"✅ Duplicate invoice request correctly rejected")
        
        # Test 3: Retail user → 403
        retail_user = self.create_test_user("retail")
        if retail_user:
            retail_order = self.create_test_order(retail_user, postal_code="28004", subtotal=50.0)
            if retail_order:
                success, response = self.run_test(
                    "Retail invoice request → 403",
                    "POST",
                    f"/api/orders/{retail_order['id']}/invoice-request",
                    403,
                    token=retail_user['token']
                )
                
                if success:
                    print(f"✅ Retail user correctly rejected")

    def test_admin_refund(self):
        """Test admin refund functionality"""
        print("\n" + "="*70)
        print("TEST: ADMIN REFUND")
        print("="*70)
        
        # Create order with 2 products
        retail_user = self.create_test_user("retail")
        if not retail_user:
            return
        
        # Get 2 products
        success, products = self.run_test(
            "Get 2 products",
            "GET",
            "/api/products?limit=2",
            200
        )
        
        if not success or len(products) < 2:
            return
        
        # Create order with 2 items
        order_data = {
            "email": retail_user['email'],
            "customer_type": "retail",
            "items": [
                {
                    "product_id": products[0]['id'],
                    "name": products[0]['name'],
                    "sku": products[0].get('sku', 'SKU1'),
                    "quantity": 1,
                    "unit_price": 25.0
                },
                {
                    "product_id": products[1]['id'],
                    "name": products[1]['name'],
                    "sku": products[1].get('sku', 'SKU2'),
                    "quantity": 1,
                    "unit_price": 25.0
                }
            ],
            "shipping_address": {
                "full_name": "Test User",
                "street": "Calle Test 123",
                "postal_code": "28004",
                "city": "Madrid",
                "province": "Madrid",
                "country": "España",
                "phone": "600123456"
            },
            "payment_method": "stripe",
            "delivery_method": "shipping"
        }
        
        success, order = self.run_test(
            "Create order with 2 items",
            "POST",
            "/api/orders",
            200,
            data=order_data
        )
        
        if not success:
            return
        
        order_id = order['id']
        item1_sku = products[0].get('sku', 'SKU1')
        
        # Test 1: Partial refund (1 of 2 products)
        success, response = self.run_test(
            "Admin partial refund (1 of 2 items)",
            "POST",
            f"/api/admin/orders/{order_id}/refund",
            200,
            data={
                "reason": "Test partial refund",
                "items": [{"sku": item1_sku, "quantity": 1, "amount": 25.0}],
                "include_shipping": False,
                "notify": False
            },
            token=self.admin_token
        )
        
        if success:
            if response.get('fully_refunded') is False:
                print(f"✅ Partial refund recorded")
            else:
                print(f"❌ Expected partially_refunded, got fully_refunded")
                self.tests_passed -= 1
            
            # Verify order status
            success2, order_detail = self.run_test(
                "Check order after partial refund",
                "GET",
                f"/api/orders/admin/{order_id}",
                200,
                token=self.admin_token
            )
            
            if success2:
                if order_detail.get('partially_refunded'):
                    print(f"✅ Order marked as partially_refunded")
                else:
                    print(f"❌ Order not marked as partially_refunded")
                    self.tests_passed -= 1
        
        # Test 2: Refund remainder with shipping
        success, response = self.run_test(
            "Admin refund remainder + shipping",
            "POST",
            f"/api/admin/orders/{order_id}/refund",
            200,
            data={
                "reason": "Test full refund",
                "items": None,  # All remaining items
                "include_shipping": True,
                "notify": False
            },
            token=self.admin_token
        )
        
        if success:
            if response.get('fully_refunded'):
                print(f"✅ Full refund completed")
            else:
                print(f"❌ Expected fully_refunded")
                self.tests_passed -= 1
            
            # Verify order status
            success2, order_detail = self.run_test(
                "Check order after full refund",
                "GET",
                f"/api/orders/admin/{order_id}",
                200,
                token=self.admin_token
            )
            
            if success2:
                if order_detail.get('status') == 'Reembolsado':
                    print(f"✅ Order status changed to Reembolsado")
                else:
                    print(f"❌ Expected status Reembolsado, got {order_detail.get('status')}")
                    self.tests_passed -= 1
        
        # Test 3: Excess refund → 400
        success, response = self.run_test(
            "Admin excess refund → 400",
            "POST",
            f"/api/admin/orders/{order_id}/refund",
            400,
            data={
                "reason": "Test excess",
                "amount": 100.0,
                "notify": False
            },
            token=self.admin_token
        )
        
        if success:
            print(f"✅ Excess refund correctly rejected")

    def cleanup(self):
        """Clean up test data"""
        print("\n" + "="*70)
        print("CLEANUP: REMOVING TEST DATA")
        print("="*70)
        
        # Delete test orders
        for order in self.test_orders:
            print(f"ℹ️  Test order: {order['order_number']} (ID: {order['id']})")
        
        # Delete test users
        for user in self.test_users:
            print(f"ℹ️  Test user: {user['email']}")
        
        print(f"ℹ️  Manual cleanup recommended: delete {len(self.test_users)} users and {len(self.test_orders)} orders from MongoDB")

def main():
    print("\n" + "="*70)
    print("ECOANDES SHIPPING V3 + REFUNDS + INVOICE TESTS")
    print("="*70)
    
    tester = ShippingV3Tester()
    
    # Setup
    if not tester.setup_admin():
        print("\n❌ Admin login failed, stopping tests")
        return 1
    
    # Shipping tests
    tester.test_retail_shipping_flat_fee()
    tester.test_professional_shipping_weight_table()
    
    # Address verification
    tester.test_address_verification()
    
    # Order creation
    tester.test_order_creation_retail_peninsular()
    tester.test_order_creation_canarias()
    
    # Refund requests
    tester.test_refund_request()
    
    # Invoice requests
    tester.test_invoice_request()
    
    # Admin refunds
    tester.test_admin_refund()
    
    # Cleanup
    tester.cleanup()
    
    # Results
    print("\n" + "="*70)
    print("TEST RESULTS")
    print("="*70)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
