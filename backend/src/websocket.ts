import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server) {
    wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
        console.log('[WS] Client connected');
        ws.on('close', () => console.log('[WS] Client disconnected'));
        ws.on('error', (err) => console.error('[WS] Error:', err.message));
    });
    console.log('[WS] WebSocket server initialized');
}

export function broadcast(type: string, payload: any) {
    if (!wss) return;
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
}
