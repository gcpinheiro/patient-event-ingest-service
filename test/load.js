import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

export const options = {
  scenarios: { ingestion: { executor: 'constant-arrival-rate', rate: 1000, timeUnit: '1m', duration: '1m', preAllocatedVUs: 30, maxVUs: 100 } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'], checks: ['rate==1'], dropped_iterations: ['count==0'] },
};

export default function () {
  const id = exec.scenario.iterationInTest;
  const response = http.post(`${__ENV.BASE_URL || 'http://host.docker.internal:3000'}/events`, JSON.stringify({
    patientId: `load-${__ENV.RUN_ID}-${id % 200}`, type: 'LOAD_TEST', data: { run: __ENV.RUN_ID, id }, ts: new Date().toISOString(),
  }), { headers: { 'Content-Type': 'application/json' } });
  check(response, { 'accepted': r => r.status === 202 });
}
