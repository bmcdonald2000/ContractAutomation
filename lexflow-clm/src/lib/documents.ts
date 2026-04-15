import { supabase } from "./supabase";

export type DocumentRecord = {
  id: string;
  contract_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
};

export async function fetchDocumentsByContractId(
  contractId: string
): Promise<DocumentRecord[]> {
  if (!supabase) throw new Error("Supabase not configured.");

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DocumentRecord[];
}

export async function uploadDocumentForContract(payload: {
  contractId: string;
  file: File;
  uploadedBy: string;
}): Promise<DocumentRecord> {
  if (!supabase) throw new Error("Supabase not configured.");

  const safeName = payload.file.name.replace(/\s+/g, "-");
  const filePath = `${payload.contractId}/${Date.now()}-${safeName}`;

  console.log("DOC UPLOAD START", {
    contractId: payload.contractId,
    fileName: payload.file.name,
    filePath,
    size: payload.file.size,
    type: payload.file.type,
  });

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("contract-files")
    .upload(filePath, payload.file, {
      cacheControl: "3600",
      upsert: false,
    });

  console.log("DOC STORAGE RESULT", { uploadData, uploadError });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      contract_id: payload.contractId,
      file_name: payload.file.name,
      file_path: filePath,
      file_size: payload.file.size,
      mime_type: payload.file.type || "application/octet-stream",
      uploaded_by: payload.uploadedBy.trim() || "User",
    })
    .select()
    .single();

  console.log("DOC DB RESULT", { data, error });

  if (error) throw error;
  return data as DocumentRecord;
}

export async function getSignedDocumentUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured.");

  const { data, error } = await supabase.storage
    .from("contract-files")
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocumentRecord(
  document: DocumentRecord
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured.");

  const { error: storageError } = await supabase.storage
    .from("contract-files")
    .remove([document.file_path]);

  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", document.id);

  if (dbError) throw dbError;
}