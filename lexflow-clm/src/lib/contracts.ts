import { supabase } from "./supabase";

export type Contract = {
id: string;
title: string;
type: string;
owner: string;
counterparty: string;
value_gbp: number;
priority: "High" | "Medium" | "Low";
status: "Draft" | "In Review" | "Approved" | "Signed" | "Archived";
governing_law: string;
renewal_date: string;
auto_renew: boolean;
security_review: boolean;
finance_approval: boolean;
obligation: string;
notes: string | null;
created_at: string;
};

export type ContractFormData = {
title: string;
type: string;
owner: string;
counterparty: string;
value_gbp: string;
priority: "High" | "Medium" | "Low";
status: "Draft" | "In Review" | "Approved" | "Signed" | "Archived";
governing_law: string;
renewal_date: string;
auto_renew: boolean;
security_review: boolean;
finance_approval: boolean;
obligation: string;
notes: string;
};

export const defaultContractForm: ContractFormData = {
title: "",
type: "MSA",
owner: "",
counterparty: "",
value_gbp: "",
priority: "Medium",
status: "Draft",
governing_law: "England & Wales",
renewal_date: "",
auto_renew: true,
security_review: false,
finance_approval: false,
obligation: "",
notes: "",
};

export async function fetchContracts(): Promise<Contract[]> {
if (!supabase) throw new Error("Supabase not configured.");

const { data, error } = await supabase
.from("contracts")
.select("*")
.order("created_at", { ascending: false });

if (error) throw error;
return (data ?? []) as Contract[];
}

export async function createContract(
form: ContractFormData
): Promise<Contract> {
if (!supabase) throw new Error("Supabase not configured.");

const payload = {
title: form.title.trim(),
type: form.type,
owner: form.owner.trim(),
counterparty: form.counterparty.trim(),
value_gbp: Number(form.value_gbp || 0),
priority: form.priority,
status: form.status,
governing_law: form.governing_law.trim(),
renewal_date: form.renewal_date,
auto_renew: form.auto_renew,
security_review: form.security_review,
finance_approval: form.finance_approval,
obligation: form.obligation.trim(),
notes: form.notes.trim() || null,
};

const { data, error } = await supabase
.from("contracts")
.insert(payload)
.select()
.single();

if (error) throw error;
return data as Contract;
}

export async function updateContractStatus(
id: string,
status: Contract["status"]
): Promise<Contract> {
if (!supabase) throw new Error("Supabase not configured.");

const { data, error } = await supabase
.from("contracts")
.update({ status })
.eq("id", id)
.select()
.single();

if (error) throw error;
return data as Contract;
}