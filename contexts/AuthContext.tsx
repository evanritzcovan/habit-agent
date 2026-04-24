import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  /** Re-fetches the user and session (e.g. after `updateUser` or returning to the app). */
  revalidateSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The object passed to `onAuthStateChange` can lag behind the client’s stored session after
 * `updateUser` / `refreshSession`. `getUser` + `getSession` keep React state in sync.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const revalidateSession = useCallback(async () => {
    await supabase.auth.getUser();
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
      })
      .finally(() => setIsLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void (async () => {
        const { data } = await supabase.auth.getSession();
        setSession(data.session ?? null);
      })();
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, isLoading, signOut, revalidateSession }),
    [session, isLoading, signOut, revalidateSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
