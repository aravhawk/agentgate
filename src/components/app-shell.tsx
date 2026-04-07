"use client";

import { useState, useEffect } from "react";
import { Shield, LogOut, PanelLeftClose, PanelLeft } from "lucide-react";

import { ContractBuilder } from "./contract-builder";
import { AuditDashboard } from "./audit-dashboard";
import { ChatWindow } from "./chat-window";
import { SignedContract } from "@/lib/contracts/types";

interface AppShellProps {
  user: { name?: string; email?: string; picture?: string; sub?: string };
}

export function AppShell({ user }: AppShellProps) {
  const [contract, setContract] = useState<SignedContract | null>(null);
  const [leftPanel, setLeftPanel] = useState<"contract" | "audit">("contract");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contract")
      .then((r) => r.json())
      .then(({ contract }) => {
        if (contract) setContract(contract);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: "#06060a" }}>
      <div className="h-[2px] shrink-0" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent)" }} />

      <header
        className="h-12 shrink-0 flex items-center justify-between px-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-md hover:bg-white/5 text-white/30 hover:text-white/50 transition"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white/90" style={{ fontFamily: "var(--font-outfit)" }}>
              AgentGate
            </span>
          </div>
          {contract && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full text-emerald-400/80"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)" }}
            >
              v{contract.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30">{user.name || user.email}</span>
          <a href="/auth/logout" className="p-1 rounded-md hover:bg-white/5 text-white/30 hover:text-white/50 transition">
            <LogOut className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {sidebarOpen && (
          <aside className="w-80 shrink-0 flex flex-col min-h-0" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {(["contract", "audit"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeftPanel(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-medium uppercase tracking-wider transition ${
                    leftPanel === tab ? "text-violet-400" : "text-white/25 hover:text-white/40"
                  }`}
                  style={leftPanel === tab ? { borderBottom: "2px solid rgba(139,92,246,0.6)" } : { borderBottom: "2px solid transparent" }}
                >
                  {tab === "contract" ? "Contract" : "Audit Trail"}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {leftPanel === "contract" ? (
                <ContractBuilder existingContract={contract} onSign={(c) => setContract(c)} />
              ) : (
                <AuditDashboard />
              )}
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-white/20 text-sm">Loading...</div>
          ) : (
            <ChatWindow hasContract={!!contract} />
          )}
        </main>
      </div>
    </div>
  );
}
