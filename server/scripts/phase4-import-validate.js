#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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

function findLatestArtifact(prefix, extension) {
  if (!fs.existsSync(ARTIFACT_DIR)) return '';

  const files = fs
    .readdirSync(ARTIFACT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
    .sort();

  if (files.length === 0) return '';
  return path.join(ARTIFACT_DIR, files[files.length - 1]);
}

function runTool(command, args, timeout = 120000) {
  const result = spawnSync(command, args, {
    cwd: SERVER_DIR,
    encoding: 'utf8',
    timeout,
  });

  if (result.error) {
    return {
      ok: false,
      details: result.error.message,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      details: (result.stderr || result.stdout || 'Unknown process error').trim(),
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  }

  return {
    ok: true,
    details: (result.stdout || '').trim(),
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function buildClient(connectionString) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 15000,
  });
}

function isoOrNull(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch (_error) {
    return String(value);
  }
}

function valueAsString(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function buildParityCheck(name, expectedValue, actualValue) {
  const expected = valueAsString(expectedValue);
  const actual = valueAsString(actualValue);
  return {
    name,
    expected,
    actual,
    match: expected === actual,
  };
}

async function gatherTargetStats(client) {
  const [workoutStats, cardioStats] = await Promise.all([
    client.query(
      `SELECT
         COUNT(*)::bigint AS row_count,
         MAX(created_at) AS max_created_at,
         MIN(created_at) AS min_created_at
       FROM workoutlist`
    ),
    client.query(
      `SELECT
         COUNT(*)::bigint AS row_count,
         MAX(created_at) AS max_created_at,
         MIN(created_at) AS min_created_at
       FROM cardiolist`
    ),
  ]);

  return {
    workoutlist: {
      row_count: valueAsString(workoutStats.rows[0].row_count),
      max_created_at: isoOrNull(workoutStats.rows[0].max_created_at),
      min_created_at: isoOrNull(workoutStats.rows[0].min_created_at),
    },
    cardiolist: {
      row_count: valueAsString(cardioStats.rows[0].row_count),
      max_created_at: isoOrNull(cardioStats.rows[0].max_created_at),
      min_created_at: isoOrNull(cardioStats.rows[0].min_created_at),
    },
  };
}

function normalizeBaseline(raw) {
  const base = raw || {};
  return {
    workoutlist: {
      row_count: valueAsString(base.workoutlist && base.workoutlist.row_count),
      max_created_at: isoOrNull(base.workoutlist && base.workoutlist.max_created_at),
      min_created_at: isoOrNull(base.workoutlist && base.workoutlist.min_created_at),
    },
    cardiolist: {
      row_count: valueAsString(base.cardiolist && base.cardiolist.row_count),
      max_created_at: isoOrNull(base.cardiolist && base.cardiolist.max_created_at),
      min_created_at: isoOrNull(base.cardiolist && base.cardiolist.min_created_at),
    },
  };
}

async function apiRequest(baseUrl, requestPath, method, body) {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_error) {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    body: json,
    rawText: text,
  };
}

async function runApiSmoke(baseUrl) {
  const checks = [];
  let allPassed = true;

  async function runRead(name, requestPath) {
    try {
      const result = await apiRequest(baseUrl, requestPath, 'GET');
      const check = {
        name,
        ok: result.ok,
        status: result.status,
        details: result.ok ? 'Read endpoint responded successfully.' : result.rawText || 'Read endpoint failed.',
      };
      checks.push(check);
      if (!check.ok) allPassed = false;
      return result;
    } catch (error) {
      const check = {
        name,
        ok: false,
        status: null,
        details: error.message,
      };
      checks.push(check);
      allPassed = false;
      return null;
    }
  }

  await runRead('GET /health', '/health');
  await runRead('GET /workoutlist', '/workoutlist');
  await runRead('GET /cardiolist', '/cardiolist');

  try {
    const workoutCreate = await apiRequest(baseUrl, '/workoutlist', 'POST', {
      name: `phase4-workout-${Date.now()}`,
      weight: '100',
      created_at: new Date().toISOString(),
    });

    const workoutId = workoutCreate.body && workoutCreate.body.workout_id;
    const workoutCreateCheck = {
      name: 'POST /workoutlist',
      ok: workoutCreate.ok && Boolean(workoutId),
      status: workoutCreate.status,
      details: workoutCreate.ok ? 'Workout create succeeded.' : workoutCreate.rawText || 'Workout create failed.',
    };
    checks.push(workoutCreateCheck);
    if (!workoutCreateCheck.ok) allPassed = false;

    if (workoutId) {
      const workoutUpdate = await apiRequest(baseUrl, `/workoutlist/${workoutId}`, 'PUT', {
        name: `phase4-workout-updated-${Date.now()}`,
        weight: '101',
        created_at: new Date().toISOString(),
      });
      const workoutDelete = await apiRequest(baseUrl, `/workoutlist/${workoutId}`, 'DELETE');

      const workoutUpdateCheck = {
        name: 'PUT /workoutlist/:id',
        ok: workoutUpdate.ok,
        status: workoutUpdate.status,
        details: workoutUpdate.ok ? 'Workout update succeeded.' : workoutUpdate.rawText || 'Workout update failed.',
      };
      const workoutDeleteCheck = {
        name: 'DELETE /workoutlist/:id',
        ok: workoutDelete.ok,
        status: workoutDelete.status,
        details: workoutDelete.ok ? 'Workout delete succeeded.' : workoutDelete.rawText || 'Workout delete failed.',
      };
      checks.push(workoutUpdateCheck);
      checks.push(workoutDeleteCheck);
      if (!workoutUpdateCheck.ok || !workoutDeleteCheck.ok) allPassed = false;
    }
  } catch (error) {
    checks.push({
      name: 'workout CRUD sequence',
      ok: false,
      status: null,
      details: error.message,
    });
    allPassed = false;
  }

  try {
    const cardioCreate = await apiRequest(baseUrl, '/cardiolist', 'POST', {
      name: `phase4-cardio-${Date.now()}`,
      duration_minutes: 20,
      created_at: new Date().toISOString(),
    });

    const cardioId = cardioCreate.body && cardioCreate.body.cardio_id;
    const cardioCreateCheck = {
      name: 'POST /cardiolist',
      ok: cardioCreate.ok && Boolean(cardioId),
      status: cardioCreate.status,
      details: cardioCreate.ok ? 'Cardio create succeeded.' : cardioCreate.rawText || 'Cardio create failed.',
    };
    checks.push(cardioCreateCheck);
    if (!cardioCreateCheck.ok) allPassed = false;

    if (cardioId) {
      const cardioUpdate = await apiRequest(baseUrl, `/cardiolist/${cardioId}`, 'PUT', {
        name: `phase4-cardio-updated-${Date.now()}`,
        duration_minutes: 25,
        created_at: new Date().toISOString(),
      });
      const cardioDelete = await apiRequest(baseUrl, `/cardiolist/${cardioId}`, 'DELETE');

      const cardioUpdateCheck = {
        name: 'PUT /cardiolist/:id',
        ok: cardioUpdate.ok,
        status: cardioUpdate.status,
        details: cardioUpdate.ok ? 'Cardio update succeeded.' : cardioUpdate.rawText || 'Cardio update failed.',
      };
      const cardioDeleteCheck = {
        name: 'DELETE /cardiolist/:id',
        ok: cardioDelete.ok,
        status: cardioDelete.status,
        details: cardioDelete.ok ? 'Cardio delete succeeded.' : cardioDelete.rawText || 'Cardio delete failed.',
      };
      checks.push(cardioUpdateCheck);
      checks.push(cardioDeleteCheck);
      if (!cardioUpdateCheck.ok || !cardioDeleteCheck.ok) allPassed = false;
    }
  } catch (error) {
    checks.push({
      name: 'cardio CRUD sequence',
      ok: false,
      status: null,
      details: error.message,
    });
    allPassed = false;
  }

  return {
    allPassed,
    checks,
  };
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const stamp = nowStamp();

  const neonPooledUrl = process.env.NEON_POOLED_DATABASE_URL || '';
  const neonDirectUrl = process.env.NEON_DIRECT_DATABASE_URL || '';
  const adminConnection = neonDirectUrl || neonPooledUrl;

  const reportPath = path.join(ARTIFACT_DIR, `phase4-import-validation-report-${stamp}.json`);
  const baselinePath = process.env.PHASE4_BASELINE_PATH || findLatestArtifact('phase2-render-baseline-', '.json');
  const dumpPath = process.env.PHASE4_DUMP_PATH || findLatestArtifact('phase2-render-full-', '.dump');
  const apiBaseUrl = process.env.PHASE4_API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const skipApiSmoke = toBool(process.env.PHASE4_SKIP_API_SMOKE);

  const toolChecks = {
    pgRestoreVersion: runTool('pg_restore', ['--version']),
  };

  const prerequisites = {
    dumpPath,
    dumpExists: Boolean(dumpPath) && fs.existsSync(dumpPath),
    baselinePath,
    baselineExists: Boolean(baselinePath) && fs.existsSync(baselinePath),
    adminConnectionConfigured: Boolean(adminConnection),
  };

  if (!prerequisites.dumpExists || !prerequisites.baselineExists || !prerequisites.adminConnectionConfigured || !toolChecks.pgRestoreVersion.ok) {
    const failedReport = {
      generatedAt: new Date().toISOString(),
      snapshotId: stamp,
      phase: 'Phase 4 - Import and Validation',
      prerequisites,
      toolChecks,
      connectionSummaries: {
        neonPooled: parseConnectionSummary(neonPooledUrl),
        neonDirect: parseConnectionSummary(neonDirectUrl),
      },
      result: {
        ok: false,
        reason: 'Missing required prerequisites for Phase 4.',
      },
      followUps: [
        'Ensure Phase 2 artifacts exist and set PHASE4_DUMP_PATH/PHASE4_BASELINE_PATH if needed.',
        'Ensure NEON_DIRECT_DATABASE_URL (or pooled fallback) is configured.',
      ],
    };

    fs.writeFileSync(reportPath, JSON.stringify(failedReport, null, 2), 'utf8');
    console.error('Phase 4 failed: missing prerequisites.');
    console.error(`Report: ${path.relative(ROOT_DIR, reportPath)}`);
    process.exitCode = 1;
    return;
  }

  const baselineRaw = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const baseline = normalizeBaseline(baselineRaw);

  const restoreCommand = [
    '--no-owner',
    '--no-privileges',
    '--data-only',
    '--disable-triggers',
    '--dbname',
    adminConnection,
    dumpPath,
  ];

  const client = buildClient(adminConnection);
  let restoreResult = null;
  let targetStats = null;
  let parityChecks = [];
  let apiSmoke = { allPassed: false, checks: [{ name: 'API smoke tests', ok: false, status: null, details: 'Not executed.' }] };

  try {
    await client.connect();

    await client.query('TRUNCATE TABLE workoutlist, cardiolist RESTART IDENTITY');
    restoreResult = runTool('pg_restore', restoreCommand, 300000);

    if (!restoreResult.ok) {
      throw new Error(`pg_restore failed: ${restoreResult.details}`);
    }

    targetStats = await gatherTargetStats(client);

    parityChecks = [
      buildParityCheck('workoutlist.row_count', baseline.workoutlist.row_count, targetStats.workoutlist.row_count),
      buildParityCheck('workoutlist.max_created_at', baseline.workoutlist.max_created_at, targetStats.workoutlist.max_created_at),
      buildParityCheck('workoutlist.min_created_at', baseline.workoutlist.min_created_at, targetStats.workoutlist.min_created_at),
      buildParityCheck('cardiolist.row_count', baseline.cardiolist.row_count, targetStats.cardiolist.row_count),
      buildParityCheck('cardiolist.max_created_at', baseline.cardiolist.max_created_at, targetStats.cardiolist.max_created_at),
      buildParityCheck('cardiolist.min_created_at', baseline.cardiolist.min_created_at, targetStats.cardiolist.min_created_at),
    ];

    if (skipApiSmoke) {
      apiSmoke = {
        allPassed: true,
        checks: [
          {
            name: 'API smoke tests',
            ok: true,
            status: null,
            details: 'Skipped because PHASE4_SKIP_API_SMOKE is enabled.',
          },
        ],
      };
    } else {
      apiSmoke = await runApiSmoke(apiBaseUrl);
    }

    const parityPassed = parityChecks.every((check) => check.match);

    const report = {
      generatedAt: new Date().toISOString(),
      snapshotId: stamp,
      phase: 'Phase 4 - Import and Validation',
      prerequisites,
      toolChecks,
      connectionSummaries: {
        neonPooled: parseConnectionSummary(neonPooledUrl),
        neonDirect: parseConnectionSummary(neonDirectUrl),
      },
      importOperation: {
        truncateBeforeRestore: true,
        pgRestoreArgs: restoreCommand.filter((arg) => !arg.includes('postgresql://')),
        usedAdminConnection: neonDirectUrl ? 'NEON_DIRECT_DATABASE_URL' : 'NEON_POOLED_DATABASE_URL',
        restoreOk: restoreResult.ok,
        restoreDetails: restoreResult.details,
      },
      parity: {
        baseline,
        target: targetStats,
        checks: parityChecks,
        allPassed: parityPassed,
      },
      apiSmoke: {
        baseUrl: apiBaseUrl,
        skipped: skipApiSmoke,
        allPassed: apiSmoke.allPassed,
        checks: apiSmoke.checks,
      },
      result: {
        ok: parityPassed && apiSmoke.allPassed,
        note:
          parityPassed && apiSmoke.allPassed
            ? 'Phase 4 passed. Safe to continue to Phase 5 cutover and stabilization.'
            : 'Phase 4 failed. Review parity/API smoke failures before cutover.',
      },
      followUps: [
        'If API smoke checks failed, ensure backend is running and pointed at Neon before rerunning.',
        'Do not proceed to Phase 5 until parity and API smoke checks are green.',
      ],
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('Phase 4 import and validation complete.');
    console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);

    if (!report.result.ok) {
      process.exitCode = 1;
      return;
    }

    console.log('All Phase 4 checks passed. Safe to proceed to Phase 5 cutover and stabilization.');
  } catch (error) {
    const failedReport = {
      generatedAt: new Date().toISOString(),
      snapshotId: stamp,
      phase: 'Phase 4 - Import and Validation',
      prerequisites,
      toolChecks,
      connectionSummaries: {
        neonPooled: parseConnectionSummary(neonPooledUrl),
        neonDirect: parseConnectionSummary(neonDirectUrl),
      },
      importOperation: {
        restoreOk: restoreResult ? restoreResult.ok : false,
        restoreDetails: restoreResult ? restoreResult.details : 'restore not started',
      },
      parity: {
        checks: parityChecks,
        allPassed: false,
      },
      apiSmoke: {
        baseUrl: apiBaseUrl,
        skipped: skipApiSmoke,
        allPassed: false,
        checks: apiSmoke.checks,
      },
      result: {
        ok: false,
        note: error.message,
      },
      followUps: [
        'Fix the reported Phase 4 issue and rerun this command before cutover.',
      ],
    };

    fs.writeFileSync(reportPath, JSON.stringify(failedReport, null, 2), 'utf8');
    console.error('Phase 4 failed with an unexpected error.');
    console.error(`Report: ${path.relative(ROOT_DIR, reportPath)}`);
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch (_closeError) {
      // Ignore cleanup errors.
    }
  }
}

main();
