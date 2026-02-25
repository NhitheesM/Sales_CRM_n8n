/**
 * seed.ts — inserts 20 callers and 20 leads via API, then verifies assignment
 * Run: npx tsx seed.ts
 */

const BASE = 'http://localhost:3001';

const req = async (method: string, path: string, body?: any) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
};

// ─── 20 Callers ───────────────────────────────────────────────────────────────
// Intentionally has overlapping languages & states to test round-robin fallback
const CALLERS = [
    // Hindi callers (North India) — 5 callers share Hindi + overlapping states
    { name: 'Arjun Sharma', role: 'Senior Caller', languages: ['Hindi', 'English'], daily_limit: 15, assigned_states: ['Uttar Pradesh', 'Bihar', 'Rajasthan'], active: true },
    { name: 'Priya Singh', role: 'Caller', languages: ['Hindi'], daily_limit: 10, assigned_states: ['Uttar Pradesh', 'Madhya Pradesh'], active: true },
    { name: 'Rohit Verma', role: 'Team Lead', languages: ['Hindi', 'Punjabi'], daily_limit: 20, assigned_states: ['Punjab', 'Haryana', 'Delhi'], active: true },
    { name: 'Sunita Yadav', role: 'Caller', languages: ['Hindi'], daily_limit: 10, assigned_states: ['Bihar', 'Jharkhand'], active: true },
    { name: 'Amit Gupta', role: 'Senior Caller', languages: ['Hindi', 'English'], daily_limit: 18, assigned_states: ['Rajasthan', 'Delhi', 'Uttarakhand'], active: true },

    // Tamil callers — 3 callers all cover Tamil Nadu
    { name: 'Karthik Rajan', role: 'Caller', languages: ['Tamil', 'English'], daily_limit: 12, assigned_states: ['Tamil Nadu'], active: true },
    { name: 'Meenakshi Iyer', role: 'Senior Caller', languages: ['Tamil'], daily_limit: 15, assigned_states: ['Tamil Nadu'], active: true },
    { name: 'Suresh Kumar', role: 'Caller', languages: ['Tamil', 'Telugu'], daily_limit: 10, assigned_states: ['Tamil Nadu', 'Andhra Pradesh'], active: true },

    // Telugu callers — 2 callers for AP + Telangana
    { name: 'Venkat Reddy', role: 'Team Lead', languages: ['Telugu', 'English'], daily_limit: 20, assigned_states: ['Andhra Pradesh', 'Telangana'], active: true },
    { name: 'Lakshmi Devi', role: 'Caller', languages: ['Telugu'], daily_limit: 12, assigned_states: ['Telangana'], active: true },

    // Kannada callers — 2 for Karnataka
    { name: 'Deepak Nair', role: 'Senior Caller', languages: ['Kannada', 'English'], daily_limit: 15, assigned_states: ['Karnataka'], active: true },
    { name: 'Savitha Gowda', role: 'Caller', languages: ['Kannada'], daily_limit: 10, assigned_states: ['Karnataka'], active: true },

    // Malayalam caller — Kerala
    { name: 'Anoop Menon', role: 'Caller', languages: ['Malayalam', 'English'], daily_limit: 12, assigned_states: ['Kerala'], active: true },

    // Marathi callers — 2 for Maharashtra
    { name: 'Sanjay Patil', role: 'Senior Caller', languages: ['Marathi', 'Hindi'], daily_limit: 18, assigned_states: ['Maharashtra', 'Goa'], active: true },
    { name: 'Anita Desai', role: 'Caller', languages: ['Marathi'], daily_limit: 10, assigned_states: ['Maharashtra'], active: true },

    // Bengali callers — West Bengal
    { name: 'Riya Banerjee', role: 'Caller', languages: ['Bengali', 'English'], daily_limit: 12, assigned_states: ['West Bengal'], active: true },

    // Gujarati caller
    { name: 'Nirav Shah', role: 'Senior Caller', languages: ['Gujarati', 'Hindi'], daily_limit: 15, assigned_states: ['Gujarat'], active: true },

    // Inactive caller — should NOT get leads
    { name: 'Pooja Mehta', role: 'Caller', languages: ['Hindi'], daily_limit: 20, assigned_states: ['Uttar Pradesh'], active: false },

    // Capped caller — daily limit 1, will fill up quickly
    { name: 'Ravi Kapoor', role: 'Caller', languages: ['Hindi', 'English'], daily_limit: 1, assigned_states: ['Delhi'], active: true },

    // English-only national caller (fallback)
    { name: 'James David', role: 'National Caller', languages: ['English'], daily_limit: 25, assigned_states: ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'West Bengal'], active: true },
];

