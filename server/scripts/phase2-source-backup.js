#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function toBool(value) {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
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

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

async function queryBaseline(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 10000,
  });

  try {
    await client.connect();

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

    const aggregates = await client.query(
      `SELECT
         COALESCE(SUM(weight), 0)::numeric AS workout_weight_sum,
         (SELECT COALESCE(SUM(duration_minutes), 0)::bigint FROM cardiolist) AS cardio_duration_minutes_sum
       FROM workoutlist`
    );

    return {
      ok: true,
      stats: {
        workoutlist: workoutStats.rows[0],
        cardiolist: cardioStats.rows[0],
        aggregates: aggregates.rows[0],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  } finally {
    try {
      await client.end();
    } catch (_closeError) {
      // Ignore cleanup errors.
    }
  }
}

function runBaselineSqlProbe(connectionString) {
  const sql = [
    "SELECT 'workoutlist' AS table_name, COUNT(*)::bigint AS row_count, MAX(created_at) AS max_created_at FROM workoutlist;",
    "SELECT 'cardiolist' AS table_name, COUNT(*)::bigint AS row_count, MAX(created_at) AS max_created_at FROM cardiolist;",
  ].join(' ');

  return runTool('psql', [connectionString, '-v', 'ON_ERROR_STOP=1', '-tA', '-F', ',', '-c', sql], 30000);
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const stamp = nowStamp();
  const renderUrl = process.env.RENDER_DATABASE_URL || process.env.DATABASE_URL || '';
  const maintenanceWriteLock = toBool(process.env.MAINTENANCE_WRITE_LOCK);

  if (!renderUrl) {
    console.error('Phase 2 failed: RENDER_DATABASE_URL or DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }

  const toolChecks = {
    psqlVersion: runTool('psql', ['--version']),
    pgDumpVersion: runTool('pg_dump', ['--version']),
    pgRestoreVersion: runTool('pg_restore', ['--version']),
  };

  const dumpPath = path.join(ARTIFACT_DIR, `phase2-render-full-${stamp}.dump`);
  const schemaPath = path.join(ARTIFACT_DIR, `phase2-render-schema-${stamp}.sql`);
  const baselinePath = path.join(ARTIFACT_DIR, `phase2-render-baseline-${stamp}.json`);
  const reportPath = path.join(ARTIFACT_DIR, `phase2-backup-report-${stamp}.json`);

  const fullDump = runTool(
    'pg_dump',
    ['--format=custom', '--no-owner', '--no-privileges', '--dbname', renderUrl, '--file', dumpPath],
    180000
  );

  const schemaDump = runTool(
    'pg_dump',
    ['--schema-only', '--no-owner', '--no-privileges', '--dbname', renderUrl, '--file', schemaPath],
    120000
  );

  const restoreListProbe = fullDump.ok
    ? runTool('pg_restore', ['--list', dumpPath], 60000)
    : {
        ok: false,
        details: 'skipped because full dump failed',
      };

  let dumpSha256 = '';
  let schemaSha256 = '';

  if (fullDump.ok && fs.existsSync(dumpPath)) {
    dumpSha256 = sha256File(dumpPath);
  }

  if (schemaDump.ok && fs.existsSync(schemaPath)) {
    schemaSha256 = sha256File(schemaPath);
  }

  const baselineViaPg = await queryBaseline(renderUrl);
  const baselineViaPsql = runBaselineSqlProbe(renderUrl);

  if (baselineViaPg.ok) {
    fs.writeFileSync(baselinePath, JSON.stringify(baselineViaPg.stats, null, 2), 'utf8');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    snapshotId: stamp,
    phase: 'Phase 2 - Source Backup and Integrity Baseline',
    maintenance: {
      writeLockEnabled: maintenanceWriteLock,
      note: maintenanceWriteLock
        ? 'Write lock is enabled. Safe for maintenance-window export.'
        : 'Write lock is not enabled. Enable MAINTENANCE_WRITE_LOCK=true before final export to avoid write drift.',
    },
    sourceConnectionConfigured: true,
    toolChecks,
    artifacts: {
      fullDump: {
        ok: fullDump.ok,
        path: path.relative(ROOT_DIR, dumpPath),
        sha256: dumpSha256 || 'not-generated',
        sizeBytes: fs.existsSync(dumpPath) ? fs.statSync(dumpPath).size : 0,
        details: fullDump.details,
      },
      schemaSnapshot: {
        ok: schemaDump.ok,
        path: path.relative(ROOT_DIR, schemaPath),
        sha256: schemaSha256 || 'not-generated',
        sizeBytes: fs.existsSync(schemaPath) ? fs.statSync(schemaPath).size : 0,
        details: schemaDump.details,
      },
      baseline: {
        ok: baselineViaPg.ok,
        path: baselineViaPg.ok ? path.relative(ROOT_DIR, baselinePath) : 'not-generated',
        details: baselineViaPg.ok ? 'baseline JSON generated' : baselineViaPg.error,
      },
    },
    verification: {
      restoreArchiveMetadataReadable: restoreListProbe.ok,
      restoreArchiveMetadataDetails: restoreListProbe.details,
      baselineProbeWithPsql: {
        ok: baselineViaPsql.ok,
        details: baselineViaPsql.details,
      },
      baselineValues: baselineViaPg.ok ? baselineViaPg.stats : null,
    },
    followUps: [
      'Upload phase2-render-full dump and checksum to secure storage before cutover.',
      'Use baseline JSON values for parity checks after importing into Neon.',
      'Proceed to Phase 3 only if full dump, schema snapshot, and baseline checks all succeed.',
    ],
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('Phase 2 backup + baseline complete.');
  console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);
  console.log(`Full dump: ${path.relative(ROOT_DIR, dumpPath)}`);
  console.log(`Schema snapshot: ${path.relative(ROOT_DIR, schemaPath)}`);
  if (baselineViaPg.ok) {
    console.log(`Baseline snapshot: ${path.relative(ROOT_DIR, baselinePath)}`);
  }

  const hasToolFailures = Object.values(toolChecks).some((result) => !result.ok);
  const hasCriticalFailures =
    !fullDump.ok || !schemaDump.ok || !restoreListProbe.ok || !baselineViaPg.ok || hasToolFailures;

  if (hasCriticalFailures) {
    console.error('Phase 2 found issues. Review the report JSON before proceeding.');
    process.exitCode = 1;
    return;
  }

  if (!maintenanceWriteLock) {
    console.warn('Phase 2 completed, but write lock was not enabled. Re-run in maintenance mode before final cutover export.');
    process.exitCode = 1;
    return;
  }

  console.log('All Phase 2 checks passed. Safe to proceed to Phase 3 preparation.');
}

main().catch((error) => {
  console.error('Phase 2 failed with an unexpected error:', error);
  process.exitCode = 1;
});
