import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { authApi } from "../api";
import type { AuthUser } from "../api/types";

export type AuthGateStatus = "loading" | "authenticated";

export function useAuthGate(): { status: AuthGateStatus; user?: AuthUser } {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | undefined>();
  const [status, setStatus] = useState<AuthGateStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authApi.me();
        if (cancelled) return;
        if (me.authenticated) {
          setUser(me.user);
          setStatus("authenticated");
        } else {
          navigate("/login", { replace: true });
        }
      } catch {
        if (!cancelled) navigate("/login", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return { status, user };
}

export async function logoutAndRedirect(navigate: (to: string) => void) {
  try {
    await authApi.logout();
  } catch {
    // ignore: still redirect to login
  }
  navigate("/login");
}
