import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { assignCallerToLead } from '../assignment';
import { broadcast } from '../websocket';
import { randomUUID } from 'crypto';

const router = Router();

/** Map snake_case DB row → camelCase frontend shape */
function transformLead(row: any) {
    if (!row) return null;
    return {
        id: row.id,
        sheetRowId: row.sheet_row_id,
        name: row.name,
        phone: row.phone,
        timestamp: row.timestamp,
        leadSource: row.lead_source,
        city: row.city,
        state: row.state,
        metadata: row.metadata,
        status: row.status || 'new',
        assignedCallerId: row.assigned_caller_id,
        assignedAt: row.assigned_at,
        createdAt: row.created_at,
        assignedCaller: row.caller_name
            ? { id: row.assigned_caller_id, name: row.caller_name, role: row.caller_role }
            : null,
    };
}

const LEAD_QUERY = `
    SELECT l.*, c.name AS caller_name, c.role AS caller_role
    FROM leads l
    LEFT JOIN callers c ON l.assigned_caller_id = c.id`;

async function getLeadById(id: string) {
    const row = await queryOne(`${LEAD_QUERY} WHERE l.id = $1`, [id]);
    return transformLead(row);
}

// GET /api/leads?page=1&limit=20&status=new
router.get('/', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const offset = (page - 1) * limit;
        const statusFilter = req.query.status as string | undefined;

        let countSql = 'SELECT COUNT(*)::int AS total FROM leads';
        let dataSql = `${LEAD_QUERY}`;
        const params: any[] = [];
        let paramIdx = 1;

        if (statusFilter && statusFilter !== 'all') {
            countSql += ` WHERE status = $${paramIdx}`;
            dataSql += ` WHERE l.status = $${paramIdx}`;
            params.push(statusFilter);
            paramIdx++;
        }

        dataSql += ` ORDER BY l.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        const dataParams = [...params, limit, offset];

        const [countResult, rows] = await Promise.all([
            queryOne<{ total: number }>(countSql, params),
            query(dataSql, dataParams),
        ]);

        const total = countResult?.total || 0;
        res.json({
            success: true,
            data: rows.map(transformLead),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/leads/ingest
router.post('/ingest', async (req: Request, res: Response) => {
    try {
        const { sheet_row_id, name, phone, timestamp, lead_source, city, state, metadata, ...rest } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'name is required' });

        // Deduplicate
        if (sheet_row_id) {
            const existing = await queryOne('SELECT id FROM leads WHERE sheet_row_id = $1', [sheet_row_id]);
            if (existing) return res.json({ success: true, data: existing, duplicate: true });
        }

        const id = randomUUID();
        await query(
            `INSERT INTO leads (id, sheet_row_id, name, phone, timestamp, lead_source, city, state, metadata, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [id, sheet_row_id || null, name, phone || null,
                timestamp ? new Date(timestamp) : null,
                lead_source || null, city || null, state || null,
                JSON.stringify({ ...rest, ...(metadata || {}) }),
                'new']
        );

        const assignment = await assignCallerToLead(id, state);
        const fullLead = await getLeadById(id);

        broadcast('NEW_LEAD', { lead: fullLead, assignment });
        res.status(201).json({ success: true, data: fullLead });
    } catch (err: any) {
        console.error('[INGEST ERROR]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH /api/leads/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
        const { status } = req.body;
        const validStatuses = ['new', 'contacted', 'converted'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            });
        }

        const existing = await queryOne('SELECT id FROM leads WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, error: 'Lead not found' });

        await query('UPDATE leads SET status = $1 WHERE id = $2', [status, req.params.id]);
        const updatedLead = await getLeadById(req.params.id);

        broadcast('LEAD_UPDATED', updatedLead);
        res.json({ success: true, data: updatedLead });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await query('DELETE FROM assignment_log WHERE lead_id = $1', [req.params.id]);
        await query('DELETE FROM leads WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
