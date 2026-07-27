import { Shield, Crown, Star, BadgeCheck } from 'lucide-react';
import type { ChatterRole } from './types';

const ROLE_META: Record<ChatterRole, { icon: typeof Shield; title: string; className: string }> = {
  broadcaster: { icon: Crown, title: 'Стример', className: 'text-red-400' },
  mod: { icon: Shield, title: 'Модератор', className: 'text-blue-400' },
  vip: { icon: Star, title: 'VIP', className: 'text-pink-400' },
  subscriber: { icon: BadgeCheck, title: 'Подписчик', className: 'text-amber-400' },
};

const ROLE_ORDER: ChatterRole[] = ['broadcaster', 'mod', 'vip', 'subscriber'];

export function RoleBadges({ roles, size = 14 }: { roles: ChatterRole[]; size?: number }) {
  if (!roles || roles.length === 0) return null;
  const ordered = ROLE_ORDER.filter((r) => roles.includes(r));
  if (ordered.length === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {ordered.map((r) => {
        const meta = ROLE_META[r];
        const Icon = meta.icon;
        return (
          <Icon
            key={r}
            style={{ width: size, height: size }}
            className={meta.className}
            aria-label={meta.title}
          />
        );
      })}
    </span>
  );
}
