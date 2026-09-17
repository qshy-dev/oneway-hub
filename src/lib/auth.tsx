import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithTwitch: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
  syncTwitchProfile: (session: Session) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load profile:', error.message);
      return;
    }
    setProfile(data as Profile | null);
  }, []);

  const syncTwitchProfile = useCallback(async (session: Session) => {
    if (!session?.user) return;
    try {
      // POST with only the Authorization header so the CORS preflight is minimal
      // and doesn't depend on extra headers (e.g. x-client-info/apikey) that the
      // browser may have cached as disallowed. The session access token is kept
      // fresh by getSession() in the mount effect above (auto-refreshes expired
      // tokens) and by the auth listener on (re)sign-in.
      const refreshUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-profile`;
      const res = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        console.warn(`Twitch profile sync failed: HTTP ${res.status}`);
        return;
      }
      // Re-fetch the profile so the UI reflects any Twitch-side rename
      // (display name or username) without requiring a page reload.
      await fetchProfile(session.user.id);
    } catch (e) {
      console.warn('Failed to sync Twitch profile:', e);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
        // After the interface loads, verify the displayed Twitch name is still
        // current so renames made on Twitch show up on the site.
        await syncTwitchProfile(data.session);
      }
      if (!cancelled) {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => {
          try {
            // Save Twitch provider_token to profile for EventSub subscriptions
            if (newSession.provider_token) {
              const { error } = await supabase.rpc('set_own_twitch_access_token', {
                p_token: newSession.provider_token,
              });
              if (error) console.warn('Failed to persist Twitch token:', error.message);
            }
            await fetchProfile(newSession.user.id);
            // Sync new Twitch profile data on a (re)sign-in. The INITIAL_SESSION
            // that fires on a plain reload is already handled by the mount effect
            // above, so we skip the duplicate network round-trip here.
            if (_event !== 'INITIAL_SESSION') {
              await syncTwitchProfile(newSession);
            }
          } catch (e) {
            console.warn('Auth sync failed:', e);
          }
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile, syncTwitchProfile]);

  const signInWithTwitch = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: window.location.origin,
        // Scopes for comprehensive profile data:
        // user:read:follows - followed channels (existing)
        // moderator:read:followers - follower count (new)
        // user:read:broadcast - stream info (new)
        // channel:read:subscriptions - channel config (new)
        // channel:read:redemptions - channel points redemptions (EventSub cost waiver)
        scopes: 'user:read:follows moderator:read:followers user:read:broadcast channel:read:subscriptions channel:read:redemptions',
      },
    });
    if (error) {
      console.error('Twitch sign-in error:', error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Session refresh failed:', error.message);
      return;
    }
    if (data.session) {
      setSession(data.session);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  }, [session?.user, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signInWithTwitch,
        signOut,
        refreshProfile,
        refreshSession,
        syncTwitchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
