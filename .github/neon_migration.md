## Plan: Render to Neon Data Migration

Migrate all existing PostgreSQL data from Render to Neon using a short maintenance-window cutover, with backup-first safeguards and a rollback path. The backend already supports `DATABASE_URL`, so the critical work is credential verification, source export, schema/data validation, connection cutover, and post-cutover monitoring.

**Steps**
1. Phase 1 - Access and Preflight (blocks all later steps)
2. Confirm Neon target details: project, branch, database name, role, pooled/direct connection strings, and network allow-list settings.
3. Confirm Render source access before suspension window ends: host, db name, user, SSL requirement, and whether `pg_dump`/`psql` connectivity works from operator machine. If Render read access is already gone, open Render support immediately for recovery/export options.
4. Snapshot current backend env config in deployment platform and local `.env` so current connection values are preserved for rollback.
5. Phase 2 - Source Backup and Integrity Baseline (depends on Phase 1)
6. Put API into a short maintenance window for writes (read-only or temporary write disable) to avoid drift during final export.
7. Take a full Render logical backup using custom format (`pg_dump -Fc`) and store checksum + timestamped artifact in secure storage.
8. Create a plain SQL/schema snapshot (`pg_dump --schema-only`) for quick diffing against target after import.
9. Record baseline row counts and max timestamps for `workoutlist` and `cardiolist` from Render to validate migration parity.
10. Phase 3 - Neon Preparation (parallel with late Phase 2 checks)
11. Ensure schema exists on Neon: apply `server/database.sql` baseline only if target is empty, then apply migrations in order from `server/migrations/`.
12. Validate table/index presence and expected columns (`workoutlist.weight`, `workoutlist.created_at`, `cardiolist.duration_minutes`, timestamps).
13. Decide connection type for runtime: pooled Neon URL for app server, direct URL reserved for admin operations (migrations/restore).
14. Phase 4 - Import and Validation (depends on Phases 2 and 3)
15. Restore Render dump into Neon (`pg_restore`) with ownership/privilege flags appropriate for Neon role.
16. Re-run parity checks: per-table row counts, sample aggregates, and latest `created_at` values match source.
17. Run API smoke checks against Neon-backed server: `GET /health`, `GET /workoutlist`, `GET /cardiolist`, then create/update/delete on both resources.
18. Phase 5 - Cutover and Stabilization (depends on Phase 4)
19. Update production `DATABASE_URL` to Neon pooled connection string and redeploy/restart backend.
20. Verify mobile app connectivity through API only; no app code changes are required unless API host changes. If API host changes, set `EXPO_PUBLIC_API_URL`.
21. Monitor logs/errors for connection, SSL, and query failures for at least one business cycle; keep Render credentials and dump artifact until sign-off.
22. Phase 6 - Rollback Strategy (prepared before cutover, used only if needed)
23. If severe regressions occur, roll back backend `DATABASE_URL` to Render, redeploy, and re-enable writes there.
24. Preserve Neon import state for forensic diff; reconcile any writes that occurred during rollback window before second cutover attempt.

**Relevant files**
- `server/db.js` - Confirms app is provider-agnostic via `DATABASE_URL` and production SSL toggle.
- `server/index.js` - API smoke-test scope and write endpoints for cutover validation (`/workoutlist`, `/cardiolist`, `/health`).
- `server/database.sql` - Baseline schema for empty-target initialization.
- `server/migrations/add_weight_column.sql` - Ensures `workoutlist.weight` exists.
- `server/migrations/add_created_at_column.sql` - Ensures `workoutlist.created_at` and index exist.
- `server/migrations/add_cardio_table.sql` - Ensures `cardiolist` table exists.
- `server/.env.example` - Document/update Neon-first env guidance for future deploys.
- `my-expo-app/config/apiBaseUrl.js` - API URL behavior; set `EXPO_PUBLIC_API_URL` if backend host/domain changes.

