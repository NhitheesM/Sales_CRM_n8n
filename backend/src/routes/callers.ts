import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { broadcast } from '../websocket';
import { randomUUID } from 'crypto';

const router = Router();

/** Map snake_case DB row → camelCase frontend shape */
function transformCaller(row: any) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        role: row.role,
        languages: row.languages,
        assignedStates: row.assigned_states,
        dailyLimit: row.daily_limit,
        todayCount: row.today_count,
        lastAssignedAt: row.last_assigned_at,
        lastResetDate: row.last_reset_date,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        leadsCount: row.leads_count ?? 0,
        _count: { leads: row.leads_count ?? 0 },
    };
}

// GET /api/callers
router.get('/', async (_req: Request, res: Response) => {
    try {
        const rows = await query(`
      SELECT c.*,
             COUNT(l.id)::int AS leads_count
      FROM callers c
      LEFT JOIN leads l ON l.assigned_caller_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `);
        res.json({ success: true, data: rows.map(transformCaller) });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/callers
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name, role, languages = [], daily_limit = 50, assigned_states = [], active = true } = req.body;
        if (!name || !role) return res.status(400).json({ success: false, error: 'name and role are required' });

        const id = randomUUID();
        await query(
            `INSERT INTO callers (id, name, role, languages, assigned_states, daily_limit, today_count, active, last_reset_date)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,CURRENT_DATE)`,
            [id, name, role, JSON.stringify(languages), JSON.stringify(assigned_states), daily_limit, active]
        );
        const row = await queryOne('SELECT * FROM callers WHERE id = $1', [id]);
        const caller = transformCaller(row);
        broadcast('CALLER_CREATED', caller);
        res.status(201).json({ success: true, data: caller });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/callers/:id
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const existing = await queryOne('SELECT * FROM callers WHERE id = $1', [req.params.id]);
        if (!existing) return res.status(404).json({ success: false, error: 'Caller not found' });

        const {
            name = existing.name,
            role = existing.role,
            languages,
            daily_limit = existing.daily_limit,
            assigned_states,
            active = existing.active,
        } = req.body;

        await query(
            `UPDATE callers SET name=$1, role=$2, languages=$3, daily_limit=$4, assigned_states=$5, active=$6, updated_at=NOW()
       WHERE id=$7`,
            [
                name, role,
                JSON.stringify(languages !== undefined ? languages : existing.languages),
                daily_limit,
                JSON.stringify(assigned_states !== undefined ? assigned_states : existing.assigned_states),
                active,
                req.params.id,
            ]
        );
        const row = await queryOne('SELECT * FROM callers WHERE id = $1', [req.params.id]);
        const caller = transformCaller(row);
        broadcast('CALLER_UPDATED', caller);
        res.json({ success: true, data: caller });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/callers/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await query('UPDATE leads SET assigned_caller_id = NULL, assigned_at = NULL WHERE assigned_caller_id = $1', [req.params.id]);
        await query('DELETE FROM assignment_log WHERE caller_id = $1', [req.params.id]);
        await query('DELETE FROM callers WHERE id = $1', [req.params.id]);
        broadcast('CALLER_DELETED', { id: req.params.id });
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
