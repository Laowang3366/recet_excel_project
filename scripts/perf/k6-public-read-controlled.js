import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

function intEnv(name, fallback) {
  const value = __ENV[name];
  return value === undefined || value === "" ? fallback : Number.parseInt(value, 10);
}

function strEnv(name, fallback) {
  return __ENV[name] === undefined || __ENV[name] === "" ? fallback : __ENV[name];
}

const vus = intEnv("VUS", 10);
const duration = strEnv("DURATION", "60s");
const sleepMs = intEnv("SLEEP_MS", 1000);
const baseUrl = strEnv("BASE_URL", "https://www.excelcc.cn");

export const options = {
  discardResponseBodies: true,
  scenarios: {
    public_read: {
      executor: "constant-vus",
      vus,
      duration,
      gracefulStop: "30s",
    },
  },
  thresholds: {
    http_req_failed: [
      { threshold: strEnv("THRESHOLD_HTTP_REQ_FAILED", "rate<0.02"), abortOnFail: true, delayAbortEval: "30s" },
    ],
    http_req_duration: [
      { threshold: strEnv("THRESHOLD_HTTP_REQ_DURATION", "p(95)<2000"), abortOnFail: true, delayAbortEval: "60s" },
    ],
    checks: [
      { threshold: strEnv("THRESHOLD_CHECKS", "rate>0.98"), abortOnFail: true, delayAbortEval: "30s" },
    ],
  },
};

const paths = [
  "/",
  "/tutorials",
  "/practice",
  "/templates",
  "/mall",
  "/tools",
  "/api/public/home-overview",
  "/api/public/level-rules",
  "/api/tutorials/home",
  "/api/practice/categories",
];

function metricName(prefix, path) {
  return `${prefix}_${path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "root"}`;
}

const requestCounters = {};
const failedCounters = {};

for (const path of paths) {
  requestCounters[path] = new Counter(metricName("path_requests", path));
  failedCounters[path] = new Counter(metricName("path_failed", path));
}

export default function () {
  const path = paths[(__VU + __ITER) % paths.length];
  const response = http.get(`${baseUrl}${path}`, { tags: { path } });
  requestCounters[path].add(1);

  check(response, {
    "status is 200": (res) => res.status === 200,
  });

  if (response.status !== 200) {
    failedCounters[path].add(1);
  }

  sleep(sleepMs / 1000);
}
