import { Pool } from 'pg';
import 'dotenv/config';

// Use explicit config to avoid URL parsing issues with scram-sha-256
const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'password',
    database: process.env.PGDATABASE || 'sales_crm',
    ssl: false,
});

pool.on('error', (err) => console.error('[DB] Pool error', err));

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows as T[];
    } finally {
        client.release();
    }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(sql, params);
    return rows[0] ?? null;
}

export async function transaction<T>(fn: (q: (sql: string, params?: any[]) => Promise<any[]>) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const txQuery = (sql: string, params?: any[]) =>
            client.query(sql, params).then((r) => r.rows);
        const result = await fn(txQuery);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function testConnection() {
    const rows = await query('SELECT NOW() as now');
    console.log('[DB] PostgreSQL connected at', rows[0].now);
}

export default pool;
