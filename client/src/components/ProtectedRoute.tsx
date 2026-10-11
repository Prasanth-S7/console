import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { API_URL } from "@/lib/api";

type Status = "loading" | "authed" | "unauthed" | "error";

export default function ProtectedRoute() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });

        if (cancelled) {
          return;
        }

        if (res.ok) {
          setStatus("authed");
        } else if (res.status === 401) {
          setStatus("unauthed");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking session...
      </div>
    );
  }

  if (status === "unauthed") {
    return <Navigate to="/login" replace />;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Could not reach the server. Please try again.
      </div>
    );
  }

  return <Outlet />;
}