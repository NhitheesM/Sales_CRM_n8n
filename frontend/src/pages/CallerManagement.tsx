import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Users, CheckCircle, XCircle, BarChart2, Globe } from 'lucide-react';
import { api } from '../api';
import type { Caller, CallerFormData, WsMessage } from '../types';
import { wsEmitter } from '../App';
import CallerForm from '../components/CallerForm';

export default function CallerManagement() {
    const [callers, setCallers] = useState<Caller[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Caller | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setCallers(await api.callers.list());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        return wsEmitter.subscribe((msg: WsMessage) => {
            if (msg.type === 'CALLER_CREATED') {
                // deduplicate in case of multiple WS connections
                setCallers((prev) => prev.some((c) => c.id === msg.payload.id) ? prev : [...prev, msg.payload]);
            } else if (msg.type === 'CALLER_UPDATED') {
                setCallers((prev) => prev.map((c) => c.id === msg.payload.id ? msg.payload : c));
            } else if (msg.type === 'CALLER_DELETED') {
                setCallers((prev) => prev.filter((c) => c.id !== msg.payload.id));
            }
        });
    }, []);

    const handleSave = async (data: CallerFormData) => {
        setError('');
        try {
            if (editing) {
                await api.callers.update(editing.id, data);
                // WS CALLER_UPDATED will update local state
            } else {
                await api.callers.create(data);
                // WS CALLER_CREATED will update local state
            }
            setShowForm(false);
            setEditing(null);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this caller? Their leads will become unassigned.')) return;
        await api.callers.delete(id);
        setCallers((prev) => prev.filter((c) => c.id !== id));
    };

    const totalAssigned = callers.reduce((s, c) => s + (c._count?.leads || 0), 0);
    const totalActive = callers.filter((c) => c.active).length;

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Caller Management</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{callers.length} callers · {totalActive} active · {totalAssigned} leads assigned</p>
                </div>
                <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
                    <Plus size={15} />
                    Add Caller
                </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { icon: Users, label: 'Total Callers', value: callers.length, color: 'bg-indigo-500/15 text-indigo-300' },
                    { icon: CheckCircle, label: 'Active', value: totalActive, color: 'bg-emerald-500/15 text-emerald-400' },
                    { icon: BarChart2, label: 'Leads Assigned', value: totalAssigned, color: 'bg-amber-500/15 text-amber-400' },
                ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="glass p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                            <Icon size={16} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-xl font-bold text-white">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Caller cards grid */}
            {loading ? (
                <div className="text-center py-20 text-gray-600">Loading callers…</div>
            ) : callers.length === 0 ? (
                <div className="glass p-12 text-center">
                    <Users size={40} className="mx-auto mb-3 text-gray-700" />
                    <p className="text-gray-500">No callers yet. Add your first caller to start assigning leads.</p>
                    <button onClick={() => setShowForm(true)} className="btn-primary mt-4 mx-auto">
                        <Plus size={14} /> Add Caller
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {callers.map((caller) => (
                        <div key={caller.id} className="glass p-5 flex flex-col gap-4 animate-slide-up">
                            {/* Top row */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm">
                                        {caller.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{caller.name}</p>
                                        <p className="text-xs text-gray-500">{caller.role}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditing(caller); setShowForm(true); }} className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                                        <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDelete(caller.id)} className="p-1.5 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Daily cap bar */}
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-gray-500">Daily Progress</span>
                                    <span className={caller.todayCount >= caller.dailyLimit ? 'text-red-400' : 'text-emerald-400'}>
                                        {caller.todayCount} / {caller.dailyLimit}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${caller.todayCount >= caller.dailyLimit ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min((caller.todayCount / caller.dailyLimit) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Languages */}
                            {caller.languages.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-600 mb-1.5">Languages</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {caller.languages.map((lang) => (
                                            <span key={lang} className="badge-indigo">{lang}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* States */}
                            {caller.assignedStates.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-600 mb-1.5 flex items-center gap-1">
                                        <Globe size={10} /> Assigned States
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {caller.assignedStates.map((s) => (
                                            <span key={s} className="badge-amber">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.05]">
                                <span className={caller.active ? 'text-emerald-400 flex items-center gap-1' : 'text-gray-600 flex items-center gap-1'}>
                                    {caller.active ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                    {caller.active ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-gray-600">{caller._count?.leads || 0} total leads</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <CallerForm
                    initial={editing}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditing(null); setError(''); }}
                    error={error}
                />
            )}
        </div>
    );
}
