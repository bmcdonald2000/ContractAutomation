import { supabase } from "./supabase";

export type ContractStatus =
  | "Draft"
  | "In Review"
  | "Approved"
  | "Signed"
  | "Archived";

export type ContractPriority = "High" | "Medium" | "Low";

export type Contract = {
  id: string;
  title: string;
  type: string;
  owner: string;
  counterparty: string;
  value_gbp: number;
  status: ContractStatus;
  priority: ContractPriority;
  governing_law: string;
  renewal_date: string;
  obligation: string;
  notes: string | null;
  auto_renew: boolean;
  security_review: boolean;
  finance_approval: boolean;
  created_at: string;
  updated_at?: string;
};

export type ContractFormData = {
  title: string;
  type: string;
  owner: string;
  counterparty: string;
  value_gbp: number;
  status: ContractStatus;
  priority: ContractPriority;
  governing_law: string;
  renewal_date: string;
  obligation: string;
  notes: string;
  auto_renew: boolean;
  security_review: boolean;
  finance_approval: boolean;
};

export const defaultContractForm: ContractFormData = {
  title: "",
  type: "MSA",
  owner: "",
  counterparty: "",
  value_gbp: 0,
  status: "Draft",
  priority: "Medium",
  governing_law: "England & Wales",
  renewal_date: "",
  obligation: "",
  notes: "",
  auto_renew: false,
  security_review: false,
  finance_approval: false,
};

export async function fetchContracts(): Promise<Contract[]> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Contract[];
}

export async function fetchContractById(
  contractId: string
): Promise<Contract | null> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Contract | null) ?? null;
}

export async function createContract(
  form: ContractFormData
): Promise<Contract> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const payload = {
    ...form,
    notes: form.notes.trim() ? form.notes : null,
  };

  const { data, error } = await supabase
    .from("contracts")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Contract;
}

export async function updateContractStatus(
  contractId: string,
  status: ContractStatus
): Promise<Contract> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", contractId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Contract;
}