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
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function redacted(value) {
  if (!value) {
    return 'missing';
  }
  if (value.length <= 8) {
    return '********';
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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

function runToolCheck(command, args) {
  const result = spawnSync(command, args, {
    cwd: SERVER_DIR,
    encoding: 'utf8',
    timeout: 15000,
  });

  if (result.error) {
    return {
      ok: false,
      details: result.error.message,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      details: (result.stderr || result.stdout || 'Unknown error').trim(),
    };
  }

  return {
    ok: true,
    details: (result.stdout || '').trim(),
  };
}

function runPsqlProbe(connectionString) {
  if (!connectionString) {
    return {
      ok: false,
      details: 'missing connection string',
    };
  }

  const result = spawnSync(
    'psql',
    [connectionString, '-v', 'ON_ERROR_STOP=1', '-tA', '-c', 'SELECT current_database(), current_user;'],
    {
      cwd: SERVER_DIR,
      encoding: 'utf8',
      timeout: 20000,
    }
  );

  if (result.error) {
    return {
      ok: false,
      details: result.error.message,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      details: (result.stderr || result.stdout || 'Unknown psql error').trim(),
    };
  }

  return {
    ok: true,
    details: (result.stdout || '').trim(),
  };
}

function runPgDumpProbe(connectionString, stamp) {
  if (!connectionString) {
    return {
      ok: false,
      details: 'missing connection string',
    };
  }

  const outputFile = path.join(ARTIFACT_DIR, `phase1-schema-probe-${stamp}.sql`);
  const result = spawnSync(
    'pg_dump',
    ['--schema-only', '--no-owner', '--no-privileges', '--dbname', connectionString, '--file', outputFile],
    {
      cwd: SERVER_DIR,
      encoding: 'utf8',
      timeout: 45000,
    }
  );

  if (result.error) {
    return {
      ok: false,
      details: result.error.message,
      outputFile,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      details: (result.stderr || result.stdout || 'Unknown pg_dump error').trim(),
      outputFile,
    };
  }

  return {
    ok: true,
    details: `schema probe written to ${path.relative(ROOT_DIR, outputFile)}`,
    outputFile,
  };
}

async function runClientProbe(connectionString, label) {
  if (!connectionString) {
    return {
      ok: false,
      details: 'missing connection string',
    };
  }

  let ssl = false;
  try {
    const parsed = new URL(connectionString);
    const sslMode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
    const likelyRemote = parsed.hostname && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1';
    if (sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full' || likelyRemote) {
      ssl = { rejectUnauthorized: false };
    }
  } catch (_error) {
    ssl = false;
  }

  const client = new Client({
    connectionString,
    ssl,
    statement_timeout: 10000,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT current_database() AS db_name, current_user AS db_user, now() AS server_time');
    return {
      ok: true,
      details: `${label} reachable (${res.rows[0].db_name} as ${res.rows[0].db_user})`,
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

function buildEnvSnapshotLines(stamp) {
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
    'NEON_NETWORK_NOTES',
  ];

  const lines = [
    '# Phase 1 environment snapshot for rollback and cutover safety',
    `# Generated at ${new Date().toISOString()}`,
    `# Snapshot ID: ${stamp}`,
    '',
  ];

  for (const key of keys) {
    const value = process.env[key];
    lines.push(`${key}=${value || ''}`);
  }

  return lines;
}

function summarizeRequirement(name, value) {
  return {
    name,
    present: Boolean(value),
    maskedValue: redacted(value || ''),
  };
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const stamp = nowStamp();

  const renderUrl = process.env.RENDER_DATABASE_URL || process.env.DATABASE_URL || '';
  const neonPooledUrl = process.env.NEON_POOLED_DATABASE_URL || '';
  const neonDirectUrl = process.env.NEON_DIRECT_DATABASE_URL || '';

  const requiredMetadata = [
    summarizeRequirement('NEON_PROJECT_ID', process.env.NEON_PROJECT_ID),
    summarizeRequirement('NEON_BRANCH_ID', process.env.NEON_BRANCH_ID),
    summarizeRequirement('NEON_DATABASE', process.env.NEON_DATABASE),
    summarizeRequirement('NEON_ROLE', process.env.NEON_ROLE),
    summarizeRequirement('NEON_POOLED_DATABASE_URL', neonPooledUrl),
    summarizeRequirement('NEON_DIRECT_DATABASE_URL', neonDirectUrl),
    summarizeRequirement('NEON_NETWORK_NOTES', process.env.NEON_NETWORK_NOTES),
    summarizeRequirement('RENDER_DATABASE_URL_or_DATABASE_URL', renderUrl),
  ];

  const toolChecks = {
    psqlVersion: runToolCheck('psql', ['--version']),
    pgDumpVersion: runToolCheck('pg_dump', ['--version']),
  };

  const sourceClientProbe = await runClientProbe(renderUrl, 'Render source');
  const targetClientProbe = await runClientProbe(neonDirectUrl || neonPooledUrl, 'Neon target');

  const sourcePsqlProbe = runPsqlProbe(renderUrl);
  const sourcePgDumpProbe = runPgDumpProbe(renderUrl, stamp);

  const report = {
    generatedAt: new Date().toISOString(),
    snapshotId: stamp,
    phase: 'Phase 1 - Access and Preflight',
    metadataRequirements: requiredMetadata,
    connectionSummaries: {
      renderSource: parseConnectionSummary(renderUrl),
      neonPooled: parseConnectionSummary(neonPooledUrl),
      neonDirect: parseConnectionSummary(neonDirectUrl),
    },
    toolChecks,
    probes: {
      sourceClientProbe,
      targetClientProbe,
      sourcePsqlProbe,
      sourcePgDumpProbe,
    },
    followUps: [
      'If Render access is unavailable, open Render support immediately for export/recovery options.',
      'Snapshot deployment platform environment variables manually and store with this local artifact.',
      'Do not proceed to Phase 2 until all required metadata is present and probes pass.',
    ],
  };

  const reportPath = path.join(ARTIFACT_DIR, `phase1-preflight-report-${stamp}.json`);
  const envSnapshotPath = path.join(ARTIFACT_DIR, `phase1-env-snapshot-${stamp}.env`);

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(envSnapshotPath, buildEnvSnapshotLines(stamp).join('\n'), 'utf8');

  console.log('Phase 1 preflight complete.');
  console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);
  console.log(`Env snapshot: ${path.relative(ROOT_DIR, envSnapshotPath)}`);

  const hasMissingMetadata = requiredMetadata.some((item) => !item.present);
  const hasProbeFailure =
    !toolChecks.psqlVersion.ok ||
    !toolChecks.pgDumpVersion.ok ||
    !sourceClientProbe.ok ||
    !targetClientProbe.ok ||
    !sourcePsqlProbe.ok ||
    !sourcePgDumpProbe.ok;

  if (hasMissingMetadata || hasProbeFailure) {
    console.error('Phase 1 preflight found issues. Review the report JSON before proceeding.');
    process.exitCode = 1;
    return;
  }

  console.log('All Phase 1 checks passed. Safe to begin Phase 2 planning.');
}

main().catch((error) => {
  console.error('Phase 1 preflight failed with an unexpected error:', error);
  process.exitCode = 1;
});