// ─── 20 Leads — varied states & sources ──────────────────────────────────────
const LEADS = [
    { sheet_row_id: 'TEST_001', name: 'Rajesh Kumar', phone: '9876501001', lead_source: 'Meta Form', city: 'Lucknow', state: 'Uttar Pradesh' },
    { sheet_row_id: 'TEST_002', name: 'Ananya Singh', phone: '9876501002', lead_source: 'Instagram Reel', city: 'Patna', state: 'Bihar' },
    { sheet_row_id: 'TEST_003', name: 'Vijay Nair', phone: '9876501003', lead_source: 'WhatsApp', city: 'Chennai', state: 'Tamil Nadu' },
    { sheet_row_id: 'TEST_004', name: 'Divya Menon', phone: '9876501004', lead_source: 'Meta Form', city: 'Kochi', state: 'Kerala' },
    { sheet_row_id: 'TEST_005', name: 'Sai Reddy', phone: '9876501005', lead_source: 'Google Sheet', city: 'Hyderabad', state: 'Telangana' },
    { sheet_row_id: 'TEST_006', name: 'Pooja Mishra', phone: '9876501006', lead_source: 'Meta Form', city: 'Jaipur', state: 'Rajasthan' },
    { sheet_row_id: 'TEST_007', name: 'Kiran Rao', phone: '9876501007', lead_source: 'Instagram Reel', city: 'Bengaluru', state: 'Karnataka' },
    { sheet_row_id: 'TEST_008', name: 'Deepa Thomas', phone: '9876501008', lead_source: 'WhatsApp', city: 'Pune', state: 'Maharashtra' },
    { sheet_row_id: 'TEST_009', name: 'Mohan Das', phone: '9876501009', lead_source: 'Meta Form', city: 'Kolkata', state: 'West Bengal' },
    { sheet_row_id: 'TEST_010', name: 'Priyanka Patel', phone: '9876501010', lead_source: 'Google Sheet', city: 'Ahmedabad', state: 'Gujarat' },
    { sheet_row_id: 'TEST_011', name: 'Arjun Krishnan', phone: '9876501011', lead_source: 'Meta Form', city: 'Coimbatore', state: 'Tamil Nadu' },
    { sheet_row_id: 'TEST_012', name: 'Sneha Iyer', phone: '9876501012', lead_source: 'Instagram Reel', city: 'Varanasi', state: 'Uttar Pradesh' },
    { sheet_row_id: 'TEST_013', name: 'Ravi Shankar', phone: '9876501013', lead_source: 'WhatsApp', city: 'New Delhi', state: 'Delhi' },
    { sheet_row_id: 'TEST_014', name: 'Meera Pillai', phone: '9876501014', lead_source: 'Meta Form', city: 'Thiruvananthapuram', state: 'Kerala' },
    { sheet_row_id: 'TEST_015', name: 'Gaurav Joshi', phone: '9876501015', lead_source: 'Google Sheet', city: 'Nagpur', state: 'Maharashtra' },
    { sheet_row_id: 'TEST_016', name: 'Lakshmi Suresh', phone: '9876501016', lead_source: 'Meta Form', city: 'Visakhapatnam', state: 'Andhra Pradesh' },
    { sheet_row_id: 'TEST_017', name: 'Rahul Tiwari', phone: '9876501017', lead_source: 'Instagram Reel', city: 'Bhopal', state: 'Madhya Pradesh' },
    { sheet_row_id: 'TEST_018', name: 'Anita Kulkarni', phone: '9876501018', lead_source: 'WhatsApp', city: 'Mangaluru', state: 'Karnataka' },
    { sheet_row_id: 'TEST_019', name: 'Suresh Babu', phone: '9876501019', lead_source: 'Meta Form', city: 'Madurai', state: 'Tamil Nadu' },
    { sheet_row_id: 'TEST_020', name: 'Nisha Agarwal', phone: '9876501020', lead_source: 'Google Sheet', city: 'Chandigarh', state: 'Punjab' },
];

