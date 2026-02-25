import { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, Trash2, TrendingUp, Users, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../api';
import type { Lead, Caller, WsMessage, LeadStatus } from '../types';
import { wsEmitter } from '../App';

function StatCard({ icon: Icon, label, value, color }: any) {
    return (
        <div className="glass p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
        </div>
    );
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; next: LeadStatus; className: string }> = {
    new: { label: 'New', next: 'contacted', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    contacted: { label: 'Contacted', next: 'converted', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    converted: { label: 'Converted', next: 'new', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

const STATUS_OPTIONS = [
    { value: 'all', label: 'All Statuses' },
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'converted', label: 'Converted' },
];

export default function LeadsDashboard() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [callers, setCallers] = useState<Caller[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterState, setFilterState] = useState('All States');
    const [filterCaller, setFilterCaller] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 20;

    const load = useCallback(async () => {
        setLoading(true);
        const [leadsRes, c] = await Promise.all([
            api.leads.list(page, LIMIT, filterStatus !== 'all' ? filterStatus : undefined),
            api.callers.list(),
        ]);
        setLeads(leadsRes.data);
        setTotal(leadsRes.total);
        setTotalPages(leadsRes.totalPages);
        setCallers(c);
        setLoading(false);
    }, [page, filterStatus]);

    useEffect(() => { load(); }, [load]);

    // Reset to page 1 when status filter changes
    useEffect(() => { setPage(1); }, [filterStatus]);

    // WebSocket: receive new leads and status updates in real-time
    useEffect(() => {
        return wsEmitter.subscribe((msg: WsMessage) => {
            if (msg.type === 'NEW_LEAD' && msg.payload?.lead) {
                const lead: Lead = msg.payload.lead;
                if (page === 1) {
                    // deduplicate — React StrictMode fires effects twice in dev
                    setLeads((prev) => prev.some((l) => l.id === lead.id) ? prev : [lead, ...prev.slice(0, LIMIT - 1)]);
                }
                setTotal((prev) => prev + 1);
                setNewLeadIds((prev) => new Set([...prev, lead.id]));
                setTimeout(() => {
                    setNewLeadIds((prev) => {
                        const next = new Set(prev);
                        next.delete(lead.id);
                        return next;
                    });
                }, 2500);
            } else if (msg.type === 'LEAD_UPDATED' && msg.payload) {
                const updated: Lead = msg.payload;
                setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l));
            }
        });
    }, [page]);

    const states = ['All States', ...Array.from(new Set(leads.map((l) => l.state).filter(Boolean) as string[]))].sort();
    const callerOptions = [{ id: 'all', name: 'All Callers' }, ...callers];

    const filtered = leads.filter((lead) => {
        const q = search.toLowerCase();
        const matchQ = !q || lead.name.toLowerCase().includes(q) || (lead.phone || '').includes(q) || (lead.city || '').toLowerCase().includes(q);
        const matchState = filterState === 'All States' || lead.state === filterState;
        const matchCaller = filterCaller === 'all' || lead.assignedCallerId === filterCaller;
        return matchQ && matchState && matchCaller;
    });

    const todayLeads = leads.filter((l) => {
        const d = new Date(l.createdAt);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

    const unassigned = leads.filter((l) => !l.assignedCallerId).length;

    const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
        try {
            const updated = await api.leads.updateStatus(leadId, newStatus);
            setLeads((prev) => prev.map((l) => l.id === leadId ? updated : l));
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    const getSourceBadge = (src: string | null) => {
        if (!src) return <span className="badge-gray">Unknown</span>;
        const s = src.toLowerCase();
        if (s.includes('reel') || s.includes('instagram')) return <span className="badge-purple">{src}</span>;
        if (s.includes('meta') || s.includes('form')) return <span className="badge-indigo">{src}</span>;
        if (s.includes('whatsapp')) return <span className="badge-green">{src}</span>;
        return <span className="badge-gray">{src}</span>;
    };

    // Pagination helpers
    const startItem = (page - 1) * LIMIT + 1;
    const endItem = Math.min(page * LIMIT, total);

    const getPageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push('...');
            for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                pages.push(i);
            }
            if (page < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Leads Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Real-time lead tracking &amp; assignment</p>
                </div>
                <button onClick={load} className="btn-ghost">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={TrendingUp} label="Total Leads" value={total} color="bg-indigo-500/15 text-indigo-400" />
                <StatCard icon={Clock} label="Today" value={todayLeads} color="bg-amber-500/15 text-amber-400" />
                <StatCard icon={Users} label="Callers Active" value={callers.filter((c) => c.active).length} color="bg-emerald-500/15 text-emerald-400" />
                <StatCard icon={MapPin} label="Unassigned" value={unassigned} color="bg-red-500/15 text-red-400" />
            </div>

            {/* Filters */}
            <div className="glass p-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        className="input pl-8"
                        placeholder="Search name, phone, city…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select className="input w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select className="input w-auto" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                    {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="input w-auto" value={filterCaller} onChange={(e) => setFilterCaller(e.target.value)}>
                    {callerOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="glass overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.06] text-left">
                                {['Name', 'Phone', 'Source', 'City / State', 'Status', 'Assigned Caller', 'Received'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-16 text-gray-600">Loading leads…</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-16 text-gray-600">No leads found</td></tr>
                            ) : (
                                filtered.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${newLeadIds.has(lead.id) ? 'animate-new-lead' : ''
                                            }`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-white">{lead.name}</div>
                                            {lead.sheetRowId && <div className="text-[10px] text-gray-600">{lead.sheetRowId}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">{lead.phone || '—'}</td>
                                        <td className="px-4 py-3">{getSourceBadge(lead.leadSource)}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-gray-300">{lead.city || '—'}</div>
                                            <div className="text-xs text-gray-600">{lead.state || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleStatusChange(lead.id, STATUS_CONFIG[lead.status]?.next || 'new')}
                                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-all hover:scale-105 ${STATUS_CONFIG[lead.status]?.className || STATUS_CONFIG.new.className}`}
                                                title={`Click to change to "${STATUS_CONFIG[lead.status]?.next || 'new'}"`}
                                            >
                                                {STATUS_CONFIG[lead.status]?.label || 'New'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            {lead.assignedCaller ? (
                                                <div>
                                                    <div className="text-emerald-400 font-medium">{lead.assignedCaller.name}</div>
                                                    <div className="text-xs text-gray-600">{lead.assignedCaller.role}</div>
                                                </div>
                                            ) : (
                                                <span className="badge-red">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {format(new Date(lead.createdAt), 'dd MMM HH:mm')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={async () => {
                                                    await api.leads.delete(lead.id);
                                                    setLeads((p) => p.filter((l) => l.id !== lead.id));
                                                    setTotal((t) => Math.max(0, t - 1));
                                                }}
                                                className="p-1.5 rounded hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination footer */}
                <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                        {total > 0 ? `Showing ${startItem}–${endItem} of ${total} leads` : 'No leads'}
                    </span>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            {getPageNumbers().map((p, i) =>
                                p === '...' ? (
                                    <span key={`dots-${i}`} className="px-2 text-gray-600 text-xs">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p as number)}
                                        className={`w-7 h-7 rounded text-xs font-medium transition-all ${page === p
                                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
