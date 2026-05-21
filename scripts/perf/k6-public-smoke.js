import http from "k6/http";
import { check, sleep } from "k6";

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
    http_req_failed: [strEnv("THRESHOLD_HTTP_REQ_FAILED", "rate<0.03")],
    http_req_duration: [strEnv("THRESHOLD_HTTP_REQ_DURATION", "p(95)<800")],
  },
};

const baseUrl = strEnv("BASE_URL", "http://localhost:8080");

export default function () {
  const responses = [
    http.get(`${baseUrl}/api/public/home-overview`),
    http.get(`${baseUrl}/api/public/level-rules`),
    http.get(`${baseUrl}/api/tutorials/home`),
    http.get(`${baseUrl}/api/practice/categories`),
    http.get(`${baseUrl}/api/practice/campaign/chapters`),
    http.get(`${baseUrl}/api/practice/question-list`),
    http.get(`${baseUrl}/api/templates`),
  ];

  for (const res of responses) {
    check(res, {
      "public status is 200": (r) => r.status === 200,
    });
  }

  sleep(intEnv("SLEEP_SECONDS", 1));
}
