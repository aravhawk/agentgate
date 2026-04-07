"use client";

import { useId, useCallback, useEffect, useState } from "react";
import { TokenVaultInterrupt } from "@auth0/ai/interrupts";
import type { Auth0InterruptionUI } from "@auth0/ai-vercel";
import { Shield, ExternalLink } from "lucide-react";

type PossibleInterrupt = Auth0InterruptionUI | Record<string, unknown>;

interface Props {
  interrupt: PossibleInterrupt | undefined | null;
  onFinish?: () => void;
}

export function TokenVaultInterruptHandler({ interrupt, onFinish }: Props) {
  const id = useId();
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<Window | null>(null);

  useEffect(() => {
    if (!popup) return;
    const interval = setInterval(() => {
      if (popup.closed) {
        setLoading(false);
        setPopup(null);
        clearInterval(interval);
        if (onFinish) onFinish();
        else if (interrupt && "resume" in interrupt && typeof interrupt.resume === "function") {
          interrupt.resume();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [popup, onFinish, interrupt]);

  const handleConnect = useCallback(() => {
    if (!interrupt || !TokenVaultInterrupt.isInterrupt(interrupt)) return;

    const search = new URLSearchParams({
      connection: interrupt.connection,
      returnTo: "/close",
      ...interrupt.authorizationParams,
    });
    for (const scope of interrupt.requiredScopes) {
      search.append("scopes", scope);
    }

    const url = new URL("/auth/connect", window.location.origin);
    url.search = search.toString();

    const w = window.open(url.toString(), "_blank", "width=800,height=650");
    if (w) {
      setPopup(w);
      setLoading(true);
    }
  }, [interrupt]);

  if (!interrupt || !TokenVaultInterrupt.isInterrupt(interrupt)) return null;

  return (
    <div key={id} className="my-4 p-4 rounded-xl bg-violet-500/10 border border-violet-500/30">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-violet-300">
          Authorization Required
        </span>
      </div>
      <p className="text-sm text-white/60 mb-3">{interrupt.message}</p>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-2 transition disabled:opacity-50"
      >
        {loading ? (
          "Authorizing..."
        ) : (
          <>
            <ExternalLink className="w-3 h-3" />
            Connect Account
          </>
        )}
      </button>
    </div>
  );
}
