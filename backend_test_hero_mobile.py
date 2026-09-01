"""Backend API tests for EcoAndes HERO IMAGE_MOBILE feature."""
import requests
import sys

BASE_URL = "https://andean-eco.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@ecoandes.com"
ADMIN_PASSWORD = "Admin123!"


class TestRunner:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []

    def test(self, name, method, endpoint, expected_status, data=None, params=None, auth=False, validate_fn=None):
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
                            self.failures.append({"test": name, "reason": "Validation failed", "endpoint": endpoint})
                    except Exception as e:
                        success = False
                        print(f"❌ FAILED - Validation error: {e}")
                        self.failures.append({"test": name, "reason": f"Validation error: {e}", "endpoint": endpoint})
                
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
                self.failures.append({"test": name, "expected": expected_status, "actual": response.status_code, "endpoint": endpoint})
                return False, {}

        except Exception as e:
            self.tests_failed += 1
            print(f"❌ FAILED - Error: {str(e)}")
            self.failures.append({"test": name, "reason": str(e), "endpoint": endpoint})
            return False, {}

    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY - HERO IMAGE_MOBILE")
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
            print(f"   ✓ Token obtained: {runner.token[:20]}...")
        elif "access_token" in response:
            runner.token = response["access_token"]
            print(f"   ✓ Token obtained: {runner.token[:20]}...")
        else:
            print(f"   ⚠️  WARNING: No token in response")
            return 1

    # Test 2: GET /api/hero - verify all 5 slides have image_mobile
    print("\n" + "="*60)
    print("🎨 HERO PUBLIC - IMAGE_MOBILE FIELD")
    print("="*60)
    
    def validate_hero_image_mobile(data):
        """Validate all slides have non-empty image AND image_mobile."""
        if not isinstance(data, dict):
            print(f"   ⚠️  Response is not a dict")
            return False
        
        slides = data.get("slides", [])
        if not isinstance(slides, list):
            print(f"   ⚠️  'slides' is not a list")
            return False
        
        if len(slides) != 5:
            print(f"   ⚠️  Expected 5 slides, got {len(slides)}")
            return False
        
        print(f"   ✓ Hero has 5 slides")
        
        # Check each slide has both image and image_mobile
        for i, slide in enumerate(slides):
            image = slide.get("image", "")
            image_mobile = slide.get("image_mobile", "")
            
            if not image:
                print(f"   ❌ Slide {i+1}: Missing 'image' field or empty")
                return False
            
            if not image_mobile:
                print(f"   ❌ Slide {i+1}: Missing 'image_mobile' field or empty")
                return False
            
            # Check image_mobile is a zyrosite.com SVG URL
            if "assets.zyrosite.com" not in image_mobile:
                print(f"   ⚠️  Slide {i+1}: image_mobile is not a zyrosite.com URL: {image_mobile}")
            
            print(f"   ✓ Slide {i+1}: image={image[:50]}..., image_mobile={image_mobile[:50]}...")
        
        print(f"   ✅ All 5 slides have non-empty image AND image_mobile")
        return True
    
    success, hero_data = runner.test(
        "GET /api/hero (verify image_mobile in all 5 slides)",
        "GET",
        "hero",
        200,
        validate_fn=validate_hero_image_mobile
    )

    # Test 3: GET /api/admin/hero - verify image_mobile field present
    if runner.token:
        print("\n" + "="*60)
        print("🎨 HERO ADMIN - IMAGE_MOBILE FIELD")
        print("="*60)
        
        def validate_admin_hero_image_mobile(data):
            """Validate admin hero has image_mobile field."""
            if not isinstance(data, dict):
                print(f"   ⚠️  Response is not a dict")
                return False
            
            slides = data.get("slides", [])
            if not isinstance(slides, list):
                print(f"   ⚠️  'slides' is not a list")
                return False
            
            print(f"   ✓ Admin hero has {len(slides)} slides")
            
            # Check each slide has image_mobile field
            for i, slide in enumerate(slides):
                if "image_mobile" not in slide:
                    print(f"   ❌ Slide {i+1}: Missing 'image_mobile' field")
                    return False
                
                image_mobile = slide.get("image_mobile", "")
                print(f"   ✓ Slide {i+1}: image_mobile={image_mobile[:60]}...")
            
            print(f"   ✅ All slides have 'image_mobile' field")
            return True
        
        success, admin_hero_data = runner.test(
            "GET /api/admin/hero (verify image_mobile field)",
            "GET",
            "admin/hero",
            200,
            auth=True,
            validate_fn=validate_admin_hero_image_mobile
        )
        
        # Test 4: PUT /api/admin/hero - verify image_mobile is preserved
        if success and admin_hero_data:
            print("\n" + "="*60)
            print("🎨 HERO ADMIN - PUT PRESERVES IMAGE_MOBILE")
            print("="*60)
            
            # Store original image_mobile values
            original_slides = admin_hero_data.get("slides", [])
            original_image_mobiles = [s.get("image_mobile", "") for s in original_slides]
            
            print(f"   📝 Original image_mobile values:")
            for i, img_mobile in enumerate(original_image_mobiles):
                print(f"      Slide {i+1}: {img_mobile[:60]}...")
            
            # PUT the same data back (CRITICAL: do NOT modify h1/subtitle)
            slides_to_send = []
            for slide in original_slides:
                slides_to_send.append({
                    "id": slide.get("id"),
                    "order": slide.get("order", 0),
                    "active": slide.get("active", True),
                    "image": slide.get("image", ""),
                    "image_mobile": slide.get("image_mobile", ""),
                    "image_alt": slide.get("image_alt", ""),
                    "overline": slide.get("overline", ""),
                    "h1": slide.get("h1", ""),
                    "subtitle": slide.get("subtitle", ""),
                    "cta_label": slide.get("cta_label", ""),
                    "cta_link": slide.get("cta_link", ""),
                })
            
            b2b = admin_hero_data.get("b2b", {})
            
            def validate_hero_put(data):
                if not isinstance(data, dict):
                    return False
                if "ok" not in data:
                    print(f"   ⚠️  Missing 'ok' field")
                    return False
                print(f"   ✓ Hero saved: ok={data.get('ok')}")
                return data.get('ok') == True
            
            success_put, _ = runner.test(
                "PUT /api/admin/hero (send back same data)",
                "PUT",
                "admin/hero",
                200,
                data={
                    "slides": slides_to_send,
                    "b2b": b2b,
                    "autotranslate": False  # Don't trigger translation
                },
                auth=True,
                validate_fn=validate_hero_put
            )
            
            if success_put:
                # Fetch again and verify image_mobile is intact
                def validate_image_mobile_preserved(data):
                    if not isinstance(data, dict):
                        return False
                    
                    slides = data.get("slides", [])
                    if len(slides) != len(original_image_mobiles):
                        print(f"   ⚠️  Slide count changed after PUT")
                        return False
                    
                    print(f"   📝 After PUT image_mobile values:")
                    all_preserved = True
                    for i, slide in enumerate(slides):
                        current_image_mobile = slide.get("image_mobile", "")
                        original_image_mobile = original_image_mobiles[i]
                        
                        print(f"      Slide {i+1}: {current_image_mobile[:60]}...")
                        
                        if current_image_mobile != original_image_mobile:
                            print(f"   ❌ Slide {i+1}: image_mobile changed!")
                            print(f"      Original: {original_image_mobile}")
                            print(f"      Current:  {current_image_mobile}")
                            all_preserved = False
                    
                    if all_preserved:
                        print(f"   ✅ All image_mobile values preserved after PUT")
                    
                    return all_preserved
                
                runner.test(
                    "GET /api/admin/hero (verify image_mobile preserved)",
                    "GET",
                    "admin/hero",
                    200,
                    auth=True,
                    validate_fn=validate_image_mobile_preserved
                )

    # Print summary
    runner.print_summary()
    
    # Return exit code
    return 0 if runner.tests_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
