import { supabase } from "./supabase";

export type ObligationStatus = "Open" | "In Progress" | "Done" | "Overdue";

export type Obligation = {
id: string;
contract_id: string;
title: string;
owner: string;
due_date: string | null;
status: ObligationStatus;
notes: string | null;
created_at: string;
};

export async function fetchObligationsByContractId(
contractId: string
): Promise<Obligation[]> {
if (!supabase) throw new Error("Supabase not configured.");

const { data, error } = await supabase
.from("obligations")
.select("*")
.eq("contract_id", contractId)
.order("created_at", { ascending: false });

if (error) throw error;
return (data ?? []) as Obligation[];
}

export async function createObligation(payload: {
contract_id: string;
title: string;
owner: string;
due_date: string | null;
notes: string;
}): Promise<Obligation> {
if (!supabase) throw new Error("Supabase not configured.");

const { data, error } = await supabase
.from("obligations")
.insert({
contract_id: payload.contract_id,
title: payload.title.trim(),
owner: payload.owner.trim(),
due_date: payload.due_date || null,
status: "Open",
notes: payload.notes.trim() || null,
})
.select()
.single();

if (error) throw error;
return data as Obligation;
}

export async function updateObligationStatus(
obligationId: string,
status: ObligationStatus
): Promise<Obligation> {
if (!supabase) throw new Error("Supabase not configured.");

const { data, error } = await supabase
.from("obligations")
.update({ status })
.eq("id", obligationId)
.select()
.single();

if (error) throw error;
return data as Obligation;
}

export async function deleteObligation(
obligationId: string
): Promise<void> {
if (!supabase) throw new Error("Supabase not configured.");

const { error } = await supabase
.from("obligations")
.delete()
.eq("id", obligationId);

if (error) throw error;
}