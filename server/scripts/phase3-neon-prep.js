#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const SERVER_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SERVER_DIR, '..');
const ENV_PATH = path.join(SERVER_DIR, '.env');
const ARTIFACT_DIR = path.join(SERVER_DIR, 'preflight-artifacts');
const BASELINE_SQL_PATH = path.join(SERVER_DIR, 'database.sql');
const MIGRATIONS_DIR = path.join(SERVER_DIR, 'migrations');

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

function redacted(value) {
  if (!value) return 'missing';
  if (value.length <= 8) return '********';
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

function summarizeRequirement(name, value) {
  return {
    name,
    present: Boolean(value),
    maskedValue: redacted(value || ''),
  };
}

function buildNeonClient(connectionString) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 15000,
  });
}

function sanitizeBaselineSql(rawSql) {
  return rawSql
    .split('\n')
    .filter((line) => !/^\s*CREATE\s+DATABASE\b/i.test(line))
    .join('\n')
    .trim();
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

async function executeSqlFile(client, filePath) {
  const fileName = path.basename(filePath);
  let sql = fs.readFileSync(filePath, 'utf8');

  if (fileName === 'database.sql') {
    sql = sanitizeBaselineSql(sql);
  }

  if (!sql.trim()) {
    return {
      ok: true,
      file: fileName,
      details: 'No executable SQL after sanitization.',
    };
  }

  try {
    await client.query(sql);
    return {
      ok: true,
      file: fileName,
      details: 'Applied successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      file: fileName,
      details: error.message,
    };
  }
}

async function validateSchema(client) {
  const [workoutTable, cardioTable, workoutWeight, workoutCreatedAt, cardioDuration, cardioCreatedAt, createdAtIndex] = await Promise.all([
    queryOne(
      client,
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'workoutlist'
       ) AS present`
    ),
    queryOne(
      client,
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'cardiolist'
       ) AS present`
    ),
    queryOne(
      client,
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'workoutlist' AND column_name = 'weight'
       ) AS present`
    ),
    queryOne(
      client,
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'workoutlist' AND column_name = 'created_at'
       ) AS present`
    ),
    queryOne(
      client,
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cardiolist' AND column_name = 'duration_minutes'
       ) AS present`
    ),
    queryOne(
      client,
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cardiolist' AND column_name = 'created_at'
       ) AS present`
    ),
    queryOne(
      client,
      `SELECT EXISTS (
         SELECT 1
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'workoutlist'
           AND indexname = 'idx_workoutlist_created_at'
       ) AS present`
    ),
  ]);

  const checks = [
    { name: 'table:workoutlist', ok: Boolean(workoutTable.present) },
    { name: 'table:cardiolist', ok: Boolean(cardioTable.present) },
    { name: 'column:workoutlist.weight', ok: Boolean(workoutWeight.present) },
    { name: 'column:workoutlist.created_at', ok: Boolean(workoutCreatedAt.present) },
    { name: 'column:cardiolist.duration_minutes', ok: Boolean(cardioDuration.present) },
    { name: 'column:cardiolist.created_at', ok: Boolean(cardioCreatedAt.present) },
    { name: 'index:idx_workoutlist_created_at', ok: Boolean(createdAtIndex.present) },
  ];

  return {
    checks,
    allPassed: checks.every((item) => item.ok),
  };
}

