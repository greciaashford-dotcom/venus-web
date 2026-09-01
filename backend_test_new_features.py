"""Backend API tests for EcoAndes NEW FEATURES BATCH 12:
- Carousel categories (CRUD, reorder, active toggle)
- BeeL API NIF/CIF validation for professional registration
- Legal pages (DB-backed, editable)
- SEO with AI recommendations
- Product enrichment (tech_sheet, nutrition, description_blocks)
"""
import requests
import sys
import time
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
                response = requests.get(url, headers=headers, params=params, timeout=15)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=15)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=15)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                # Additional validation if provided
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

    # Test 1: Admin login
    print("\n" + "="*60)
    print("🔐 AUTHENTICATION")
    print("="*60)
    success, response = runner.test(
        "Admin login",
        "POST",
        "auth/login",
        200,
        data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if success:
        if "token" in response:
            runner.token = response["token"]
        elif "access_token" in response:
            runner.token = response["access_token"]
        else:
            print(f"   ⚠️  WARNING: No token in response")
    else:
        print("⚠️  WARNING: Admin login failed, admin-only tests will be skipped")

    # Test 2: GET /api/carousel-categories (public)
    print("\n" + "="*60)
    print("🎨 CAROUSEL CATEGORIES - PUBLIC")
    print("="*60)
    
    def validate_carousel_public(data):
        if not isinstance(data, dict):
            print(f"   ⚠️  Response is not a dict")
            return False
        if "items" not in data:
            print(f"   ⚠️  Missing 'items' field")
            return False
        items = data.get("items", [])
        print(f"   ✓ {len(items)} active carousel items returned")
        if len(items) != 15:
            print(f"   ⚠️  Expected 15 items (seeded), got {len(items)}")
            return False
        # Check first item structure
        if len(items) > 0:
            first = items[0]
            required_fields = ["id", "title", "cat", "img", "order"]
            missing = [f for f in required_fields if f not in first]
            if missing:
                print(f"   ⚠️  Missing fields in item: {missing}")
                return False
            print(f"   ✓ First item: {first.get('title', 'N/A')}")
        return True
    
    success, carousel_data = runner.test(
        "GET /api/carousel-categories",
        "GET",
        "carousel-categories",
        200,
        validate_fn=validate_carousel_public
    )

    # Test 3: GET /api/admin/carousel-categories (admin)
    if runner.token:
        print("\n" + "="*60)
        print("🎨 CAROUSEL CATEGORIES - ADMIN GET")
        print("="*60)
        
        def validate_carousel_admin(data):
            if not isinstance(data, dict):
                print(f"   ⚠️  Response is not a dict")
                return False
            if "items" not in data:
                print(f"   ⚠️  Missing 'items' field")
                return False
            items = data.get("items", [])
            print(f"   ✓ {len(items)} carousel items (including inactive)")
            # Admin should see all items, including inactive
            if len(items) < 15:
                print(f"   ⚠️  Expected at least 15 items")
                return False
            # Check for 'active' field
            if len(items) > 0:
                first = items[0]
                if "active" not in first:
                    print(f"   ⚠️  Missing 'active' field in admin view")
                    return False
                print(f"   ✓ First item: {first.get('title', 'N/A')}, active={first.get('active')}")
            return True
        
        success, admin_carousel_data = runner.test(
            "GET /api/admin/carousel-categories",
            "GET",
            "admin/carousel-categories",
            200,
            auth=True,
            validate_fn=validate_carousel_admin
        )
        
        # Test 4: PUT /api/admin/carousel-categories (modify and save)
        if success and admin_carousel_data:
            print("\n" + "="*60)
            print("🎨 CAROUSEL CATEGORIES - ADMIN SAVE")
            print("="*60)
            
            items = admin_carousel_data.get("items", [])
            # Modify first item title
            if len(items) > 0:
                items[0]["title"] = items[0].get("title", "") + " [TEST]"
                # Toggle active on second item
                if len(items) > 1:
                    items[1]["active"] = not items[1].get("active", True)
            
            def validate_carousel_save(data):
                if not isinstance(data, dict):
                    return False
                if "ok" not in data:
                    print(f"   ⚠️  Missing 'ok' field")
                    return False
                print(f"   ✓ Carousel saved: ok={data.get('ok')}, items={data.get('items')}")
                return data.get('ok') == True
            
            success_save, _ = runner.test(
                "PUT /api/admin/carousel-categories",
                "PUT",
                "admin/carousel-categories",
                200,
                data={"items": items},
                auth=True,
                validate_fn=validate_carousel_save
            )
            
            # Verify changes reflected in public endpoint
            if success_save:
                def validate_carousel_updated(data):
                    items = data.get("items", [])
                    if len(items) > 0:
                        first_title = items[0].get("title", "")
                        if "[TEST]" in first_title:
                            print(f"   ✓ Changes reflected in public endpoint")
                            return True
                        else:
                            print(f"   ⚠️  Changes NOT reflected")
                            return False
                    return True
                
                runner.test(
                    "GET /api/carousel-categories (verify changes)",
                    "GET",
                    "carousel-categories",
                    200,
                    validate_fn=validate_carousel_updated
                )
                
                # Restore original (remove [TEST])
                items[0]["title"] = items[0].get("title", "").replace(" [TEST]", "")
                if len(items) > 1:
                    items[1]["active"] = not items[1].get("active", True)
                runner.test(
                    "PUT /api/admin/carousel-categories (restore)",
                    "PUT",
                    "admin/carousel-categories",
                    200,
                    data={"items": items},
                    auth=True
                )

    # Test 5: Professional registration with VALID CIF (B12345674)
    print("\n" + "="*60)
    print("🏢 PROFESSIONAL REGISTRATION - VALID CIF (BeeL)")
    print("="*60)
    
    test_email_valid = f"test.pro.valid.{int(time.time())}@test.com"
    
    def validate_pro_valid(data):
        if not isinstance(data, dict):
            return False
        if data.get("role") != "professional":
            print(f"   ⚠️  Role should be 'professional'")
            return False
        if data.get("verification") != "auto":
            print(f"   ⚠️  Verification should be 'auto' for valid CIF, got {data.get('verification')}")
            return False
        if data.get("approved") != True:
            print(f"   ⚠️  Approved should be True for valid CIF")
            return False
        print(f"   ✓ Professional registered: email={data.get('email')}, verification={data.get('verification')}, approved={data.get('approved')}")
        return True
    
    runner.test(
        "POST /api/auth/register (professional, valid CIF B12345674)",
        "POST",
        "auth/register",
        200,
        data={
            "email": test_email_valid,
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "Professional",
            "role": "professional",
            "company": "Test Company SL",
            "tax_id": "B12345674",
            "business_type": "Ecotienda",
            "phone": "+34600000001"
        },
        validate_fn=validate_pro_valid
    )

    # Test 6: Professional registration with INVALID CIF (B99999999)
    print("\n" + "="*60)
    print("🏢 PROFESSIONAL REGISTRATION - INVALID CIF (BeeL)")
    print("="*60)
    
    test_email_invalid = f"test.pro.invalid.{int(time.time())}@test.com"
    
    def validate_pro_invalid(data):
        if not isinstance(data, dict):
            return False
        if data.get("role") != "professional":
            print(f"   ⚠️  Role should be 'professional'")
            return False
        if data.get("verification") != "failed":
            print(f"   ⚠️  Verification should be 'failed' for invalid CIF, got {data.get('verification')}")
            return False
        if data.get("approved") != False:
            print(f"   ⚠️  Approved should be False for invalid CIF")
            return False
        print(f"   ✓ Professional registration failed: email={data.get('email')}, verification={data.get('verification')}, approved={data.get('approved')}")
        return True
    
    runner.test(
        "POST /api/auth/register (professional, invalid CIF B99999999)",
        "POST",
        "auth/register",
        200,
        data={
            "email": test_email_invalid,
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "Invalid",
            "role": "professional",
            "company": "Invalid Company",
            "tax_id": "B99999999",
            "business_type": "Otro",
            "phone": "+34600000002"
        },
        validate_fn=validate_pro_invalid
    )

    # Test 7: GET /api/legal/aviso-legal
    print("\n" + "="*60)
    print("📄 LEGAL PAGES - PUBLIC GET")
    print("="*60)
    
    for slug in ["aviso-legal", "politica-cookies", "politica-privacidad", "condiciones"]:
        def validate_legal_page(data):
            if not isinstance(data, dict):
                print(f"   ⚠️  Response is not a dict")
                return False
            required_fields = ["slug", "title", "sections"]
            missing = [f for f in required_fields if f not in data]
            if missing:
                print(f"   ⚠️  Missing fields: {missing}")
                return False
            sections = data.get("sections", [])
            print(f"   ✓ Legal page: {data.get('title')}, {len(sections)} sections")
            if len(sections) == 0:
                print(f"   ⚠️  No sections found")
                return False
            # Check first section structure
            first_section = sections[0]
            if "h" not in first_section or "p" not in first_section:
                print(f"   ⚠️  Section missing 'h' or 'p' field")
                return False
            print(f"   ✓ First section: {first_section.get('h', 'N/A')[:50]}")
            return True
        
        runner.test(
            f"GET /api/legal/{slug}",
            "GET",
            f"legal/{slug}",
            200,
            validate_fn=validate_legal_page
        )

    # Test 8: Admin legal pages - GET list
    if runner.token:
        print("\n" + "="*60)
        print("📄 LEGAL PAGES - ADMIN GET LIST")
        print("="*60)
        
        def validate_legal_admin_list(data):
            if not isinstance(data, dict):
                print(f"   ⚠️  Response is not a dict")
                return False
            if "pages" not in data:
                print(f"   ⚠️  Missing 'pages' field")
                return False
            pages = data.get("pages", [])
            print(f"   ✓ {len(pages)} legal pages")
            if len(pages) != 4:
                print(f"   ⚠️  Expected 4 legal pages")
                return False
            return True
        
        success, legal_pages = runner.test(
            "GET /api/admin/legal",
            "GET",
            "admin/legal",
            200,
            auth=True,
            validate_fn=validate_legal_admin_list
        )
        
        # Test 9: PUT /api/admin/legal/aviso-legal (edit and save)
        if success and legal_pages:
            print("\n" + "="*60)
            print("📄 LEGAL PAGES - ADMIN SAVE")
            print("="*60)
            
            pages = legal_pages.get("pages", [])
            aviso_legal = next((p for p in pages if p.get("slug") == "aviso-legal"), None)
            
            if aviso_legal:
                # Modify first section paragraph
                sections = aviso_legal.get("sections", [])
                if len(sections) > 0:
                    sections[0]["p"] = sections[0].get("p", "") + " [TEST EDIT]"
                
                def validate_legal_save(data):
                    if not isinstance(data, dict):
                        return False
                    if "ok" not in data:
                        print(f"   ⚠️  Missing 'ok' field")
                        return False
                    print(f"   ✓ Legal page saved: ok={data.get('ok')}")
                    return data.get('ok') == True
                
                success_save, _ = runner.test(
                    "PUT /api/admin/legal/aviso-legal",
                    "PUT",
                    "admin/legal/aviso-legal",
                    200,
                    data={
                        "title": aviso_legal.get("title"),
                        "updated": aviso_legal.get("updated", ""),
                        "sections": sections
                    },
                    auth=True,
                    validate_fn=validate_legal_save
                )
                
                # Verify changes reflected in public endpoint
                if success_save:
                    def validate_legal_updated(data):
                        sections = data.get("sections", [])
                        if len(sections) > 0:
                            first_p = sections[0].get("p", "")
                            if isinstance(first_p, list):
                                first_p = " ".join(first_p)
                            if "[TEST EDIT]" in first_p:
                                print(f"   ✓ Changes reflected in public endpoint")
                                return True
                            else:
                                print(f"   ⚠️  Changes NOT reflected")
                                return False
                        return True
                    
                    runner.test(
                        "GET /api/legal/aviso-legal (verify changes)",
                        "GET",
                        "legal/aviso-legal",
                        200,
                        validate_fn=validate_legal_updated
                    )
                    
                    # Restore original
                    if isinstance(sections[0]["p"], str):
                        sections[0]["p"] = sections[0]["p"].replace(" [TEST EDIT]", "")
                    runner.test(
                        "PUT /api/admin/legal/aviso-legal (restore)",
                        "PUT",
                        "admin/legal/aviso-legal",
                        200,
                        data={
                            "title": aviso_legal.get("title"),
                            "updated": aviso_legal.get("updated", ""),
                            "sections": sections
                        },
                        auth=True
                    )

    # Test 10: GET /api/admin/seo/latest
    if runner.token:
        print("\n" + "="*60)
        print("🔍 SEO - ADMIN GET LATEST REPORT")
        print("="*60)
        
        def validate_seo_latest(data):
            if not isinstance(data, dict):
                print(f"   ⚠️  Response is not a dict")
                return False
            if "report" not in data:
                print(f"   ⚠️  Missing 'report' field")
                return False
            report = data.get("report")
            if report is None:
                print(f"   ℹ️  No SEO report exists yet (expected on first run)")
                return True
            # Check report structure
            if "report" not in report:
                print(f"   ⚠️  Missing nested 'report' field")
                return False
            inner_report = report.get("report", {})
            if "overall_score" not in inner_report or "recommendations" not in inner_report:
                print(f"   ⚠️  Missing 'overall_score' or 'recommendations'")
                return False
            print(f"   ✓ SEO report: score={inner_report.get('overall_score')}, {len(inner_report.get('recommendations', []))} recommendations")
            return True
        
        runner.test(
            "GET /api/admin/seo/latest",
            "GET",
            "admin/seo/latest",
            200,
            auth=True,
            validate_fn=validate_seo_latest
        )
        
        # Test 11: GET /api/admin/seo/reports (history)
        print("\n" + "="*60)
        print("🔍 SEO - ADMIN GET REPORTS HISTORY")
        print("="*60)
        
        def validate_seo_reports(data):
            if not isinstance(data, dict):
                print(f"   ⚠️  Response is not a dict")
                return False
            if "reports" not in data:
                print(f"   ⚠️  Missing 'reports' field")
                return False
            reports = data.get("reports", [])
            print(f"   ✓ {len(reports)} SEO reports in history")
            return True
        
        runner.test(
            "GET /api/admin/seo/reports",
            "GET",
            "admin/seo/reports",
            200,
            auth=True,
            validate_fn=validate_seo_reports
        )
        
        # NOTE: We do NOT test POST /api/admin/seo/analyze to save LLM credits

    # Test 12: GET /api/products/slug/{slug} - enriched product
    print("\n" + "="*60)
    print("📦 PRODUCT ENRICHMENT - TECH SHEET, NUTRITION, DESCRIPTION BLOCKS")
    print("="*60)
    
    for slug in ["urucum-en-polvo-achiote-bio", "anis-verde-en-grano-bio"]:
        def validate_enriched_product(data):
            if not isinstance(data, dict):
                print(f"   ⚠️  Response is not a dict")
                return False
            
            # Check tech_sheet
            tech_sheet = data.get("tech_sheet", {})
            if not tech_sheet or not tech_sheet.get("url"):
                print(f"   ⚠️  Missing tech_sheet.url")
                return False
            print(f"   ✓ tech_sheet.url: {tech_sheet.get('url')[:50]}...")
            
            # Check nutrition
            nutrition = data.get("nutrition", [])
            if not nutrition or len(nutrition) == 0:
                print(f"   ⚠️  Missing nutrition array")
                return False
            print(f"   ✓ nutrition: {len(nutrition)} rows")
            # Check first nutrition row structure
            if len(nutrition) > 0:
                first_row = nutrition[0]
                if "label" not in first_row or "value" not in first_row:
                    print(f"   ⚠️  Nutrition row missing 'label' or 'value'")
                    return False
            
            # Check description_blocks
            blocks = data.get("description_blocks", {})
            if not blocks:
                print(f"   ⚠️  Missing description_blocks")
                return False
            # Check for at least one filled block
            filled_blocks = [k for k, v in blocks.items() if v]
            if len(filled_blocks) == 0:
                print(f"   ⚠️  No filled description_blocks")
                return False
            print(f"   ✓ description_blocks: {', '.join(filled_blocks)}")
            
            return True
        
        runner.test(
            f"GET /api/products/slug/{slug}",
            "GET",
            f"products/slug/{slug}",
            200,
            validate_fn=validate_enriched_product
        )

    # Print summary
    runner.print_summary()
    
    return 0 if runner.tests_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
