export type PermissionLevel = "allowed" | "denied" | "approval_required";

export interface ContractRule {
  id: string;
  service: "google_calendar" | "github";
  action: string;
  actionLabel: string;
  permission: PermissionLevel;
  description: string;
}

export interface SignedContract {
  id: string;
  version: number;
  rules: ContractRule[];
  signedAt: string;
  hash: string;
  userId: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  toolName: string;
  service: string;
  action: string;
  status: "allowed" | "blocked" | "pending_approval" | "approved" | "denied_by_user";
  contractRuleId: string | null;
  detail: string;
}

export const SERVICE_LABELS: Record<string, string> = {
  google_calendar: "Google Calendar",
  github: "GitHub",
};

export const DEFAULT_RULES: ContractRule[] = [
  {
    id: "gcal-read",
    service: "google_calendar",
    action: "read_events",
    actionLabel: "Read calendar events",
    permission: "allowed",
    description: "View your scheduled events and meetings",
  },
  {
    id: "gcal-create",
    service: "google_calendar",
    action: "create_event",
    actionLabel: "Create calendar events",
    permission: "denied",
    description: "Add new events to your calendar",
  },
  {
    id: "gh-read-repos",
    service: "github",
    action: "read_repos",
    actionLabel: "List repositories",
    permission: "allowed",
    description: "View your GitHub repositories",
  },
  {
    id: "gh-read-prs",
    service: "github",
    action: "read_pull_requests",
    actionLabel: "Read pull requests",
    permission: "allowed",
    description: "View pull request details and diffs",
  },
  {
    id: "gh-comment",
    service: "github",
    action: "post_comment",
    actionLabel: "Post PR comments",
    permission: "approval_required",
    description: "Post review comments on pull requests",
  },
  {
    id: "gh-merge",
    service: "github",
    action: "merge_pr",
    actionLabel: "Merge pull requests",
    permission: "denied",
    description: "Merge pull requests into branches",
  },
];
