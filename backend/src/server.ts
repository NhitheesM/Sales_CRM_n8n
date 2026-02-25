import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { initWebSocket } from './websocket';
import leadsRouter from './routes/leads';
import callersRouter from './routes/callers';
import { testConnection } from './db';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.use('/api/leads', leadsRouter);
app.use('/api/callers', callersRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[ERROR]', err);
    res.status(500).json({ success: false, error: err.message });
});

const server = http.createServer(app);
initWebSocket(server);

async function main() {
    await testConnection();
    server.listen(PORT, () => {
        console.log(`[Server] http://localhost:${PORT}`);
        console.log(`[WS]     ws://localhost:${PORT}`);
    });
}

main().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
});
