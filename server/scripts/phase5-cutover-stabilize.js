#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const SERVER_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SERVER_DIR, '..');
const ENV_PATH = path.join(SERVER_DIR, '.env');
const ARTIFACT_DIR = path.join(SERVER_DIR, 'preflight-artifacts');

if (fs.existsSync(ENV_PATH)) {
  dotenv.config({ path: ENV_PATH });
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(
    d.getSeconds()
  )}`;
}

function toBool(value) {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseConnectionSummary(rawUrl) {
  if (!rawUrl) {
    return {
      ok: false,
      reason: 'missing',
    };
  }

  try {
    const parsed = new URL(rawUrl);
    const dbName = parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'unknown';
    return {
      ok: true,
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: dbName || 'unknown',
      user: parsed.username || 'unknown',
      sslmode: parsed.searchParams.get('sslmode') || 'not-specified',
    };
  } catch (error) {
    return {
      ok: false,
      reason: error.message,
    };
  }
}

function readEnvFileRaw() {
  if (!fs.existsSync(ENV_PATH)) return '';
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function updateOrInsertEnvVar(rawContent, key, value) {
  const lines = rawContent ? rawContent.split(/\r?\n/) : [];
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`${key}=${value}`);
  }

  return `${updated.join('\n').replace(/\n+$/, '')}\n`;
}

function buildSnapshot(stamp) {
  const keys = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'RENDER_DATABASE_URL',
    'NEON_POOLED_DATABASE_URL',
    'NEON_DIRECT_DATABASE_URL',
    'NEON_PROJECT_ID',
    'NEON_BRANCH_ID',
    'NEON_DATABASE',
    'NEON_ROLE',
    'MAINTENANCE_WRITE_LOCK',
    'EXPO_PUBLIC_API_URL',
  ];

  const lines = [
    '# Phase 5 cutover snapshot',
    `# Generated at ${new Date().toISOString()}`,
    `# Snapshot ID: ${stamp}`,
    '',
  ];

  for (const key of keys) {
    lines.push(`${key}=${process.env[key] || ''}`);
  }

  return `${lines.join('\n')}\n`;
}

function buildClient(connectionString) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 10000,
  });
}

async function probeDatabase(connectionString, label) {
  if (!connectionString) {
    return {
      ok: false,
      details: `${label} not configured`,
    };
  }

  const client = buildClient(connectionString);
  try {
    await client.connect();
    const result = await client.query('SELECT current_database() AS db_name, current_user AS db_user, now() AS server_time');
    return {
      ok: true,
      details: `${label} reachable (${result.rows[0].db_name} as ${result.rows[0].db_user})`,
    };
  } catch (error) {
    return {
      ok: false,
      details: error.message,
    };
  } finally {
    try {
      await client.end();
    } catch (_closeError) {
      // Ignore cleanup errors.
    }
  }
}

