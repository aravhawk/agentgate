import { SignedContract, AuditEntry, ContractRule } from "./types";

// In-memory store (sufficient for hackathon demo; would be DB in production)
const contracts = new Map<string, SignedContract>();
const auditLogs = new Map<string, AuditEntry[]>();

async function hashContract(rules: ContractRule[]): Promise<string> {
  const payload = JSON.stringify(
    rules.map((r) => ({
      id: r.id,
      service: r.service,
      action: r.action,
      permission: r.permission,
    }))
  );
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signContract(
  userId: string,
  rules: ContractRule[]
): Promise<SignedContract> {
  const existing = contracts.get(userId);
  const version = existing ? existing.version + 1 : 1;
  const hash = await hashContract(rules);

  const contract: SignedContract = {
    id: `contract-${userId}-v${version}`,
    version,
    rules,
    signedAt: new Date().toISOString(),
    hash,
    userId,
  };

  contracts.set(userId, contract);
  return contract;
}

export function getContract(userId: string): SignedContract | null {
  return contracts.get(userId) ?? null;
}

export function addAuditEntry(userId: string, entry: AuditEntry): void {
  const entries = auditLogs.get(userId) ?? [];
  entries.push(entry);
  auditLogs.set(userId, entries);
}

export function getAuditLog(userId: string): AuditEntry[] {
  return auditLogs.get(userId) ?? [];
}

export function clearAuditLog(userId: string): void {
  auditLogs.set(userId, []);
}

// Approval tracking for approval_required tools
const approvals = new Map<string, Set<string>>();

export function grantApproval(userId: string, toolName: string): void {
  if (!approvals.has(userId)) approvals.set(userId, new Set());
  approvals.get(userId)!.add(toolName);
}

export function consumeApproval(userId: string, toolName: string): boolean {
  const set = approvals.get(userId);
  if (!set?.has(toolName)) return false;
  set.delete(toolName);
  return true;
}
