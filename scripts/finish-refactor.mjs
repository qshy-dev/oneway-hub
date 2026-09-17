import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
let p = fs.readFileSync('src/components/Profile.tsx', 'utf8');
p = p.replace(/^import \{.*?\} from 'lucide-react';/, "import { LogOut, Twitch, UserCircle, Calendar, Hash, AtSign, Heart, X, Search, ExternalLink, Crown } from 'lucide-react';");
p = p.replace(/import \{\s*useChannelStats30d,[\s\S]*?from '@\/lib\/useTwitchChannelStats';\r?\n/, '');
p = p.replace(/  const isOwner[^\n]+\n/, '').replace(/  const eventsubEnabled[^\n]+\n/, '');
p = p.replace(/function formatDuration\([\s\S]*?(?=function InfoRow)/, '');
p = p.slice(0, p.indexOf('function StatCard('));
fs.writeFileSync('src/components/Profile.tsx', p);
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace("import { Profile } from '@/components/Profile';", "import { Profile } from '@/components/Profile';\nimport { supabase } from '@/lib/supabase';");
app = app.replace("              const { supabase } = await import('@/lib/supabase');\n", '');
app = app.replace(/active=\{section === '([^']+)'\}/g, (m, section) => `${m} href={${section === 'profile' ? "profile?.twitch_username ? '/' + profile.twitch_username.toLowerCase() : paths.profile" : `paths.${section}`}}`);
app = app.replace('function SidebarItem({ icon, label, active, collapsed, onClick }', 'function SidebarItem({ icon, label, active, collapsed, onClick, href }');
app = app.replace('icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; onClick: () => void;', 'icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; onClick: () => void; href: string;');
const start = app.indexOf('function SidebarItem('), end = app.indexOf('function ModeButton(', start);
let item = app.slice(start, end).replace('<button', '<a').replace('</button>', '</a>').replace('onClick={onClick}', "href={href}\n      aria-current={active ? 'page' : undefined}\n      aria-label={label}\n      onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onClick(); } }}");
app = app.slice(0, start) + item + app.slice(end);
app = app.replace('<Roulette\n', "{visited.current.has('roulette') && <Roulette\n").replace('sidebarCollapsed={collapsed}\n              />', 'sidebarCollapsed={collapsed}\n              />}');
app = app.replace('<Settings />', "{visited.current.has('roulette') && <Settings />}");
fs.writeFileSync('src/App.tsx', app);
// Preserve already-applied historical migrations under valid canonical filenames.
const historical = [
 ['20260728130406_20260728100859_fix_security_issues.sql.sql', '20260728130406_fix_security_issues.sql'],
 ['20260802080313_create_auction_bids_table.sql.sql', '20260802080313_create_auction_bids_table.sql'],
 ['20260802080326_create_eventsub_subscriptions_and_rpc.sql.sql', '20260802080326_create_eventsub_subscriptions_and_rpc.sql'],
 ['20260802080408_add_twitch_access_token_to_profiles.sql.sql', '20260802080408_add_twitch_access_token_to_profiles.sql'],
];
for (const [oldName, newName] of historical) {
  const path = `supabase/migrations/${newName}`;
  if (!fs.existsSync(path)) fs.writeFileSync(path, execFileSync('git', ['show', `HEAD:supabase/migrations/${oldName}`]));
}
