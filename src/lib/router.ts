import { useSyncExternalStore } from "react";

export const paths = {
  home: "/",
  profile: "/profile",
  tools: "/tools",
  roulette: "/tools/roulette",
  giveaways: "/tools/giveaways",
  auction: "/tools/auction",
  statistics: "/statistics",
  twitchGames: "/games",
  bot: "/bot",
  settings: "/settings",
  faq: "/faq",
  docs: "/docs",
} as const;
export type Section = keyof typeof paths | "notFound";
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
export function navigate(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
export function resolveRoute(pathname: string): {
  section: Section;
  username?: string;
} {
  let path: string;
  try {
    path = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
  } catch {
    return { section: "notFound" };
  }
  const match = Object.entries(paths).find(([, value]) => value === path);
  if (match) return { section: match[0] as Section };
  const aliases: Record<string, Section> = {
    "/профиль": "profile",
    "/инструменты": "tools",
    "/статистика": "statistics",
    "/игры": "twitchGames",
    "/бот": "bot",
    "/настройки": "settings",
    "/documentation": "docs",
  };
  if (aliases[path]) return { section: aliases[path] };
  if (/^\/[a-zA-Z0-9_]{1,25}$/.test(path))
    return { section: "profile", username: path.slice(1).toLowerCase() };
  return { section: "notFound" };
}
export function useRoute() {
  return resolveRoute(
    useSyncExternalStore(subscribe, () => window.location.pathname),
  );
}
