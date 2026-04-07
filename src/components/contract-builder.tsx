"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  FileSignature,
  Calendar,
  GitBranch,
  Hash,
  Check,
} from "lucide-react";

import {
  ContractRule,
  PermissionLevel,
  DEFAULT_RULES,
  SERVICE_LABELS,
  SignedContract,
} from "@/lib/contracts/types";

const PERM: Record<PermissionLevel, { label: string; color: string; bg: string; border: string; icon: typeof Shield }> = {
  allowed: { label: "Allow", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)", icon: ShieldCheck },
  denied: { label: "Deny", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", icon: ShieldX },
  approval_required: { label: "Ask", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", icon: ShieldAlert },
};

const SERVICE_ICONS: Record<string, typeof Calendar> = {
  google_calendar: Calendar,
  github: GitBranch,
};

function Toggle({ value, onChange }: { value: PermissionLevel; onChange: (v: PermissionLevel) => void }) {
  const levels: PermissionLevel[] = ["allowed", "approval_required", "denied"];
  return (
    <div className="flex gap-1">
      {levels.map((l) => {
        const c = PERM[l];
        const active = value === l;
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
            style={
              active
                ? { background: c.bg, color: c.color, border: `1px solid ${c.border}` }
                : { background: "transparent", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  existingContract: SignedContract | null;
  onSign: (contract: SignedContract) => void;
}

export function ContractBuilder({ existingContract, onSign }: Props) {
  const [rules, setRules] = useState<ContractRule[]>(existingContract?.rules ?? DEFAULT_RULES);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(!!existingContract);

  const updateRule = useCallback((id: string, permission: PermissionLevel) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, permission } : r)));
    setSigned(false);
  }, []);

  const handleSign = async () => {
    setSigning(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const { contract } = await res.json();
      setSigned(true);
      onSign(contract);
    } catch (err) {
      console.error(err);
    } finally {
      setSigning(false);
    }
  };

  const grouped = rules.reduce(
    (acc, r) => {
      if (!acc[r.service]) acc[r.service] = [];
      acc[r.service].push(r);
      return acc;
    },
    {} as Record<string, ContractRule[]>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <FileSignature className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white/90" style={{ fontFamily: "var(--font-outfit)" }}>
            Permission Contract
          </h2>
        </div>
        {existingContract && (
          <div className="flex items-center gap-2 mt-2 text-[10px] text-white/30" style={{ fontFamily: "var(--font-jetbrains)" }}>
            <Hash className="w-3 h-3" />
            <span>{existingContract.hash.slice(0, 16)}</span>
            <span className="text-white/15">&middot;</span>
            <span>v{existingContract.version}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-4">
        {Object.entries(grouped).map(([service, serviceRules]) => {
          const Icon = SERVICE_ICONS[service] ?? Shield;
          return (
            <div key={service}>
              <div className="flex items-center gap-2 mb-2 mt-1">
                <Icon className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                  {SERVICE_LABELS[service] ?? service}
                </span>
              </div>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {serviceRules.map((rule) => (
                    <motion.div
                      key={rule.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <p className="text-xs font-medium text-white/80 mb-0.5">{rule.actionLabel}</p>
                      <p className="text-[10px] text-white/30 mb-2">{rule.description}</p>
                      <Toggle value={rule.permission} onChange={(v) => updateRule(rule.id, v)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={handleSign}
          disabled={signing || signed}
          className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          style={
            signed
              ? { background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.15)" }
              : { background: "#7c3aed", color: "white", border: "1px solid transparent", boxShadow: "0 0 16px rgba(139,92,246,0.15)" }
          }
        >
          {signing ? (
            "Signing..."
          ) : signed ? (
            <>
              <Check className="w-3.5 h-3.5" /> Contract Signed
            </>
          ) : (
            <>
              <FileSignature className="w-3.5 h-3.5" /> Sign Contract
            </>
          )}
        </button>
      </div>
    </div>
  );
}
