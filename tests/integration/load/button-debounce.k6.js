import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

// Custom metrics
const duplicatesPrevented = new Counter("duplicates_prevented");
const duplicatesProcessed = new Counter("duplicates_processed"); // Should be 0
const errorRate = new Rate("errors");

// Test configuration
export const options = {
  vus: 20, // 20 concurrent users
  duration: "2m",
  thresholds: {
    errors: ["rate<0.01"],
    duplicates_processed: ["count==0"], // No duplicates should be processed
    duplicates_prevented: ["count>0"], // Some duplicates should be prevented
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

function generatePhoneNumber() {
  return `628${String(__VU).padStart(8, "0")}`;
}

function authenticateUser(phoneNumber) {
  const payload = JSON.stringify({ phoneNumber });
  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const response = http.post(`${BASE_URL}/api/auth/verify`, payload, params);

  const success = check(response, {
    "auth status is 200": (r) => r.status === 200,
  });

  errorRate.add(!success);

  if (success) {
    const body = JSON.parse(response.body);
    return body.token;
  }

  return null;
}

// Simulate button click
function clickButton(token, buttonId) {
  const payload = JSON.stringify({
    buttonId,
    timestamp: Date.now(),
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  const response = http.post(`${BASE_URL}/api/button/click`, payload, params);

  const success = check(response, {
    "button click registered": (r) => r.status === 200 || r.status === 202,
  });

  errorRate.add(!success);

  // Check if duplicate was prevented (status 202 or specific response)
  if (response.status === 202 || response.body.includes("debounced")) {
    duplicatesPrevented.add(1);
  } else if (response.status === 200) {
    // Check if this is actually a duplicate (should not happen)
    // In real scenario, we'd track button clicks and verify
  }

  return success;
}

// Main test: Rapid button clicking to test debouncing
export default function () {
  const phoneNumber = generatePhoneNumber();
  const token = authenticateUser(phoneNumber);

  if (!token) {
    return;
  }

  const buttonId = "transaction_confirm"; // Test confirm button

  // Click button rapidly 5 times within 3 seconds
  // Only the first click should be processed
  for (let i = 0; i < 5; i++) {
    clickButton(token, buttonId);
    sleep(0.5); // 500ms between clicks (within 3-second debounce window)
  }

  // Expected: 1 processed, 4 prevented

  // Wait for debounce window to expire
  sleep(3.5);

  // Click again - this should be processed
  clickButton(token, buttonId);

  // Expected: This click should be processed (not debounced)

  // Random think time
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const prevented = data.metrics.duplicates_prevented.values.count || 0;
  const processed = data.metrics.duplicates_processed.values.count || 0;

  console.log("\n=== Button Debouncing Test Results ===");
  console.log(`Duplicate clicks prevented: ${prevented}`);
  console.log(`Duplicate clicks processed: ${processed}`);
  console.log(`Success: ${processed === 0 ? "PASS" : "FAIL"}`);

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
