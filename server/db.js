const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
    : new Pool({
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5433),
        database: process.env.PGDATABASE || 'bulktech',
    });

module.exports = pool;