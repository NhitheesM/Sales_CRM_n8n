import { useState, useEffect } from 'react';
import { X, Plus, Minus, Sparkles } from 'lucide-react';
import type { Caller, CallerFormData } from '../types';

const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Kannada', 'Marathi', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Gujarati', 'Punjabi'];
const STATE_OPTIONS = [
    'Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

/** Maps each language to the states where it is primarily spoken */
const LANGUAGE_TO_STATES: Record<string, string[]> = {
    Hindi: ['Uttar Pradesh', 'Bihar', 'Rajasthan', 'Madhya Pradesh', 'Haryana', 'Delhi', 'Uttarakhand', 'Jharkhand', 'Himachal Pradesh'],
    Tamil: ['Tamil Nadu'],
    Telugu: ['Andhra Pradesh', 'Telangana'],
    Kannada: ['Karnataka'],
    Malayalam: ['Kerala'],
    Marathi: ['Maharashtra', 'Goa'],
    Bengali: ['West Bengal', 'Assam'],
    Gujarati: ['Gujarat'],
    Punjabi: ['Punjab'],
    English: [], // English → no specific region
};

interface Props {
    initial: Caller | null;
    onSave: (data: CallerFormData) => void;
    onClose: () => void;
    error: string;
}

export default function CallerForm({ initial, onSave, onClose, error }: Props) {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [dailyLimit, setDailyLimit] = useState(50);
    const [languages, setLanguages] = useState<string[]>([]);
    const [states, setStates] = useState<string[]>([]);
    const [active, setActive] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (initial) {
            setName(initial.name);
            setRole(initial.role);
            setDailyLimit(initial.dailyLimit);
            setLanguages(initial.languages || []);
            setStates(initial.assignedStates || []);
            setActive(initial.active);
        }
    }, [initial]);

    const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
        setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
    };

    /** Auto-fill states based on selected languages */
    const autoFillStates = () => {
        const suggested = new Set<string>();
        languages.forEach((lang) => {
            (LANGUAGE_TO_STATES[lang] || []).forEach((s) => suggested.add(s));
        });
        if (suggested.size === 0) {
            alert('No state suggestions available for the selected languages. Please select states manually.');
            return;
        }
        setStates(Array.from(suggested));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;           // ← prevent double submit
        setSubmitting(true);

        // If no states selected, auto-fill from languages
        let finalStates = states;
        if (finalStates.length === 0 && languages.length > 0) {
            const suggested = new Set<string>();
            languages.forEach((lang) => {
                (LANGUAGE_TO_STATES[lang] || []).forEach((s) => suggested.add(s));
            });
            finalStates = Array.from(suggested);
            setStates(finalStates);
        }

        try {
            await onSave({ name, role, languages, daily_limit: dailyLimit, assigned_states: finalStates, active });
        } finally {
            setSubmitting(false);
        }
    };

    const autoSuggestedCount = new Set(
        languages.flatMap((l) => LANGUAGE_TO_STATES[l] || [])
    ).size;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
                    <h2 className="font-semibold text-white">{initial ? 'Edit Caller' : 'Add New Caller'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {error && <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Full Name *</label>
                            <input className="input" placeholder="Rahul Sharma" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Role *</label>
                            <input className="input" placeholder="Senior Caller" value={role} onChange={(e) => setRole(e.target.value)} required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">Daily Lead Limit</label>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setDailyLimit(Math.max(1, dailyLimit - 5))} className="btn-ghost px-2 py-2"><Minus size={13} /></button>
                            <input
                                type="number" min={1} max={500} value={dailyLimit}
                                onChange={(e) => setDailyLimit(Number(e.target.value))}
                                className="input text-center w-20"
                            />
                            <button type="button" onClick={() => setDailyLimit(dailyLimit + 5)} className="btn-ghost px-2 py-2"><Plus size={13} /></button>
                            <span className="text-xs text-gray-500">leads/day</span>
                        </div>
                    </div>

                    {/* Languages */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-2 font-medium">Languages Known</label>
                        <div className="flex flex-wrap gap-2">
                            {LANGUAGE_OPTIONS.map((lang) => (
                                <button
                                    key={lang} type="button"
                                    onClick={() => toggleItem(languages, setLanguages, lang)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${languages.includes(lang)
                                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Assigned States */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-gray-500 font-medium">
                                Assigned States
                                {states.length === 0 && languages.length > 0 && autoSuggestedCount > 0 && (
                                    <span className="ml-2 text-amber-500/80">(will auto-fill {autoSuggestedCount} state{autoSuggestedCount > 1 ? 's' : ''} from languages)</span>
                                )}
                            </label>
                            {languages.length > 0 && autoSuggestedCount > 0 && (
                                <button
                                    type="button"
                                    onClick={autoFillStates}
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
                                >
                                    <Sparkles size={10} /> Auto-suggest
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {STATE_OPTIONS.map((state) => (
                                <button
                                    key={state} type="button"
                                    onClick={() => toggleItem(states, setStates, state)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${states.includes(state)
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    {state}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Active toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setActive(!active)}
                            className={`w-10 h-5 rounded-full transition-all relative ${active ? 'bg-emerald-500' : 'bg-white/10'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${active ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                        <span className="text-sm text-gray-300">Caller is {active ? 'active' : 'inactive'}</span>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
                        <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center disabled:opacity-50">
                            {submitting ? 'Saving…' : (initial ? 'Save Changes' : 'Add Caller')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
