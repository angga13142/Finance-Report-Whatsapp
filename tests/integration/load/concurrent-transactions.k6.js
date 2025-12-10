import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const transactionDuration = new Trend("transaction_duration");

// Test configuration
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 30 }, // Ramp up to 30 users
    { duration: "2m", target: 50 }, // Ramp up to 50 users
    { duration: "2m", target: 50 }, // Stay at 50 users
    { duration: "30s", target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests should be below 2s
    errors: ["rate<0.01"], // Error rate should be below 1%
    transaction_duration: ["p(95)<2000"], // Transaction duration below 2s
  },
};

// Base URL (should be environment variable in real scenario)
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Generate unique test user phone number
function generatePhoneNumber() {
  const userId = __VU; // Virtual user ID
  const iteration = __ITER; // Iteration number
  return `628${String(userId).padStart(4, "0")}${String(iteration).padStart(4, "0")}`;
}

// Generate random transaction data
function generateTransactionData(phoneNumber) {
  const types = ["income", "expense"];
  const incomeCategories = ["Penjualan", "Investasi", "Lain-lain"];
  const expenseCategories = ["Operasional", "Gaji", "Utilitas", "Pembelian"];

  const type = types[Math.floor(Math.random() * types.length)];
  const categories = type === "income" ? incomeCategories : expenseCategories;
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = Math.floor(Math.random() * 1000000) + 10000; // 10k - 1M

  return {
    phoneNumber,
    type,
    category,
    amount,
    description: `LOAD_TEST_${__VU}_${__ITER}_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

// Simulate user authentication
function authenticateUser(phoneNumber) {
  const payload = JSON.stringify({
    phoneNumber,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/auth/verify`, payload, params);
  const duration = Date.now() - startTime;

  const success = check(response, {
    "auth status is 200": (r) => r.status === 200,
    "auth has token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!success);
  transactionDuration.add(duration);

  if (success) {
    const body = JSON.parse(response.body);
    return body.token;
  }

  return null;
}

// Create transaction
function createTransaction(token, transactionData) {
  const payload = JSON.stringify(transactionData);

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/transactions`, payload, params);
  const duration = Date.now() - startTime;

  const success = check(response, {
    "transaction status is 201": (r) => r.status === 201,
    "transaction has ID": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      } catch (e) {
        return false;
      }
    },
    "transaction response time < 2s": () => duration < 2000,
  });

  errorRate.add(!success);
  transactionDuration.add(duration);

  return success;
}

// Verify transaction saved correctly
function verifyTransaction(token, transactionId) {
  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const startTime = Date.now();
  const response = http.get(
    `${BASE_URL}/api/transactions/${transactionId}`,
    params,
  );
  const duration = Date.now() - startTime;

  const success = check(response, {
    "verify status is 200": (r) => r.status === 200,
    "transaction exists": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id === transactionId;
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!success);
  transactionDuration.add(duration);

  return success;
}

// Main test scenario
export default function () {
  // Generate unique phone number for this virtual user
  const phoneNumber = generatePhoneNumber();

  // Step 1: Authenticate user
  const token = authenticateUser(phoneNumber);
  if (!token) {
    console.error(`Failed to authenticate user: ${phoneNumber}`);
    return;
  }

  sleep(0.5); // Brief pause between steps

  // Step 2: Create 3 concurrent transactions (simulating user entering multiple transactions)
  const transactions = [];
  for (let i = 0; i < 3; i++) {
    const transactionData = generateTransactionData(phoneNumber);
    const success = createTransaction(token, transactionData);

    if (success) {
      transactions.push(transactionData);
    }

    sleep(1); // 1 second between transactions
  }

  sleep(0.5);

  // Step 3: Verify all transactions were saved
  console.log(
    `User ${phoneNumber}: Created ${transactions.length} transactions`,
  );

  // Random think time between iterations (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

// Teardown function (runs once after all iterations)
export function teardown(data) {
  console.log("Load test completed");
  console.log(`Total VUs: ${__ENV.K6_VUS || "N/A"}`);
  console.log(`Duration: ${__ENV.K6_DURATION || "N/A"}`);
}