**Verification**
1. Connectivity checks: validate both source Render and target Neon credentials with `psql` before migration window.
2. Backup verification: confirm dump file exists, checksum matches, and restore command can read archive metadata.
3. Data parity: compare row counts and max timestamps for `workoutlist` and `cardiolist` between source and target.
4. API verification: run health + CRUD smoke tests after cutover against deployed backend.
5. Client verification: load app lists and perform one create/edit/delete flow for both workout and cardio.
6. Operational verification: monitor backend logs for connection/auth/SSL errors after deploy.

**Decisions**
- Use short maintenance-window migration (selected) rather than near-zero-downtime replication.
- Scope includes database data migration and backend connection cutover.
- Scope excludes major refactors (e.g., switching to Neon serverless driver) because current `pg` pool works for this architecture.
- Scope excludes UI feature changes; mobile app only needs env update if API host changes.
- Credentials discovery is a hard prerequisite because Render access status is currently uncertain.

**Further Considerations**
1. Restore mode: Option A full dump/restore (`pg_dump -Fc` + `pg_restore`) is recommended for small datasets; Option B table-by-table SQL export only if full restore fails due to permissions.
2. Freeze strategy: Option A temporary write-disable middleware (recommended) or Option B short user-facing maintenance message while imports run.
3. Post-cutover hardening: add a repeatable migration runner later (npm script or tool) to avoid future manual schema drift.

## Implemented: Phase 1 Preflight

Phase 1 now has an executable preflight command in the backend:

1. Populate migration-specific env vars in `server/.env` (or deployment env):
	- `RENDER_DATABASE_URL` (or `DATABASE_URL` fallback)
	- `NEON_PROJECT_ID`, `NEON_BRANCH_ID`, `NEON_DATABASE`, `NEON_ROLE`
	- `NEON_POOLED_DATABASE_URL`, `NEON_DIRECT_DATABASE_URL`
	- `NEON_NETWORK_NOTES`
2. Run:
	- `cd server && npm run preflight:phase1`
3. Review generated artifacts:
	- `server/preflight-artifacts/phase1-preflight-report-<timestamp>.json`
	- `server/preflight-artifacts/phase1-env-snapshot-<timestamp>.env`

What this command validates:

- Neon target details are present for project/branch/database/role/URLs/network notes.
- Render source DB credentials are present.
- `psql` and `pg_dump` are installed and callable from the operator machine.
- Render source is reachable using both `pg` and `psql` connectivity probes.
- Neon target is reachable using a `pg` connectivity probe.
- A rollback-oriented env snapshot artifact is created locally.

If any check fails, do not continue to Phase 2 until the report issues are resolved.

## Implemented: Phase 2 Source Backup and Integrity Baseline

Phase 2 now has an executable command and maintenance lock support in the backend.

### 1) Enable maintenance window for writes

Set this in `server/.env` (or deployment env) before final export:

- `MAINTENANCE_WRITE_LOCK=true`

This blocks `POST`/`PUT`/`PATCH`/`DELETE` requests while still allowing reads and health checks.

### 2) Run Phase 2 command

- `cd server && npm run preflight:phase2`

### 3) Review generated artifacts

- `server/preflight-artifacts/phase2-backup-report-<timestamp>.json`
- `server/preflight-artifacts/phase2-render-full-<timestamp>.dump`
- `server/preflight-artifacts/phase2-render-schema-<timestamp>.sql`
- `server/preflight-artifacts/phase2-render-baseline-<timestamp>.json`

### What this command validates

- `psql`, `pg_dump`, and `pg_restore` are installed and callable.
- Full Render logical backup succeeds (`pg_dump --format=custom`).
- Schema-only snapshot succeeds (`pg_dump --schema-only`).
- Backup archive metadata is readable (`pg_restore --list`).
- SHA-256 checksums are computed for dump and schema artifacts.
- Baseline parity metrics are captured for `workoutlist` and `cardiolist` (row counts, min/max timestamps, aggregates).
- Maintenance lock state is recorded in the report.

If any check fails, do not continue to Phase 3 until the report issues are resolved.

## Implemented: Phase 3 Neon Preparation

Phase 3 now has an executable command in the backend.

