"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Clock,
  Calendar,
  GitBranch,
  RefreshCw,
} from "lucide-react";

import { AuditEntry } from "@/lib/contracts/types";

const STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  allowed: { label: "Allowed", color: "#34d399", bg: "rgba(52,211,153,0.08)", icon: ShieldCheck },
  blocked: { label: "Denied", color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: ShieldX },
  pending_approval: { label: "Pending", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", icon: ShieldAlert },
  approved: { label: "Approved", color: "#34d399", bg: "rgba(52,211,153,0.08)", icon: ShieldCheck },
  denied_by_user: { label: "User Denied", color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: ShieldX },
};

const SERVICE_ICONS: Record<string, typeof Calendar> = {
  google_calendar: Calendar,
  github: GitBranch,
};

function Entry({ entry }: { entry: AuditEntry }) {
  const s = STATUS[entry.status] ?? STATUS.allowed;
  const SIcon = s.icon;
  const SvcIcon = SERVICE_ICONS[entry.service] ?? Activity;
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-2.5 rounded-lg"
      style={{
        background: entry.status === "blocked" ? "rgba(248,113,113,0.03)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${entry.status === "blocked" ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <div className="flex items-start gap-2">
        <div className="p-1 rounded-md" style={{ background: s.bg }}>
          <SIcon className="w-3 h-3" style={{ color: s.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <SvcIcon className="w-2.5 h-2.5 text-white/30" />
            <span className="text-[11px] font-medium text-white/60 truncate">{entry.toolName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>
              {s.label}
            </span>
          </div>
          <p className="text-[10px] text-white/30 mt-0.5 line-clamp-1">{entry.detail}</p>
          <div className="flex items-center gap-1 mt-1 text-white/20">
            <Clock className="w-2.5 h-2.5" />
            <span className="text-[9px]">{time}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AuditDashboard({ pollInterval = 2000 }: { pollInterval?: number }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const fetchAudit = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/audit");
      if (signal?.aborted) return;
      const { audit } = await res.json();
      if (signal?.aborted) return;
      if (audit) setEntries(audit);
    } catch {
      /* noop */
    }
  }, []);

  const handleRefresh = useCallback(() => {
    void fetchAudit();
  }, [fetchAudit]);

  useEffect(() => {
    const controller = new AbortController();
    const initialFetchId = window.setTimeout(() => {
      void fetchAudit(controller.signal);
    }, 0);
    const id = setInterval(() => {
      void fetchAudit(controller.signal);
    }, pollInterval);
    return () => {
      clearTimeout(initialFetchId);
      controller.abort();
      clearInterval(id);
    };
  }, [fetchAudit, pollInterval]);

  const violations = entries.filter((e) => e.status === "blocked").length;
  const allowed = entries.filter((e) => e.status === "allowed").length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white/90" style={{ fontFamily: "var(--font-outfit)" }}>
            Audit Trail
          </h2>
          {entries.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <button onClick={handleRefresh} className="p-1 rounded-md hover:bg-white/5 text-white/25 hover:text-white/40 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {entries.length > 0 && (
        <div className="flex gap-2 px-4 pb-2">
          {[
            { label: "Allowed", value: allowed, color: "#34d399", bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.12)" },
            { label: "Denied", value: violations, color: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.12)" },
            { label: "Total", value: entries.length, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.06)" },
          ].map((s) => (
            <div key={s.label} className="flex-1 px-2 py-1.5 rounded-md text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <span className="text-sm font-bold" style={{ color: s.color }}>
                {s.value}
              </span>
              <p className="text-[9px]" style={{ color: s.color, opacity: 0.5 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 space-y-1.5 pb-4">
        {entries.length === 0 ? (
          <div className="text-center text-white/20 text-xs py-10">No activity yet.</div>
        ) : (
          <AnimatePresence>
            {[...entries].reverse().map((e) => (
              <Entry key={e.id} entry={e} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
