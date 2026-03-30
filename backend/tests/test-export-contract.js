/*
 * Export Contract Smoke Test
 *
 * Verifies required study export fields from the contract:
 * - JSON export includes sessionSpec and participants
 * - Metrics CSV includes condition/run and participant columns
 *
 * Usage:
 *   node tests/test-export-contract.js
 *
 * Optional env vars:
 *   EXPORT_BASE_URL=http://localhost:5000
 *   EXPORT_TEAM_ID=study-team-01
 *   EXPORT_SESSION_ID=session-1
 */

const BASE_URL = process.env.EXPORT_BASE_URL || 'http://localhost:5000';
const TEAM_ID = process.env.EXPORT_TEAM_ID || 'study-team-01';
const SESSION_ID = process.env.EXPORT_SESSION_ID || '';

function buildSessionUrl(format) {
  const params = new URLSearchParams({ format });
  if (SESSION_ID) {
    params.set('sessionId', SESSION_ID);
  }
  return `${BASE_URL}/api/export/session/${encodeURIComponent(TEAM_ID)}?${params.toString()}`;
}

async function fetchJsonExport() {
  const url = buildSessionUrl('json');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`JSON export failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function fetchMetricsCsv() {
  const url = buildSessionUrl('metrics-csv');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Metrics CSV export failed (${response.status}): ${await response.text()}`);
  }
  return response.text();
}

function assertJsonContract(payload) {
  const failures = [];

  if (!payload || typeof payload !== 'object') {
    failures.push('JSON payload is missing or invalid object.');
    return failures;
  }

  if (!payload.sessionSpec || typeof payload.sessionSpec !== 'object') {
    failures.push('Missing sessionSpec object.');
  } else {
    const requiredSessionSpecKeys = [
      'teamId',
      'teamName',
      'conditionFlag',
      'runOrder',
      'runOneCondition',
      'runTwoCondition',
    ];

    for (const key of requiredSessionSpecKeys) {
      if (!(key in payload.sessionSpec)) {
        failures.push(`sessionSpec missing key: ${key}`);
      }
    }
  }

  if (!Array.isArray(payload.participants)) {
    failures.push('Missing participants array.');
  } else if (payload.participants.length === 0) {
    failures.push('participants array is empty.');
  }

  if (!Array.isArray(payload.messages)) {
    failures.push('Missing messages array.');
  }

  if (!Array.isArray(payload.insights)) {
    failures.push('Missing insights array.');
  }

  if (!Array.isArray(payload.timeline)) {
    failures.push('Missing timeline array.');
  }

  if (!payload.metrics || typeof payload.metrics !== 'object') {
    failures.push('Missing metrics object.');
  }

  return failures;
}

function assertMetricsCsvContract(csvText) {
  const failures = [];
  const firstLine = csvText.split('\n').find((line) => line.trim().length > 0) || '';
  const headers = firstLine.split(',').map((item) => item.trim());

  const requiredHeaders = [
    'teamName',
    'conditionFlag',
    'runOrder',
    'runOneCondition',
    'runTwoCondition',
    'participantCount',
    'humanParticipantCount',
  ];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      failures.push(`metrics-csv missing header: ${header}`);
    }
  }

  return failures;
}

async function main() {
  console.log('[ExportContractTest] Base URL:', BASE_URL);
  console.log('[ExportContractTest] Team ID:', TEAM_ID);
  if (SESSION_ID) {
    console.log('[ExportContractTest] Session ID:', SESSION_ID);
  }

  const jsonPayload = await fetchJsonExport();
  const jsonFailures = assertJsonContract(jsonPayload);

  const metricsCsv = await fetchMetricsCsv();
  const csvFailures = assertMetricsCsvContract(metricsCsv);

  const failures = [...jsonFailures, ...csvFailures];

  if (failures.length > 0) {
    console.error('[ExportContractTest] FAILED');
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[ExportContractTest] PASSED');
}

main().catch((error) => {
  console.error('[ExportContractTest] ERROR:', error.message || error);
  process.exitCode = 1;
});
