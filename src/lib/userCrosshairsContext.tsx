import { createContext, useContext, type ReactNode } from 'react';
import { useUserCrosshairs, type UserCrosshair } from './useUserCrosshairs';

interface UserCrosshairsCtx {
  rows: UserCrosshair[];
  loading: boolean;
  add: (player: string, code: string) => void;
  archive: (id: string) => void;
  restore: (id: string) => void;
  remove: (id: string) => void;
  setRoulette: (id: string, v: boolean) => void;
  reload: () => void;
  resetToDefault: () => void;
}

const Ctx = createContext<UserCrosshairsCtx | null>(null);

export function UserCrosshairsProvider({ children }: { children: ReactNode }) {
  const hooks = useUserCrosshairs();
  return <Ctx.Provider value={hooks}>{children}</Ctx.Provider>;
}

export function useUserCrosshairsCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserCrosshairsCtx must be used within UserCrosshairsProvider');
  return ctx;
}
