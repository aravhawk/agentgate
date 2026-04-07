"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import {
  type UIMessage,
  DefaultChatTransport,
  generateId,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import {
  ArrowUpIcon,
  LoaderCircle,
  Bot,
  User,
  ShieldX,
  ShieldAlert,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useInterruptions } from "@auth0/ai-vercel/react";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";
import { TokenVaultInterruptHandler } from "./token-vault-handler";

function shouldAutoSend({ messages }: { messages: UIMessage[] }): boolean {
  return (
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
    lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
  );
}

function isToolPart(part: any) {
  return (
    typeof part?.type === "string" &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function getToolPartName(part: any) {
  if (part.toolName) return part.toolName;
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.slice(5);
  }
  return "tool";
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

function ApprovalCard({
  part,
  onApprove,
  onDeny,
}: {
  part: any;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}) {
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
        <p className="text-xs text-amber-300/70">
          This action needs approval before it can run.
        </p>
        <p className="text-[11px] text-amber-200/80 mt-2">
          Tool: {getToolPartName(part)}
        </p>
        {part.input && (
          <pre
            className="text-[10px] text-white/30 mt-2 overflow-auto p-2 rounded"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {JSON.stringify(part.input, null, 2)}
          </pre>
        )}
        <div className="mt-2 flex gap-2">
          {onApprove && (
            <button
              onClick={() => onApprove(part.approval.id)}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-black transition"
              style={{ background: "#fbbf24" }}
            >
              Approve
            </button>
          )}
          {onDeny && (
            <button
              onClick={() => onDeny(part.approval.id)}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-white/80 transition"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              Deny
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessCard({ title }: { title: string }) {
  return (
    <div
      className="my-2 rounded-lg p-3"
      style={{ border: "1px solid rgba(52,211,153,0.16)", background: "rgba(52,211,153,0.05)" }}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-medium text-emerald-400">{title}</span>
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

function MessageBubble({
  message,
  onApprove,
  onDeny,
}: {
  message: UIMessage;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}) {
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
          if (isToolPart(part)) {
            const toolPart = part as any;
            if (
              toolPart.state === "input-streaming" ||
              toolPart.state === "input-available"
            ) {
              return <ToolLoading key={i} name={getToolPartName(toolPart)} />;
            }
            if (toolPart.state === "approval-requested") {
              return (
                <ApprovalCard
                  key={i}
                  part={toolPart}
                  onApprove={onApprove}
                  onDeny={onDeny}
                />
              );
            }
            if (toolPart.state === "approval-responded") {
              return (
                <SuccessCard
                  key={i}
                  title={
                    toolPart.approval?.approved
                      ? "Approval received. Executing action..."
                      : "Action denied by user."
                  }
                />
              );
            }
            if (toolPart.state === "output-denied") {
              return (
                <BlockedCard
                  key={i}
                  result={{
                    message:
                      toolPart.approval?.reason ??
                      "You denied this action.",
                  }}
                />
              );
            }
            if (toolPart.state === "output-error") {
              return (
                <BlockedCard
                  key={i}
                  result={{ message: toolPart.errorText }}
                />
              );
            }
            if (toolPart.state === "output-available") {
              const result = toolPart.output;
              if (result?.error === "CONTRACT_VIOLATION") {
                return <ViolationCard key={i} result={result} />;
              }
              if (result?.error === "ACTION_BLOCKED") {
                return <BlockedCard key={i} result={result} />;
              }
              if (toolPart.approval?.approved) {
                return (
                  <SuccessCard
                    key={i}
                    title={`${getToolPartName(toolPart)} completed`}
                  />
                );
              }
              return null;
            }
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
  const {
    messages,
    sendMessage,
    addToolApprovalResponse,
    status,
    toolInterrupt,
  } = useInterruptions(
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

  const handleApprove = useCallback(async (id: string) => {
    await addToolApprovalResponse({ id, approved: true });
  }, [addToolApprovalResponse]);

  const handleDeny = useCallback(async (id: string) => {
    await addToolApprovalResponse({
      id,
      approved: false,
      reason: "User denied this action.",
    });
  }, [addToolApprovalResponse]);

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
            <MessageBubble
              key={m.id}
              message={m}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
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
