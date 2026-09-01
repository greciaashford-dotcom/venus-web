"""Performance test for EcoAndes - verifying the fix for slow API responses.

BUG REPORT: API responses were taking up to 186 seconds because LLM calls
(translations/SEO generation) ran inside the API process and blocked the event loop.

FIX: Content generation moved to a separate OS process, bcrypt moved to threads.

This test verifies:
1. API endpoints respond quickly (under 2-3 seconds) even while content generation runs
2. Job status endpoints work correctly
3. Auth flows still work after bcrypt changes
"""
import requests
import sys
import time
from typing import Dict, List, Optional

BASE_URL = "https://andean-eco.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@ecoandes.com"
ADMIN_PASSWORD = "Admin123!"


class PerformanceTestRunner:
    def __init__(self):
        self.token: Optional[str] = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures: List[Dict] = []
        self.response_times: List[Dict] = []

    def test_with_timing(
        self,
        name: str,
        method: str,
        endpoint: str,
        expected_status: int,
        max_response_time: float,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
        auth: bool = False,
        validate_fn=None,
    ) -> tuple:
        """Run a test and measure response time."""
        url = f"{BASE_URL}/{endpoint}"
        headers = {"Content-Type": "application/json"}
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")

        try:
            start_time = time.time()

            if method == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            elapsed = time.time() - start_time
            self.response_times.append(
                {"test": name, "endpoint": endpoint, "time": elapsed}
            )

            print(f"   ⏱️  Response time: {elapsed:.2f}s (max: {max_response_time}s)")

            # Check status code
            status_ok = response.status_code == expected_status
            if not status_ok:
                self.tests_failed += 1
                print(
                    f"   ❌ FAILED - Expected status {expected_status}, got {response.status_code}"
                )
                try:
                    error_detail = response.json()
                    print(f"   Response: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failures.append(
                    {
                        "test": name,
                        "expected_status": expected_status,
                        "actual_status": response.status_code,
                        "endpoint": endpoint,
                        "response_time": elapsed,
                    }
                )
                return False, {}

            # Check response time
            time_ok = elapsed <= max_response_time
            if not time_ok:
                self.tests_failed += 1
                print(
                    f"   ❌ FAILED - Response time {elapsed:.2f}s exceeds max {max_response_time}s"
                )
                self.failures.append(
                    {
                        "test": name,
                        "reason": f"Response time {elapsed:.2f}s exceeds max {max_response_time}s",
                        "endpoint": endpoint,
                        "response_time": elapsed,
                    }
                )
                return False, {}

            # Additional validation if provided
            if validate_fn:
                try:
                    resp_data = response.json() if response.text else {}
                    validation_result = validate_fn(resp_data)
                    if not validation_result:
                        self.tests_failed += 1
                        print(f"   ❌ FAILED - Validation failed")
                        self.failures.append(
                            {
                                "test": name,
                                "reason": "Validation failed",
                                "endpoint": endpoint,
                                "response_time": elapsed,
                            }
                        )
                        return False, {}
                except Exception as e:
                    self.tests_failed += 1
                    print(f"   ❌ FAILED - Validation error: {e}")
                    self.failures.append(
                        {
                            "test": name,
                            "reason": f"Validation error: {e}",
                            "endpoint": endpoint,
                            "response_time": elapsed,
                        }
                    )
                    return False, {}

            self.tests_passed += 1
            print(f"   ✅ PASSED - Status: {response.status_code}, Time: {elapsed:.2f}s")
            return (
                True,
                (
                    response.json()
                    if response.text
                    and response.headers.get("content-type", "").startswith(
                        "application/json"
                    )
                    else {}
                ),
            )

        except requests.exceptions.Timeout:
            self.tests_failed += 1
            print(f"   ❌ FAILED - Request timeout (>30s)")
            self.failures.append(
                {
                    "test": name,
                    "reason": "Request timeout (>30s)",
                    "endpoint": endpoint,
                }
            )
            return False, {}
        except Exception as e:
            self.tests_failed += 1
            print(f"   ❌ FAILED - Error: {str(e)}")
            self.failures.append(
                {"test": name, "reason": str(e), "endpoint": endpoint}
            )
            return False, {}

    def print_summary(self):
        """Print test summary."""
        print("\n" + "=" * 60)
        print("📊 PERFORMANCE TEST SUMMARY")
        print("=" * 60)
        print(f"Total tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")

        if self.response_times:
            print("\n⏱️  RESPONSE TIMES:")
            for rt in self.response_times:
                print(f"   {rt['test']}: {rt['time']:.2f}s")

            avg_time = sum(rt["time"] for rt in self.response_times) / len(
                self.response_times
            )
            max_time = max(rt["time"] for rt in self.response_times)
            print(f"\n   Average: {avg_time:.2f}s")
            print(f"   Maximum: {max_time:.2f}s")

        if self.failures:
            print("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failures, 1):
                print(f"\n{i}. {failure['test']}")
                print(f"   Endpoint: {failure.get('endpoint', 'N/A')}")
                if "expected_status" in failure:
                    print(
                        f"   Expected: {failure['expected_status']}, Got: {failure['actual_status']}"
                    )
                if "reason" in failure:
                    print(f"   Reason: {failure['reason']}")
                if "response_time" in failure:
                    print(f"   Response time: {failure['response_time']:.2f}s")
        print("=" * 60)


def main():
    runner = PerformanceTestRunner()

    print("\n" + "=" * 60)
    print("🚀 PERFORMANCE TEST - API RESPONSE TIMES")
    print("=" * 60)
    print(
        "Testing that API remains fast even while content generation subprocess runs"
    )
    print("=" * 60)

    # Test 1: GET /api/products?limit=24 (the reported slow endpoint)
    print("\n" + "=" * 60)
    print("📦 PRODUCTS LIST (THE REPORTED SLOW ENDPOINT)")
    print("=" * 60)

    def validate_products(data):
        if not isinstance(data, list):
            print(f"   ⚠️  Response is not a list")
            return False
        print(f"   ✓ {len(data)} products returned")
        return True

    # Run this test 3 times as requested
    for i in range(1, 4):
        runner.test_with_timing(
            f"GET /api/products?limit=24 (attempt {i}/3)",
            "GET",
            "products",
            200,
            2.0,  # Max 2 seconds (was 186s before fix)
            params={"limit": 24},
            validate_fn=validate_products,
        )

    # Test 2: GET /api/hero
    print("\n" + "=" * 60)
    print("🎨 HERO ENDPOINT")
    print("=" * 60)

    def validate_hero(data):
        if not isinstance(data, dict):
            return False
        if "slides" not in data:
            print(f"   ⚠️  Missing 'slides' field")
            return False
        print(f"   ✓ Hero has {len(data.get('slides', []))} slides")
        return True

    runner.test_with_timing(
        "GET /api/hero",
        "GET",
        "hero",
        200,
        2.0,  # Max 2 seconds
        validate_fn=validate_hero,
    )

    # Test 3: POST /api/auth/login (bcrypt moved to thread)
    print("\n" + "=" * 60)
    print("🔐 ADMIN LOGIN (BCRYPT IN THREAD)")
    print("=" * 60)

    def validate_login(data):
        if "access_token" not in data and "token" not in data:
            print(f"   ⚠️  No token in response")
            return False
        print(f"   ✓ Login successful, token obtained")
        return True

    success, response = runner.test_with_timing(
        "POST /api/auth/login",
        "POST",
        "auth/login",
        200,
        3.0,  # Max 3 seconds (bcrypt is CPU-intensive)
        data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        validate_fn=validate_login,
    )

    if success:
        if "token" in response:
            runner.token = response["token"]
        elif "access_token" in response:
            runner.token = response["access_token"]

    # Test 4: GET /api/products?search=quinoa
    print("\n" + "=" * 60)
    print("🔍 PRODUCT SEARCH")
    print("=" * 60)

    def validate_search(data):
        if not isinstance(data, list):
            return False
        print(f"   ✓ {len(data)} search results")
        return True

    runner.test_with_timing(
        "GET /api/products?search=quinoa",
        "GET",
        "products",
        200,
        2.0,  # Max 2 seconds
        params={"search": "quinoa"},
        validate_fn=validate_search,
    )

    # Test 5: GET /api/products/seo/status (admin token)
    if runner.token:
        print("\n" + "=" * 60)
        print("📊 SEO JOB STATUS (ADMIN)")
        print("=" * 60)

        def validate_seo_status(data):
            if not isinstance(data, dict):
                return False
            if "job" not in data:
                print(f"   ⚠️  Missing 'job' field from DB")
                return False
            job = data.get("job", {})
            print(f"   ✓ Job status from DB:")
            print(f"      - running: {job.get('running', False)}")
            print(f"      - phase: {job.get('phase', 'N/A')}")
            print(f"      - started_at: {job.get('started_at', 'N/A')}")
            print(f"      - finished_at: {job.get('finished_at', 'N/A')}")
            if job.get("error"):
                print(f"      - error: {job.get('error')}")
            return True

        runner.test_with_timing(
            "GET /api/products/seo/status",
            "GET",
            "products/seo/status",
            200,
            2.0,  # Max 2 seconds
            auth=True,
            validate_fn=validate_seo_status,
        )

    # Test 6: POST /api/products/seo/run (admin token)
    if runner.token:
        print("\n" + "=" * 60)
        print("🚀 SEO JOB RUN (ADMIN)")
        print("=" * 60)

        def validate_seo_run(data):
            if not isinstance(data, dict):
                return False
            if "started" not in data:
                print(f"   ⚠️  Missing 'started' field")
                return False
            started = data.get("started")
            print(f"   ✓ SEO run response: started={started}")
            if not started:
                reason = data.get("reason", "N/A")
                print(f"      - reason: {reason}")
                if reason == "already_running":
                    print(
                        f"      ✓ This is EXPECTED - content worker is running (perfect test scenario)"
                    )
            else:
                print(f"      ✓ New content worker spawned")
            return True

        runner.test_with_timing(
            "POST /api/products/seo/run",
            "POST",
            "products/seo/run",
            200,
            2.0,  # Max 2 seconds
            auth=True,
            validate_fn=validate_seo_run,
        )

    # Test 7: Register + login new user (bcrypt regression test)
    print("\n" + "=" * 60)
    print("👤 REGISTER + LOGIN NEW USER (BCRYPT REGRESSION)")
    print("=" * 60)

    test_email = f"perftest_{int(time.time())}@example.com"

    def validate_register(data):
        if not isinstance(data, dict):
            return False
        if "email" not in data:
            print(f"   ⚠️  Missing 'email' field")
            return False
        print(f"   ✓ User registered: {data.get('email')}")
        return True

    success, _ = runner.test_with_timing(
        "POST /api/auth/register",
        "POST",
        "auth/register",
        200,
        3.0,  # Max 3 seconds (bcrypt is CPU-intensive)
        data={
            "email": test_email,
            "password": "TestPass123!",
            "first_name": "Perf",
            "last_name": "Test",
            "role": "retail",
        },
        validate_fn=validate_register,
    )

    if success:

        def validate_new_login(data):
            if "access_token" not in data and "token" not in data:
                print(f"   ⚠️  No token in response")
                return False
            print(f"   ✓ New user login successful")
            return True

        runner.test_with_timing(
            "POST /api/auth/login (new user)",
            "POST",
            "auth/login",
            200,
            3.0,  # Max 3 seconds
            data={"email": test_email, "password": "TestPass123!"},
            validate_fn=validate_new_login,
        )

    # Print summary
    runner.print_summary()

    # Return exit code
    return 0 if runner.tests_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