### 1) Confirm Neon metadata and URLs in `server/.env`

- `NEON_PROJECT_ID`
- `NEON_BRANCH_ID`
- `NEON_DATABASE`
- `NEON_ROLE`
- `NEON_POOLED_DATABASE_URL`
- `NEON_DIRECT_DATABASE_URL`

### 2) Run Phase 3 command

- `cd server && npm run preflight:phase3`

### 3) Review generated artifact

- `server/preflight-artifacts/phase3-neon-prep-report-<timestamp>.json`

### What this command validates and prepares

- Connects to Neon using direct URL (or pooled URL fallback if direct URL is missing).
- Detects whether target `public` schema is empty.
- Applies sanitized baseline schema from `server/database.sql` only when target is empty (skips `CREATE DATABASE`).
- Applies migrations in order:
	- `server/migrations/add_weight_column.sql`
	- `server/migrations/add_created_at_column.sql`
	- `server/migrations/add_cardio_table.sql`
- Verifies required schema shape on Neon:
	- Tables: `workoutlist`, `cardiolist`
	- Columns: `workoutlist.weight`, `workoutlist.created_at`, `cardiolist.duration_minutes`, `cardiolist.created_at`
	- Index: `idx_workoutlist_created_at`
- Records runtime connection recommendation (pooled for app runtime, direct for admin tasks).

If any check fails, do not continue to Phase 4 import until the report issues are resolved.

## Implemented: Phase 4 Import and Validation

Phase 4 now has an executable command in the backend.

### 1) Ensure prerequisites are available

- Phase 2 artifacts exist in `server/preflight-artifacts/`.
- Phase 3 completed successfully.
- Neon admin URL is configured (`NEON_DIRECT_DATABASE_URL`, or pooled fallback).

Optional overrides:

- `PHASE4_DUMP_PATH`
- `PHASE4_BASELINE_PATH`
- `PHASE4_API_BASE_URL`
- `PHASE4_SKIP_API_SMOKE`

### 2) Run Phase 4 command

- `cd server && npm run preflight:phase4`

### 3) Review generated artifact

- `server/preflight-artifacts/phase4-import-validation-report-<timestamp>.json`

### What this command validates and performs

- Locates the latest Phase 2 dump and baseline artifacts (or uses provided override paths).
- Truncates `workoutlist` and `cardiolist` on Neon before import to avoid duplicate rows.
- Restores Render data into Neon using `pg_restore` with ownership/privilege-safe flags.
- Compares Neon values to Render baseline:
	- row counts
	- min/max `created_at` values
- Runs API smoke checks against configured API base URL:
	- `GET /health`
	- `GET /workoutlist`
	- `GET /cardiolist`
	- create/update/delete on both `workoutlist` and `cardiolist`

If any check fails, do not continue to Phase 5 until the report issues are resolved.

## Implemented: Phase 5 Cutover and Stabilization

Phase 5 now has an executable command in the backend.

Optional controls:

- `PHASE5_API_BASE_URL`
- `PHASE5_APPLY_LOCAL_DATABASE_URL_SWITCH`
- `PHASE5_SKIP_HEALTH_CHECK`

### 1) Run Phase 5 command

- `cd server && npm run preflight:phase5`

### 2) Review generated artifacts

- `server/preflight-artifacts/phase5-cutover-report-<timestamp>.json`
- `server/preflight-artifacts/phase5-cutover-env-snapshot-<timestamp>.env`

### What this command validates and prepares

- Creates a cutover env snapshot artifact for rollback safety.
- Optionally updates local `server/.env` `DATABASE_URL` to Neon pooled URL (when `PHASE5_APPLY_LOCAL_DATABASE_URL_SWITCH=true`).
- Probes connectivity for Neon pooled/direct URLs and Render rollback URL.
- Runs API health check on configured base URL.
- Produces a manual cutover checklist for production env update, redeploy, mobile verification, and stabilization monitoring.

Notes:

- This command does not modify deployment platform env vars.
- This command does not redeploy the backend automatically.
- Production cutover and restart are intentionally manual and confirmed through checklist/report output.