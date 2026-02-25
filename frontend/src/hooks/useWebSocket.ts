import { useEffect, useRef, useCallback } from 'react';
import type { WsMessage } from '../types';

const WS_URL = `ws://${window.location.hostname}:3001`;

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
    const wsRef = useRef<WebSocket | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    const cbRef = useRef(onMessage);
    cbRef.current = onMessage;

    const connect = useCallback(() => {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => console.log('[WS] Connected');
        ws.onmessage = (e) => {
            try { cbRef.current(JSON.parse(e.data) as WsMessage); } catch { }
        };
        ws.onclose = () => {
            timerRef.current = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
    }, []);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(timerRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return wsRef;
}
