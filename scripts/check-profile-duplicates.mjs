import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await db.from('profiles').select('id,twitch_username').not('twitch_username', 'is', null);
if (error) throw error;
const groups = new Map();
for (const row of data) groups.set(row.twitch_username.toLowerCase(), [...(groups.get(row.twitch_username.toLowerCase()) ?? []), row.id]);
console.log(JSON.stringify({ profileCount: data.length, duplicateUsernames: [...groups].filter(([, ids]) => ids.length > 1).map(([username, ids]) => ({ username, count: ids.length })) }));
