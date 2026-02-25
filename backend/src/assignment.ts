import { randomUUID } from 'crypto';
import { transaction } from './db';

/**
 * Atomically assigns a caller to a lead.
 * 1. Reset today_count for callers not yet reset today (within tx)
 * 2. Try state-specific callers with capacity (JSONB @> filter)
 * 3. Fallback to global round-robin (ORDER BY last_assigned_at ASC)
 * 4. SELECT FOR UPDATE SKIP LOCKED ensures no duplicate assignment
 */
export async function assignCallerToLead(
  leadId: string,
  state: string | null | undefined
): Promise<{ callerId: string; callerName: string; reason: string } | null> {
  return await transaction(async (txQuery) => {
    // Daily reset
    await txQuery(
      `UPDATE callers
       SET today_count = 0, last_reset_date = CURRENT_DATE
       WHERE active = TRUE
         AND (last_reset_date IS NULL OR last_reset_date < CURRENT_DATE)`
    );

    let callers: any[] = [];
    let reason = 'Global round-robin';

    // Step 1: State-based pool
    if (state && state.trim()) {
      callers = await txQuery(
        `SELECT * FROM callers
         WHERE active = TRUE
           AND today_count < daily_limit
           AND assigned_states @> $1::jsonb
         ORDER BY last_assigned_at ASC NULLS FIRST
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [JSON.stringify([state.trim()])]
      );
      if (callers.length > 0) reason = `State-based: "${state.trim()}"`;
    }

    // Step 2: Global fallback
    if (callers.length === 0) {
      callers = await txQuery(
        `SELECT * FROM callers
         WHERE active = TRUE
           AND today_count < daily_limit
         ORDER BY last_assigned_at ASC NULLS FIRST
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );
      if (state) reason = `Global fallback (no eligible caller for "${state}")`;
    }

    if (callers.length === 0) return null;

    const caller = callers[0];

    await txQuery(
      `UPDATE callers
       SET today_count = today_count + 1,
           last_assigned_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [caller.id]
    );

    await txQuery(
      `UPDATE leads SET assigned_caller_id = $1, assigned_at = NOW() WHERE id = $2`,
      [caller.id, leadId]
    );

    await txQuery(
      `INSERT INTO assignment_log (id, lead_id, caller_id, reason, assigned_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [randomUUID(), leadId, caller.id, reason]
    );

    return { callerId: caller.id, callerName: caller.name, reason };
  });
}