async function probeHealth(apiBaseUrl) {
  try {
    const response = await fetch(`${apiBaseUrl}/health`);
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_parseError) {
      body = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      details: response.ok ? 'Health endpoint responded successfully.' : text || 'Health check failed.',
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: null,
      details: error.message,
    };
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const stamp = nowStamp();

  const reportPath = path.join(ARTIFACT_DIR, `phase5-cutover-report-${stamp}.json`);
  const snapshotPath = path.join(ARTIFACT_DIR, `phase5-cutover-env-snapshot-${stamp}.env`);

  const neonPooledUrl = process.env.NEON_POOLED_DATABASE_URL || '';
  const neonDirectUrl = process.env.NEON_DIRECT_DATABASE_URL || '';
  const renderUrl = process.env.RENDER_DATABASE_URL || '';
  const databaseUrl = process.env.DATABASE_URL || '';
  const apiBaseUrl = process.env.PHASE5_API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

  const applyLocalSwitch = toBool(process.env.PHASE5_APPLY_LOCAL_DATABASE_URL_SWITCH);
  const expectApiHealthy = !toBool(process.env.PHASE5_SKIP_HEALTH_CHECK);

  fs.writeFileSync(snapshotPath, buildSnapshot(stamp), 'utf8');

  let localEnvSwitch = {
    attempted: false,
    applied: false,
    details: 'Not requested. Set PHASE5_APPLY_LOCAL_DATABASE_URL_SWITCH=true to update local server/.env.',
  };

  if (applyLocalSwitch) {
    localEnvSwitch.attempted = true;
    if (!neonPooledUrl) {
      localEnvSwitch.applied = false;
      localEnvSwitch.details = 'NEON_POOLED_DATABASE_URL is required for local switch.';
    } else {
      const currentRaw = readEnvFileRaw();
      const updatedRaw = updateOrInsertEnvVar(currentRaw, 'DATABASE_URL', neonPooledUrl);
      fs.writeFileSync(ENV_PATH, updatedRaw, 'utf8');
      process.env.DATABASE_URL = neonPooledUrl;
      localEnvSwitch.applied = true;
      localEnvSwitch.details = 'Updated local server/.env DATABASE_URL to NEON_POOLED_DATABASE_URL.';
    }
  }

  const probes = {
    neonPooledProbe: await probeDatabase(neonPooledUrl, 'Neon pooled'),
    neonDirectProbe: await probeDatabase(neonDirectUrl, 'Neon direct'),
    renderRollbackProbe: await probeDatabase(renderUrl, 'Render rollback source'),
    apiHealth: expectApiHealthy
      ? await probeHealth(apiBaseUrl)
      : {
          ok: true,
          status: null,
          body: null,
          details: 'Skipped by PHASE5_SKIP_HEALTH_CHECK.',
        },
  };

  const checklist = [
    {
      name: 'Update production DATABASE_URL to Neon pooled URL',
      doneByScript: false,
      status: 'manual-required',
    },
    {
      name: 'Redeploy/restart backend after env update',
      doneByScript: false,
      status: 'manual-required',
    },
    {
      name: 'Verify mobile app API connectivity and EXPO_PUBLIC_API_URL if host changed',
      doneByScript: false,
      status: 'manual-required',
    },
    {
      name: 'Monitor logs for one business cycle and keep rollback credentials/artifacts',
      doneByScript: false,
      status: 'manual-required',
    },
  ];

  const criticalChecks = [
    { name: 'NEON_POOLED_DATABASE_URL configured', ok: Boolean(neonPooledUrl) },
    { name: 'NEON pooled connectivity probe', ok: probes.neonPooledProbe.ok },
    { name: 'NEON direct connectivity probe', ok: probes.neonDirectProbe.ok || !neonDirectUrl },
    { name: 'Render rollback URL configured', ok: Boolean(renderUrl) },
    { name: 'Render rollback connectivity probe', ok: probes.renderRollbackProbe.ok },
    { name: 'API health check', ok: probes.apiHealth.ok },
  ];

  const allCriticalPassed = criticalChecks.every((check) => check.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    snapshotId: stamp,
    phase: 'Phase 5 - Cutover and Stabilization',
    envSnapshotPath: path.relative(ROOT_DIR, snapshotPath),
    connectionSummaries: {
      databaseUrlCurrent: parseConnectionSummary(process.env.DATABASE_URL || databaseUrl),
      neonPooled: parseConnectionSummary(neonPooledUrl),
      neonDirect: parseConnectionSummary(neonDirectUrl),
      renderRollback: parseConnectionSummary(renderUrl),
    },
    localEnvSwitch,
    probes,
    criticalChecks,
    allCriticalPassed,
    manualChecklist: checklist,
    rollback: {
      recommendedAction: 'If severe regressions occur, restore production DATABASE_URL to Render and redeploy.',
      renderUrlConfigured: Boolean(renderUrl),
      renderConnectivityOk: probes.renderRollbackProbe.ok,
    },
    followUps: [
      'This script cannot update deployment platform env vars or redeploy automatically; complete manual checklist items.',
      'If all critical checks pass, perform production env update and restart to complete Phase 5.',
    ],
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('Phase 5 cutover and stabilization checks complete.');
  console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);
  console.log(`Env snapshot: ${path.relative(ROOT_DIR, snapshotPath)}`);

  if (!allCriticalPassed) {
    console.error('Phase 5 checks found issues. Review the report JSON before production cutover.');
    process.exitCode = 1;
    return;
  }

  console.log('Phase 5 critical checks passed. Proceed with manual production cutover checklist.');
}

main().catch((error) => {
  console.error('Phase 5 failed with an unexpected error:', error);
  process.exitCode = 1;
});
