import type { Lead, Caller, PaginatedLeads, LeadStatus } from '../types';

const BASE = '/api';

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Request failed');
    return data as T;
}

async function reqData<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Request failed');
    return json.data as T;
}

export const api = {
    leads: {
        list: async (page = 1, limit = 20, status?: string): Promise<PaginatedLeads> => {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (status && status !== 'all') params.set('status', status);
            return req<PaginatedLeads>(`/leads?${params}`);
        },
        updateStatus: (id: string, status: LeadStatus) =>
            reqData<Lead>(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
        delete: (id: string) => reqData<void>(`/leads/${id}`, { method: 'DELETE' }),
        testIngest: (payload: any) =>
            reqData<Lead>('/leads/ingest', { method: 'POST', body: JSON.stringify(payload) }),
    },
    callers: {
        list: () => reqData<Caller[]>('/callers'),
        create: (payload: any) =>
            reqData<Caller>('/callers', { method: 'POST', body: JSON.stringify(payload) }),
        update: (id: string, payload: any) =>
            reqData<Caller>(`/callers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        delete: (id: string) => reqData<void>(`/callers/${id}`, { method: 'DELETE' }),
    },
};
