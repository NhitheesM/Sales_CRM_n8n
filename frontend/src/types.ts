export interface Caller {
    id: string;
    name: string;
    role: string;
    languages: string[];
    assignedStates: string[];
    dailyLimit: number;
    todayCount: number;
    lastAssignedAt: string | null;
    active: boolean;
    createdAt: string;
    _count?: { leads: number };
}

export type LeadStatus = 'new' | 'contacted' | 'converted';

export interface Lead {
    id: string;
    sheetRowId: string | null;
    name: string;
    phone: string | null;
    timestamp: string | null;
    leadSource: string | null;
    city: string | null;
    state: string | null;
    metadata: Record<string, any>;
    status: LeadStatus;
    assignedCallerId: string | null;
    assignedAt: string | null;
    createdAt: string;
    assignedCaller?: { id: string; name: string; role: string } | null;
}

export interface PaginatedLeads {
    data: Lead[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface WsMessage {
    type: 'NEW_LEAD' | 'LEAD_UPDATED' | 'CALLER_CREATED' | 'CALLER_UPDATED' | 'CALLER_DELETED';
    payload: any;
}

export interface CallerFormData {
    name: string;
    role: string;
    languages: string[];
    daily_limit: number;
    assigned_states: string[];
    active: boolean;
}
