"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  type UIMessage,
  DefaultChatTransport,
  generateId,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUpIcon,
  LoaderCircle,
  Bot,
  User,
  ShieldX,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { useInterruptions } from "@auth0/ai-vercel/react";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";
import { TokenVaultInterruptHandler } from "./token-vault-handler";

function shouldAutoSend({ messages }: { messages: UIMessage[] }): boolean {
  if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) return false;
  if (messages.length === 0) return false;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return false;
  for (const part of last.parts ?? []) {
    if (part.type === "tool-invocation") {
      const result = (part as any).output ?? (part as any).result;
      if (
        result?.error === "CONTRACT_VIOLATION" ||
        result?.error === "APPROVAL_REQUIRED" ||
        result?.error === "ACTION_BLOCKED"
      ) {
        return false;
      }
    }
  }
  return true;
}

function ViolationCard({ result }: { result: any }) {
  return (
    <div
      className="my-2 rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ background: "rgba(239,68,68,0.06)", borderBottom: "1px solid rgba(239,68,68,0.1)" }}
      >
        <ShieldX className="w-3.5 h-3.5 text-red-400" />
        <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wide">Denied by Contract</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-red-300/70">{result.message}</p>
      </div>
    </div>
  );
}

function ApprovalCard({ result }: { result: any }) {
  return (
    <div
      className="my-2 rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.04)" }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ background: "rgba(251,191,36,0.06)", borderBottom: "1px solid rgba(251,191,36,0.1)" }}
      >
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide">Approval Required</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-amber-300/70">{result.message}</p>
        {result.preview && (
          <pre
            className="text-[10px] text-white/30 mt-2 overflow-auto p-2 rounded"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {JSON.stringify(result.preview, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function BlockedCard({ result }: { result: any }) {
  return (
    <div
      className="my-2 rounded-lg p-3"
      style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-3 h-3 text-white/30" />
        <span className="text-[10px] font-medium text-white/30 uppercase tracking-wide">Blocked</span>
      </div>
      <p className="text-xs text-white/40">{result.message}</p>
    </div>
  );
}

function ToolLoading({ name }: { name: string }) {
  return (
    <div className="my-1 flex items-center gap-2 text-xs text-white/30">
      <LoaderCircle className="w-3 h-3 animate-spin" />
      <span>Using {name}...</span>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1"
          style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.15)" }}
        >
          <Bot className="w-3.5 h-3.5 text-violet-400" />
        </div>
      )}
      <div
        className={cn("max-w-[75%] rounded-xl px-4 py-2.5 text-sm", isUser ? "bg-violet-600 text-white" : "text-white/85")}
        style={!isUser ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" } : undefined}
      >
        {message.parts?.map((part, i) => {
          if (part.type === "text") {
            return (
              <div key={i} className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            );
          }
          if (part.type === "tool-invocation") {
            const state = (part as any).state;
            if (state === "call" || state === "partial-call") {
              return <ToolLoading key={i} name={(part as any).toolName} />;
            }
            const result = (part as any).output ?? (part as any).result;
            if (result?.error === "CONTRACT_VIOLATION") return <ViolationCard key={i} result={result} />;
            if (result?.error === "APPROVAL_REQUIRED") return <ApprovalCard key={i} result={result} />;
            if (result?.error === "ACTION_BLOCKED") return <BlockedCard key={i} result={result} />;
            return null;
          }
          return null;
        })}
      </div>
      {isUser && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <User className="w-3.5 h-3.5 text-white/40" />
        </div>
      )}
    </div>
  );
}

export function ChatWindow({ hasContract }: { hasContract: boolean }) {
  const { messages, sendMessage, status, toolInterrupt } = useInterruptions(
    (handler) =>
      useChat({
        transport: new DefaultChatTransport({ api: "/api/chat" }),
        generateId,
        onError: handler((e: Error) => {
          toast.error("Error", { description: e.message });
        }),
        sendAutomaticallyWhen: shouldAutoSend,
      })
  );

  const [input, setInput] = useState("");
  const isLoading = status === "streaming";

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    }
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    stickRef.current = true;
    await sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
        <div className="max-w-[680px] mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div
                className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.12)" }}
              >
                <Bot className="w-6 h-6 text-violet-400/50" />
              </div>
              <p className="text-white/25 text-sm">
                {hasContract
                  ? "Your contract is active. Try \"What's on my calendar?\" or \"List my repos.\""
                  : "Sign a Permission Contract to get started."}
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <TokenVaultInterruptHandler interrupt={toolInterrupt} />
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <form onSubmit={onSubmit} className="max-w-[680px] mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasContract ? "Ask the agent..." : "Sign a contract first..."}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            disabled={!hasContract}
          />
          <button
            type="submit"
            disabled={isLoading || !hasContract}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition"
          >
            {isLoading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ArrowUpIcon className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
