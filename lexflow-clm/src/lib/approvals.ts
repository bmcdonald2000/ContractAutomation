import { supabase } from "./supabase";
import type { Contract } from "./contracts";

export type ApprovalType = "Legal" | "Finance" | "Security";
export type ApprovalDecision = "Pending" | "Approved" | "Rejected";

export type Approval = {
id: string;
contract_id: string;
approval_type: ApprovalType;
approver_name: string | null;
decision: ApprovalDecision;
decision_notes: string | null;
decided_at: string | null;
created_at: string;
};

export function getRequiredApprovalTypes(contract: Contract): ApprovalType[] {
const approvals: ApprovalType[] = [];

const legalRequired =
contract.priority === "High" || contract.value_gbp >= 20000;

if (legalRequired) approvals.push("Legal");
if (contract.finance_approval) approvals.push("Finance");
if (contract.security_review) approvals.push("Security");

return approvals;
}

export async function fetchApprovalsByContractId(
contractId: string
): Promise<Approval[]> {
if (!supabase) throw new Error("Supabase not configured.");

const { data, error } = await supabase
.from("approvals")
.select("*")
.eq("contract_id", contractId)
.order("created_at", { ascending: true });

if (error) throw error;
return (data ?? []) as Approval[];
}

export async function createMissingApprovals(
contract: Contract
): Promise<Approval[]> {
if (!supabase) throw new Error("Supabase not configured.");

const existing = await fetchApprovalsByContractId(contract.id);
const existingTypes = new Set(existing.map((item) => item.approval_type));
const requiredTypes = getRequiredApprovalTypes(contract);

const missing = requiredTypes.filter((type) => !existingTypes.has(type));

if (missing.length === 0) {
return existing;
}

const payload = missing.map((type) => ({
contract_id: contract.id,
approval_type: type,
decision: "Pending" as const,
}));

const { data, error } = await supabase
.from("approvals")
.insert(payload)
.select();

if (error) throw error;

return [...existing, ...((data ?? []) as Approval[])];
}

export async function updateApprovalDecision(
approvalId: string,
decision: ApprovalDecision,
approverName: string,
decisionNotes: string
): Promise<Approval> {
if (!supabase) throw new Error("Supabase not configured.");

const { data, error } = await supabase
.from("approvals")
.update({
decision,
approver_name: approverName.trim() || null,
decision_notes: decisionNotes.trim() || null,
decided_at: new Date().toISOString(),
})
.eq("id", approvalId)
.select()
.single();

if (error) throw error;
return data as Approval;
}

export function areAllRequiredApprovalsApproved(
contract: Contract,
approvals: Approval[]
): boolean {
const required = getRequiredApprovalTypes(contract);

if (required.length === 0) return true;

const approvedTypes = approvals
.filter((item) => item.decision === "Approved")
.map((item) => item.approval_type);

return required.every((type) => approvedTypes.includes(type));
}