import { supabase } from "./supabase";

export type Activity = {
  id: string;
  contract_id: string | null;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  created_at: string;
};

export async function fetchActivitiesByContractId(
  contractId: string
): Promise<Activity[]> {
  if (!supabase) throw new Error("Supabase not configured.");

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function createActivity(payload: {
  contract_id: string | null;
  action: string;
  actor: string;
  details?: Record<string, unknown>;
}): Promise<Activity> {
  if (!supabase) throw new Error("Supabase not configured.");

  const { data, error } = await supabase
    .from("activities")
    .insert({
      contract_id: payload.contract_id,
      action: payload.action,
      actor: payload.actor,
      details: payload.details ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as Activity;
}