function resolveRuntimeConnectionRecommendation() {
  const pooled = process.env.NEON_POOLED_DATABASE_URL || '';
  const direct = process.env.NEON_DIRECT_DATABASE_URL || '';

  return {
    appRuntimeConnection: pooled ? 'NEON_POOLED_DATABASE_URL' : 'not-configured',
    adminConnection: direct ? 'NEON_DIRECT_DATABASE_URL' : pooled ? 'NEON_POOLED_DATABASE_URL (fallback)' : 'not-configured',
    note:
      pooled && direct
        ? 'Use pooled URL for app runtime and direct URL for admin operations (migrations/restore).'
        : 'Both pooled and direct URLs should be configured for recommended production operation.',
  };
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const stamp = nowStamp();

  const neonPooledUrl = process.env.NEON_POOLED_DATABASE_URL || '';
  const neonDirectUrl = process.env.NEON_DIRECT_DATABASE_URL || '';
  const neonDatabase = process.env.NEON_DATABASE || '';
  const adminConnection = neonDirectUrl || neonPooledUrl;

  const requiredMetadata = [
    summarizeRequirement('NEON_PROJECT_ID', process.env.NEON_PROJECT_ID),
    summarizeRequirement('NEON_BRANCH_ID', process.env.NEON_BRANCH_ID),
    summarizeRequirement('NEON_DATABASE', neonDatabase),
    summarizeRequirement('NEON_ROLE', process.env.NEON_ROLE),
    summarizeRequirement('NEON_POOLED_DATABASE_URL', neonPooledUrl),
    summarizeRequirement('NEON_DIRECT_DATABASE_URL', neonDirectUrl),
  ];

  const reportPath = path.join(ARTIFACT_DIR, `phase3-neon-prep-report-${stamp}.json`);

  const missingRequirements = requiredMetadata.filter((item) => !item.present);
  if (!adminConnection || missingRequirements.length > 0) {
    const failedReport = {
      generatedAt: new Date().toISOString(),
      snapshotId: stamp,
      phase: 'Phase 3 - Neon Preparation',
      metadataRequirements: requiredMetadata,
      connectionSummaries: {
        neonPooled: parseConnectionSummary(neonPooledUrl),
        neonDirect: parseConnectionSummary(neonDirectUrl),
      },
      runtimeConnectionDecision: resolveRuntimeConnectionRecommendation(),
      setup: {
        started: false,
        reason: 'Missing required Phase 3 Neon metadata/URLs.',
      },
      followUps: [
        'Populate all required NEON_* variables, then rerun Phase 3.',
        'Do not proceed to Phase 4 import until this report is fully green.',
      ],
    };

    fs.writeFileSync(reportPath, JSON.stringify(failedReport, null, 2), 'utf8');
    console.error('Phase 3 failed: missing required Neon metadata/URLs.');
    console.error(`Report: ${path.relative(ROOT_DIR, reportPath)}`);
    process.exitCode = 1;
    return;
  }

  const client = buildNeonClient(adminConnection);
  const applySteps = [];
  let schemaValidation = { checks: [], allPassed: false };

  try {
    await client.connect();

    const tableCountRow = await queryOne(
      client,
      `SELECT COUNT(*)::int AS table_count
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );

    const publicTableCount = Number(tableCountRow.table_count || 0);
    const isLikelyEmptyTarget = publicTableCount === 0;

    if (isLikelyEmptyTarget) {
      applySteps.push(await executeSqlFile(client, BASELINE_SQL_PATH));
    } else {
      applySteps.push({
        ok: true,
        file: path.basename(BASELINE_SQL_PATH),
        details: `Skipped baseline because target is not empty (public base tables: ${publicTableCount}).`,
      });
    }

    const orderedMigrations = [
      'add_weight_column.sql',
      'add_created_at_column.sql',
      'add_cardio_table.sql',
    ].map((fileName) => path.join(MIGRATIONS_DIR, fileName));

    for (const migrationPath of orderedMigrations) {
      const migrationFile = path.basename(migrationPath);
      if (!fs.existsSync(migrationPath)) {
        applySteps.push({
          ok: false,
          file: migrationFile,
          details: 'Migration file not found.',
        });
        continue;
      }

      applySteps.push(await executeSqlFile(client, migrationPath));
    }

    schemaValidation = await validateSchema(client);

    const report = {
      generatedAt: new Date().toISOString(),
      snapshotId: stamp,
      phase: 'Phase 3 - Neon Preparation',
      metadataRequirements: requiredMetadata,
      connectionSummaries: {
        neonPooled: parseConnectionSummary(neonPooledUrl),
        neonDirect: parseConnectionSummary(neonDirectUrl),
      },
      runtimeConnectionDecision: resolveRuntimeConnectionRecommendation(),
      setup: {
        started: true,
        usedAdminConnection: neonDirectUrl ? 'NEON_DIRECT_DATABASE_URL' : 'NEON_POOLED_DATABASE_URL',
        appliedSteps: applySteps,
      },
      validation: schemaValidation,
      followUps: [
        'Use this report during Phase 4 import to confirm target schema shape before restore.',
        'Keep direct URL reserved for admin tasks; deploy backend with pooled URL.',
      ],
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('Phase 3 Neon preparation complete.');
    console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);

    const applyFailures = applySteps.some((step) => !step.ok);
    if (applyFailures || !schemaValidation.allPassed) {
      console.error('Phase 3 found issues. Review the report JSON before proceeding to Phase 4.');
      process.exitCode = 1;
      return;
    }

    console.log('All Phase 3 checks passed. Safe to proceed to Phase 4 import and validation.');
  } catch (error) {
    const failedReport = {
      generatedAt: new Date().toISOString(),
      snapshotId: stamp,
      phase: 'Phase 3 - Neon Preparation',
      metadataRequirements: requiredMetadata,
      connectionSummaries: {
        neonPooled: parseConnectionSummary(neonPooledUrl),
        neonDirect: parseConnectionSummary(neonDirectUrl),
      },
      runtimeConnectionDecision: resolveRuntimeConnectionRecommendation(),
      setup: {
        started: true,
        appliedSteps: applySteps,
      },
      validation: schemaValidation,
      error: error.message,
      followUps: [
        'Fix the reported error and rerun Phase 3 before starting Phase 4.',
      ],
    };

    fs.writeFileSync(reportPath, JSON.stringify(failedReport, null, 2), 'utf8');
    console.error('Phase 3 failed with an unexpected error.');
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
