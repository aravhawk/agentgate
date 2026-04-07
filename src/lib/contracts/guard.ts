import { nanoid } from "nanoid";

import { SignedContract, AuditEntry, PermissionLevel } from "./types";
import { addAuditEntry } from "./store";

export interface GuardResult {
  allowed: boolean;
  requiresApproval: boolean;
  ruleId: string | null;
  reason: string;
}

const TOOL_TO_CONTRACT_MAP: Record<
  string,
  { service: string; action: string }
> = {
  getCalendarEvents: { service: "google_calendar", action: "read_events" },
  createCalendarEvent: { service: "google_calendar", action: "create_event" },
  listRepositories: { service: "github", action: "read_repos" },
  listPullRequests: { service: "github", action: "read_pull_requests" },
  postPRComment: { service: "github", action: "post_comment" },
  mergePullRequest: { service: "github", action: "merge_pr" },
};

export function checkContract(
  contract: SignedContract,
  toolName: string
): GuardResult {
  const mapping = TOOL_TO_CONTRACT_MAP[toolName];

  if (!mapping) {
    return {
      allowed: true,
      requiresApproval: false,
      ruleId: null,
      reason: "No contract rule covers this action",
    };
  }

  const rule = contract.rules.find(
    (r) => r.service === mapping.service && r.action === mapping.action
  );

  if (!rule) {
    return {
      allowed: false,
      requiresApproval: false,
      ruleId: null,
      reason: `No permission granted for ${mapping.service}/${mapping.action}`,
    };
  }

  switch (rule.permission) {
    case "allowed":
      return {
        allowed: true,
        requiresApproval: false,
        ruleId: rule.id,
        reason: `Permitted by contract rule: ${rule.actionLabel}`,
      };
    case "denied":
      return {
        allowed: false,
        requiresApproval: false,
        ruleId: rule.id,
        reason: `Blocked by contract: "${rule.actionLabel}" is denied`,
      };
    case "approval_required":
      return {
        allowed: false,
        requiresApproval: true,
        ruleId: rule.id,
        reason: `Requires your approval: "${rule.actionLabel}"`,
      };
  }
}

export function logGuardDecision(
  userId: string,
  toolName: string,
  result: GuardResult
): AuditEntry {
  const mapping = TOOL_TO_CONTRACT_MAP[toolName];
  const status = result.allowed
    ? "allowed"
    : result.requiresApproval
      ? "pending_approval"
      : "blocked";

  const entry: AuditEntry = {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    toolName,
    service: mapping?.service ?? "unknown",
    action: mapping?.action ?? "unknown",
    status,
    contractRuleId: result.ruleId,
    detail: result.reason,
  };

  addAuditEntry(userId, entry);
  return entry;
}