async function seed() {
    console.log('🚀 Starting seed...\n');

    // ── Create callers ────────────────────────────────────────────────────────
    console.log('📞 Creating 20 callers...');
    const createdCallers: any[] = [];
    for (const c of CALLERS) {
        const res = await req('POST', '/api/callers', c);
        if (res.success) {
            createdCallers.push(res.data);
            const status = c.active ? '✅' : '⛔';
            console.log(`  ${status} ${c.name} (${c.languages.join(', ')}) → ${c.assigned_states.join(', ')}`);
        } else {
            console.error(`  ❌ Failed to create ${c.name}:`, res.error);
        }
    }

    console.log(`\n✅ Created ${createdCallers.length} callers\n`);

    // ── Ingest leads ──────────────────────────────────────────────────────────
    console.log('📋 Ingesting 20 leads...');
    const createdLeads: any[] = [];
    for (const l of LEADS) {
        const res = await req('POST', '/api/leads/ingest', l);
        if (res.success) {
            createdLeads.push(res.data);
            const lead = res.data;
            const caller = lead.assignedCaller;
            const assignText = caller ? `→ 👤 ${caller.name}` : '→ ⚠️  UNASSIGNED';
            console.log(`  ${lead.name} (${lead.state}) ${assignText}`);
        } else {
            console.error(`  ❌ Failed to ingest ${l.name}:`, res.error);
        }
    }

    console.log(`\n✅ Ingested ${createdLeads.length} leads\n`);

    // ── Assignment verification ───────────────────────────────────────────────
    console.log('🔍 Assignment verification:\n');

    const unassigned = createdLeads.filter(l => !l.assignedCaller);
    const assigned = createdLeads.filter(l => l.assignedCaller);

    console.log(`  Assigned:   ${assigned.length} / ${createdLeads.length}`);
    console.log(`  Unassigned: ${unassigned.length}\n`);

    if (unassigned.length > 0) {
        console.log('  ⚠️  Unassigned leads:');
        unassigned.forEach(l => console.log(`     - ${l.name} (${l.state})`));
    }

    // Caller load distribution
    console.log('\n  📊 Caller load distribution:');
    const callerCounts: Record<string, { name: string; leads: string[] }> = {};
    for (const lead of assigned) {
        const cn = lead.assignedCaller.name;
        if (!callerCounts[cn]) callerCounts[cn] = { name: cn, leads: [] };
        callerCounts[cn].leads.push(lead.name);
    }
    Object.values(callerCounts)
        .sort((a, b) => b.leads.length - a.leads.length)
        .forEach(({ name, leads }) => {
            const bar = '█'.repeat(leads.length);
            console.log(`     ${name.padEnd(20)} ${bar} (${leads.length})`);
        });

    // Check: Pooja Mehta (inactive) should have NO leads
    const inactiveLeads = assigned.filter(l => l.assignedCaller?.name === 'Pooja Mehta');
    if (inactiveLeads.length > 0) {
        console.log('\n  ❌ BUG: Inactive caller "Pooja Mehta" received leads!');
    } else {
        console.log('\n  ✅ Inactive caller correctly skipped');
    }

    // Check: state-match quality
    let stateMatches = 0;
    for (const lead of assigned) {
        const caller = createdCallers.find(c => c.id === lead.assignedCallerId);
        if (caller?.assignedStates?.includes(lead.state)) stateMatches++;
    }
    const pct = assigned.length > 0 ? Math.round((stateMatches / assigned.length) * 100) : 0;
    console.log(`  ✅ State-matched assignments: ${stateMatches}/${assigned.length} (${pct}%)`);

    console.log('\n🎉 Seed complete!');
}

seed().catch(console.error);
