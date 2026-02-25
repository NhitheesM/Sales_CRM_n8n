import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Zap, Radio } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import LeadsDashboard from './pages/LeadsDashboard';
import CallerManagement from './pages/CallerManagement';
import { useWebSocket } from './hooks/useWebSocket';
import type { WsMessage } from './types';

export const wsEmitter = {
    _listeners: new Set<(msg: WsMessage) => void>(),
    emit(msg: WsMessage) { this._listeners.forEach((fn) => fn(msg)); },
    subscribe(fn: (msg: WsMessage) => void) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    },
};

export default function App() {
    const [connected, setConnected] = useState(false);
    const connRef = useRef(false);

    const handleMsg = useCallback((msg: WsMessage) => {
        if (!connRef.current) { connRef.current = true; setConnected(true); }
        wsEmitter.emit(msg);
    }, []);

    const wsRef = useWebSocket(handleMsg);
    // ping to detect connection
    wsRef; // used

    const navCls = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
            ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
        }`;

    return (
        <BrowserRouter>
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <aside className="w-60 flex-shrink-0 bg-[#0d0d1a] border-r border-white/[0.06] flex flex-col">
                    {/* Logo */}
                    <div className="p-5 border-b border-white/[0.06]">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                <Zap className="w-4.5 h-4.5 text-white" size={18} />
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm">Sales CRM</p>
                                <p className="text-[10px] text-gray-500 tracking-wide uppercase">Lead Intelligence</p>
                            </div>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 p-3 space-y-0.5">
                        <NavLink to="/" end className={navCls}>
                            <LayoutDashboard size={16} />
                            Leads Dashboard
                        </NavLink>
                        <NavLink to="/callers" className={navCls}>
                            <Users size={16} />
                            Caller Management
                        </NavLink>
                    </nav>

                    {/* Live status */}
                    <div className="p-4 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2 text-xs">
                            <Radio size={12} className={connected ? 'text-emerald-400' : 'text-gray-600'} />
                            <span className={connected ? 'text-emerald-400' : 'text-gray-600'}>
                                {connected ? 'Live tracking' : 'Connecting…'}
                            </span>
                        </div>
                    </div>
                </aside>

                {/* Main */}
                <main className="flex-1 overflow-auto bg-[#07070f]">
                    <Routes>
                        <Route path="/" element={<LeadsDashboard />} />
                        <Route path="/callers" element={<CallerManagement />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}
