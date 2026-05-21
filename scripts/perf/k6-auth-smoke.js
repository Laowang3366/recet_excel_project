import http from "k6/http";
import { check, fail, sleep } from "k6";

function intEnv(name, fallback) {
  const value = __ENV[name];
  return value === undefined || value === "" ? fallback : Number.parseInt(value, 10);
}

function strEnv(name, fallback) {
  return __ENV[name] === undefined || __ENV[name] === "" ? fallback : __ENV[name];
}

export const options = {
  vus: intEnv("VUS", 5),
  duration: strEnv("DURATION", "30s"),
  thresholds: {
    http_req_failed: [strEnv("THRESHOLD_HTTP_REQ_FAILED", "rate<0.05")],
    http_req_duration: [strEnv("THRESHOLD_HTTP_REQ_DURATION", "p(95)<1000")],
  },
};

const baseUrl = strEnv("BASE_URL", "http://localhost:8080");
const username = __ENV.K6_USERNAME;
const password = __ENV.K6_PASSWORD;

if (!username || !password) {
  fail("Set K6_USERNAME and K6_PASSWORD for authenticated k6 runs.");
}

function jsonHeaders(token) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
}

function login() {
  const response = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ username, password }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(response, {
    "login status is 200": (r) => r.status === 200,
    "login returns token": (r) => Boolean(r.json("token")),
  });

  const token = response.json("token");
  if (!token) {
    fail(`Login failed for ${username}; status=${response.status}`);
  }
  return token;
}

export default function () {
  const token = login();
  const params = jsonHeaders(token);

  const responses = [
    http.get(`${baseUrl}/api/auth/current`, params),
    http.get(`${baseUrl}/api/notifications/unread-count`, params),
    http.get(`${baseUrl}/api/points/tasks`, params),
    http.get(`${baseUrl}/api/qa/my`, params),
    http.get(`${baseUrl}/api/mall/overview`, params),
    http.get(`${baseUrl}/api/practice/history?page=1&size=10`, params),
    http.get(`${baseUrl}/api/templates/records`, params),
  ];

  for (const res of responses) {
    check(res, {
      "authenticated status is 200": (r) => r.status === 200,
    });
  }

  sleep(intEnv("SLEEP_SECONDS", 1));
}
