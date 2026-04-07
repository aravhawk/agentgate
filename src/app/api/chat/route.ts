import { NextRequest } from "next/server";
import {
  streamText,
  type UIMessage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { setAIContext } from "@auth0/ai-vercel";
import {
  errorSerializer,
  withInterruptions,
} from "@auth0/ai-vercel/interrupts";

import { getCalendarEvents, createCalendarEvent } from "@/lib/tools/google-calendar";
import { listRepositories, listPullRequests, postPRComment, mergePullRequest } from "@/lib/tools/github";
import { getContract, consumeApproval } from "@/lib/contracts/store";
import { checkContract, logGuardDecision } from "@/lib/contracts/guard";
import { getUser } from "@/lib/auth0";

const date = new Date().toISOString();

function wasApprovedInHistory(messages: Array<UIMessage>, toolName: string): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.parts) {
      for (const part of msg.parts) {
        if (part.type === "tool-invocation") {
          const partToolName = (part as any).toolName;
          const res = (part as any).result ?? (part as any).output;
          if (res?.error === "APPROVAL_REQUIRED" && partToolName === toolName) {
            // Found the most recent APPROVAL_REQUIRED for this tool.
            // Check if any user message follows it.
            for (let j = i + 1; j < messages.length; j++) {
              if (messages[j].role === "user") return true;
            }
            return false;
          }
        }
      }
    }
  }
  return false;
}

function buildSystemPrompt(hasContract: boolean) {
  const base = `You are AgentGate, an AI assistant that operates under a Permission Contract signed by the user.
You have access to Google Calendar and GitHub tools.
The current date and time is ${date}.

IMPORTANT RULES:
- You must ALWAYS attempt to use the appropriate tool when the user asks for something.
- If a tool call is blocked by the contract, acknowledge it gracefully and explain what the contract restricts.
- Never apologize excessively. Be direct: "Your contract doesn't allow that."
- When an action requires approval, tell the user you need their approval before proceeding.
- You can suggest what the user could change in their contract to enable blocked actions.`;

  if (!hasContract) {
    return (
      base +
      "\n\nThe user has NOT signed a Permission Contract yet. Remind them to create and sign a contract before you can access any services."
    );
  }

  return base;
}

export async function POST(req: NextRequest) {
  const { id, messages }: { id: string; messages: Array<UIMessage> } =
    await req.json();

  setAIContext({ threadID: id });

  const user = await getUser();
  const userId = user?.sub ?? "anonymous";
  const contract = getContract(userId);

  // All available tools (guard decides which execute)
  const allTools: Record<string, any> = {
    getCalendarEvents,
    createCalendarEvent,
    listRepositories,
    listPullRequests,
    postPRComment,
    mergePullRequest,
  };

  // Wrap tools with contract guard
  const guardedTools: Record<string, any> = {};
  for (const [name, toolDef] of Object.entries(allTools)) {
    if (!contract) {
      // No contract = no tools available, but we still register them so the LLM knows they exist
      // They'll return an error message
      guardedTools[name] = {
        ...toolDef,
        execute: async (args: any) => {
          logGuardDecision(userId, name, {
            allowed: false,
            requiresApproval: false,
            ruleId: null,
            reason: "No Permission Contract signed",
          });
          return {
            error: "ACTION_BLOCKED",
            message:
              "No Permission Contract has been signed. Please create and sign a contract first.",
          };
        },
      };
      continue;
    }

    const result = checkContract(contract, name);

    if (!result.allowed && !result.requiresApproval) {
      // DENIED by contract - replace execute with block message
      guardedTools[name] = {
        ...toolDef,
        execute: async (args: any) => {
          logGuardDecision(userId, name, result);
          return {
            error: "CONTRACT_VIOLATION",
            blockedBy: result.ruleId,
            message: result.reason,
            contractHash: contract.hash,
          };
        },
      };
    } else if (result.requiresApproval) {
      const originalExecute = toolDef.execute;
      const approved = consumeApproval(userId, name) || wasApprovedInHistory(messages, name);
      if (approved) {
        guardedTools[name] = {
          ...toolDef,
          execute: async (args: any) => {
            logGuardDecision(userId, name, {
              ...result,
              allowed: true,
              requiresApproval: false,
              reason: "Approved by user",
            });
            if (typeof originalExecute === "function") {
              return originalExecute(args);
            }
            return { error: "Tool has no execute function" };
          },
        };
      } else {
        guardedTools[name] = {
          ...toolDef,
          execute: async (args: any) => {
            logGuardDecision(userId, name, result);
            return {
              error: "APPROVAL_REQUIRED",
              toolName: name,
              ruleId: result.ruleId,
              message: result.reason,
              preview: args,
            };
          },
        };
      }
    } else {
      // ALLOWED - pass through but log
      const originalExecute = toolDef.execute;
      guardedTools[name] = {
        ...toolDef,
        execute: async (args: any) => {
          logGuardDecision(userId, name, result);
          if (typeof originalExecute === "function") {
            return originalExecute(args);
          }
          return { error: "Tool has no execute function" };
        },
      };
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: withInterruptions(
      async ({ writer }) => {
        const result = streamText({
          model: openai.chat("gpt-5.4"),
          system: buildSystemPrompt(!!contract),
          messages: modelMessages,
          tools: guardedTools as any,
        });

        writer.merge(result.toUIMessageStream({ sendReasoning: true }));
      },
      { messages, tools: guardedTools as any }
    ),
    onError: errorSerializer((err) => {
      console.error(err);
      return `An error occurred: ${(err as Error).message}`;
    }),
  });

  return createUIMessageStreamResponse({ stream });
}
