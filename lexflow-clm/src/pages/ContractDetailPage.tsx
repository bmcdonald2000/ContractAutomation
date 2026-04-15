import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchContracts,
  updateContractStatus,
  type Contract,
} from "../lib/contracts";
import {
  areAllRequiredApprovalsApproved,
  createMissingApprovals,
  getRequiredApprovalTypes,
  updateApprovalDecision,
  type Approval,
  type ApprovalDecision,
} from "../lib/approvals";
import {
  createObligation,
  deleteObligation,
  fetchObligationsByContractId,
  updateObligationStatus,
  type Obligation,
  type ObligationStatus,
} from "../lib/obligations";
import {
  deleteDocumentRecord,
  fetchDocumentsByContractId,
  getSignedDocumentUrl,
  uploadDocumentForContract,
  type DocumentRecord,
} from "../lib/documents";
import {
  createActivity,
  fetchActivitiesByContractId,
  type Activity,
} from "../lib/activities";

type RecordTab =
  | "Overview"
  | "Approvals"
  | "Obligations"
  | "Documents"
  | "Activity";

export default function ContractDetailPage() {
  const { id } = useParams();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordTab, setRecordTab] = useState<RecordTab>("Overview");
  const [error, setError] = useState<string | null>(null);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [actingApprovalId, setActingApprovalId] = useState<string | null>(null);

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loadingObligations, setLoadingObligations] = useState(false);
  const [creatingObligation, setCreatingObligation] = useState(false);
  const [actingObligationId, setActingObligationId] = useState<string | null>(null);
  const [obligationTitle, setObligationTitle] = useState("");
  const [obligationOwner, setObligationOwner] = useState("");
  const [obligationDueDate, setObligationDueDate] = useState("");
  const [obligationNotes, setObligationNotes] = useState("");

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [actingDocumentId, setActingDocumentId] = useState<string | null>(null);
  const [uploadedBy, setUploadedBy] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  async function loadContract() {
    try {
      setLoading(true);
      setError(null);
      const allContracts = await fetchContracts();
      const found = allContracts.find((c) => c.id === id) ?? null;
      setContract(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contract");
    } finally {
      setLoading(false);
    }
  }

  async function loadApprovals(currentContract: Contract) {
    try {
      setLoadingApprovals(true);
      const rows = await createMissingApprovals(currentContract);
      setApprovals(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    } finally {
      setLoadingApprovals(false);
    }
  }

  async function loadObligations(currentContract: Contract) {
    try {
      setLoadingObligations(true);
      const rows = await fetchObligationsByContractId(currentContract.id);
      setObligations(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load obligations");
    } finally {
      setLoadingObligations(false);
    }
  }

  async function loadDocuments(currentContract: Contract) {
    try {
      setLoadingDocuments(true);
      const rows = await fetchDocumentsByContractId(currentContract.id);
      setDocuments(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoadingDocuments(false);
    }
  }

  async function loadActivities(currentContract: Contract) {
    try {
      setLoadingActivities(true);
      const rows = await fetchActivitiesByContractId(currentContract.id);
      setActivities(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoadingActivities(false);
    }
  }

  async function logActivity(payload: {
    contract_id: string | null;
    action: string;
    actor: string;
    details?: Record<string, unknown>;
  }) {
    try {
      const created = await createActivity(payload);
      if (contract && payload.contract_id === contract.id) {
        setActivities((prev) => [created, ...prev]);
      }
    } catch {
      // don't block UX on activity logging
    }
  }

  async function handleStatusChange(status: Contract["status"]) {
    if (!contract) return;

    try {
      setError(null);
      const updated = await updateContractStatus(contract.id, status);
      setContract(updated);

      await logActivity({
        contract_id: contract.id,
        action: "contract_status_updated",
        actor: "User",
        details: { status },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update contract status"
      );
    }
  }

  async function handleApprovalDecision(
    approvalId: string,
    decision: ApprovalDecision
  ) {
    if (!contract) return;

    try {
      setActingApprovalId(approvalId);

      const updated = await updateApprovalDecision(
        approvalId,
        decision,
        approverName,
        approvalNotes
      );

      const nextApprovals = approvals.map((item) =>
        item.id === approvalId ? updated : item
      );

      setApprovals(nextApprovals);

      await logActivity({
        contract_id: contract.id,
        action: "approval_decided",
        actor: approverName || "Unknown approver",
        details: {
          approval_type: updated.approval_type,
          decision,
          notes: approvalNotes || null,
        },
      });

      if (decision === "Rejected") {
        const updatedContract = await updateContractStatus(contract.id, "In Review");
        setContract(updatedContract);
      } else if (areAllRequiredApprovalsApproved(contract, nextApprovals)) {
        const updatedContract = await updateContractStatus(contract.id, "Approved");
        setContract(updatedContract);

        await logActivity({
          contract_id: contract.id,
          action: "contract_auto_approved",
          actor: approverName || "System",
          details: { status: "Approved" },
        });
      }

      setApprovalNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update approval");
    } finally {
      setActingApprovalId(null);
    }
  }

  async function handleCreateObligation(e: React.FormEvent) {
    e.preventDefault();
    if (!contract) return;
    if (!obligationTitle.trim() || !obligationOwner.trim()) return;

    try {
      setCreatingObligation(true);

      const created = await createObligation({
        contract_id: contract.id,
        title: obligationTitle,
        owner: obligationOwner,
        due_date: obligationDueDate || null,
        notes: obligationNotes,
      });

      setObligations((prev) => [created, ...prev]);
      setObligationTitle("");
      setObligationOwner("");
      setObligationDueDate("");
      setObligationNotes("");

      await logActivity({
        contract_id: contract.id,
        action: "obligation_created",
        actor: "User",
        details: {
          title: created.title,
          owner: created.owner,
          due_date: created.due_date,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create obligation");
    } finally {
      setCreatingObligation(false);
    }
  }

  async function handleObligationStatusChange(
    obligationId: string,
    status: ObligationStatus
  ) {
    try {
      setActingObligationId(obligationId);
      const updated = await updateObligationStatus(obligationId, status);

      setObligations((prev) =>
        prev.map((item) => (item.id === obligationId ? updated : item))
      );

      await logActivity({
        contract_id: updated.contract_id,
        action: "obligation_status_updated",
        actor: "User",
        details: {
          title: updated.title,
          status,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update obligation status"
      );
    } finally {
      setActingObligationId(null);
    }
  }

  async function handleDeleteObligation(obligationId: string) {
    const obligation = obligations.find((item) => item.id === obligationId);

    try {
      setActingObligationId(obligationId);
      await deleteObligation(obligationId);
      setObligations((prev) => prev.filter((item) => item.id !== obligationId));

      if (obligation) {
        await logActivity({
          contract_id: obligation.contract_id,
          action: "obligation_deleted",
          actor: "User",
          details: {
            title: obligation.title,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete obligation");
    } finally {
      setActingObligationId(null);
    }
  }

  async function handleFileUpload(file: File) {
    if (!contract) return;

    try {
      setUploadingDocument(true);

      const created = await uploadDocumentForContract({
        contractId: contract.id,
        file,
        uploadedBy: uploadedBy || "User",
      });

      setDocuments((prev) => [created, ...prev]);

      await logActivity({
        contract_id: contract.id,
        action: "document_uploaded",
        actor: uploadedBy || "User",
        details: {
          file_name: created.file_name,
          mime_type: created.mime_type,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    await handleFileUpload(file);
    e.target.value = "";
  }

  async function handleOpenDocument(document: DocumentRecord) {
    try {
      const signedUrl = await getSignedDocumentUrl(document.file_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open document");
    }
  }

  async function handleDeleteDocument(document: DocumentRecord) {
    try {
      setActingDocumentId(document.id);
      await deleteDocumentRecord(document);
      setDocuments((prev) => prev.filter((item) => item.id !== document.id));

      await logActivity({
        contract_id: document.contract_id,
        action: "document_deleted",
        actor: "User",
        details: {
          file_name: document.file_name,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setActingDocumentId(null);
    }
  }

  useEffect(() => {
    loadContract();
  }, [id]);

  useEffect(() => {
    if (!contract) return;

    if (recordTab === "Approvals") loadApprovals(contract);
    if (recordTab === "Obligations") loadObligations(contract);
    if (recordTab === "Documents") loadDocuments(contract);
    if (recordTab === "Activity") loadActivities(contract);
  }, [recordTab, contract?.id]);

  const requiredApprovalTypes = useMemo(() => {
    if (!contract) return [];
    return getRequiredApprovalTypes(contract);
  }, [contract]);

  if (loading) {
    return <div style={loadingPageStyle}>Loading contract...</div>;
  }

  if (!contract) {
    return (
      <div style={loadingPageStyle}>
        <div style={notFoundCardStyle}>
          <h2>Contract not found</h2>
          <Link to="/" style={backLinkStyle}>
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={recordPageStyle}>
      <div style={recordGlowOne} />
      <div style={recordGlowTwo} />

      <div style={recordShellStyle}>
        <header style={recordTopbarStyle}>
          <div>
            <Link to="/" style={backLinkStyle}>
              ← Back to dashboard
            </Link>
            <div style={recordEyebrowStyle}>Contract record</div>
            <h1 style={recordTitleStyle}>{contract.title}</h1>
            <div style={recordMetaStyle}>
              {contract.counterparty} • {contract.type}
            </div>
          </div>

          <div style={recordBadgeWrapStyle}>
            <span style={priorityBadgeStyle(contract.priority)}>
              {contract.priority}
            </span>
            <span style={statusBadgeStyle(contract.status)}>
              {contract.status}
            </span>
          </div>
        </header>

        {error && <div style={recordErrorStyle}>{error}</div>}

        <section style={recordSummaryGridStyle}>
          <SummaryCard label="Owner" value={contract.owner} />
          <SummaryCard
            label="Value"
            value={`£${contract.value_gbp.toLocaleString()}`}
          />
          <SummaryCard label="Governing law" value={contract.governing_law} />
          <SummaryCard label="Renewal date" value={contract.renewal_date} />
        </section>

        <section style={recordMainGridStyle}>
          <section style={recordMainColumnStyle}>
            <section style={recordPanelStyle}>
              <div style={recordTabRowStyle}>
                {(
                  ["Overview", "Approvals", "Obligations", "Documents", "Activity"] as RecordTab[]
                ).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRecordTab(tab)}
                    style={{
                      ...recordTabButtonStyle,
                      ...(recordTab === tab ? recordActiveTabButtonStyle : {}),
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {recordTab === "Overview" && (
                <div style={recordTabContentStyle}>
                  <div style={recordSectionHeaderStyle}>
                    <h2 style={recordSectionTitleStyle}>Overview</h2>

                    <select
                      value={contract.status}
                      onChange={(e) =>
                        handleStatusChange(e.target.value as Contract["status"])
                      }
                      style={recordSelectStyle}
                    >
                      {["Draft", "In Review", "Approved", "Signed", "Archived"].map(
                        (item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div style={recordDetailGridStyle}>
                    <SummaryCard
                      label="Auto renew"
                      value={contract.auto_renew ? "Yes" : "No"}
                    />
                    <SummaryCard
                      label="Security review"
                      value={contract.security_review ? "Required" : "Not required"}
                    />
                    <SummaryCard
                      label="Finance approval"
                      value={contract.finance_approval ? "Required" : "Not required"}
                    />
                    <SummaryCard
                      label="Created"
                      value={new Date(contract.created_at).toLocaleDateString("en-GB")}
                    />
                  </div>

                  <div style={recordBodyCardStyle}>
                    <div style={recordBodyLabelStyle}>Key obligation</div>
                    <div style={recordBodyTextStyle}>{contract.obligation}</div>
                  </div>

                  <div style={recordBodyCardStyle}>
                    <div style={recordBodyLabelStyle}>Notes</div>
                    <div style={recordBodyTextStyle}>
                      {contract.notes || "No notes recorded."}
                    </div>
                  </div>
                </div>
              )}

              {recordTab === "Approvals" && (
                <div style={recordTabContentStyle}>
                  <div style={recordBodyCardStyle}>
                    <div style={recordBodyLabelStyle}>Required approvals</div>
                    <div style={recordBodyTextStyle}>
                      {requiredApprovalTypes.length
                        ? requiredApprovalTypes.join(", ")
                        : "No formal approvals required for this contract."}
                    </div>
                  </div>

                  <Field label="Approver name">
                    <input
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      placeholder="Enter approver name"
                      style={recordInputStyle}
                    />
                  </Field>

                  <Field label="Decision notes">
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add context for the approval decision"
                      style={{ ...recordInputStyle, minHeight: 90, resize: "vertical" }}
                    />
                  </Field>

                  {loadingApprovals ? (
                    <div style={recordEmptyStateStyle}>Loading approvals...</div>
                  ) : approvals.length === 0 ? (
                    <div style={recordEmptyStateStyle}>No approvals yet.</div>
                  ) : (
                    <div style={recordStackStyle}>
                      {approvals.map((item) => (
                        <div key={item.id} style={recordListCardStyle}>
                          <div style={recordListTopStyle}>
                            <div>
                              <div style={recordListTitleStyle}>{item.approval_type}</div>
                              <div style={recordListMetaStyle}>
                                {item.approver_name
                                  ? `By ${item.approver_name}`
                                  : "Awaiting decision"}
                              </div>
                            </div>
                            <span style={miniStatusBadgeStyle(item.decision)}>
                              {item.decision}
                            </span>
                          </div>

                          {item.decision_notes && (
                            <div style={recordListBodyStyle}>{item.decision_notes}</div>
                          )}

                          <div style={recordActionRowStyle}>
                            <button
                              type="button"
                              onClick={() => handleApprovalDecision(item.id, "Approved")}
                              disabled={actingApprovalId === item.id}
                              style={recordApproveButtonStyle}
                            >
                              {actingApprovalId === item.id ? "Working..." : "Approve"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApprovalDecision(item.id, "Rejected")}
                              disabled={actingApprovalId === item.id}
                              style={recordRejectButtonStyle}
                            >
                              {actingApprovalId === item.id ? "Working..." : "Reject"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {recordTab === "Obligations" && (
                <div style={recordTabContentStyle}>
                  <form onSubmit={handleCreateObligation} style={recordBodyCardStyle}>
                    <div style={recordBodyLabelStyle}>Add obligation</div>
                    <div style={recordFormGridStyle}>
                      <input
                        value={obligationTitle}
                        onChange={(e) => setObligationTitle(e.target.value)}
                        placeholder="Obligation title"
                        style={recordInputStyle}
                      />
                      <input
                        value={obligationOwner}
                        onChange={(e) => setObligationOwner(e.target.value)}
                        placeholder="Owner"
                        style={recordInputStyle}
                      />
                      <input
                        type="date"
                        value={obligationDueDate}
                        onChange={(e) => setObligationDueDate(e.target.value)}
                        style={recordInputStyle}
                      />
                      <textarea
                        value={obligationNotes}
                        onChange={(e) => setObligationNotes(e.target.value)}
                        placeholder="Notes"
                        style={{ ...recordInputStyle, minHeight: 80, resize: "vertical" }}
                      />
                      <button
                        type="submit"
                        disabled={creatingObligation}
                        style={recordPrimaryButtonStyle}
                      >
                        {creatingObligation ? "Adding..." : "Add obligation"}
                      </button>
                    </div>
                  </form>

                  {loadingObligations ? (
                    <div style={recordEmptyStateStyle}>Loading obligations...</div>
                  ) : obligations.length === 0 ? (
                    <div style={recordEmptyStateStyle}>No obligations recorded yet.</div>
                  ) : (
                    <div style={recordStackStyle}>
                      {obligations.map((item) => (
                        <div key={item.id} style={recordListCardStyle}>
                          <div style={recordListTopStyle}>
                            <div>
                              <div style={recordListTitleStyle}>{item.title}</div>
                              <div style={recordListMetaStyle}>
                                Owner: {item.owner} • Due: {item.due_date || "—"}
                              </div>
                            </div>
                            <span style={miniStatusBadgeStyle(item.status)}>
                              {item.status}
                            </span>
                          </div>

                          {item.notes && (
                            <div style={recordListBodyStyle}>{item.notes}</div>
                          )}

                          <div style={recordActionWrapStyle}>
                            <select
                              value={item.status}
                              disabled={actingObligationId === item.id}
                              onChange={(e) =>
                                handleObligationStatusChange(
                                  item.id,
                                  e.target.value as ObligationStatus
                                )
                              }
                              style={recordSelectStyle}
                            >
                              {["Open", "In Progress", "Done", "Overdue"].map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={actingObligationId === item.id}
                              onClick={() => handleDeleteObligation(item.id)}
                              style={recordRejectButtonStyle}
                            >
                              {actingObligationId === item.id ? "Working..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {recordTab === "Documents" && (
                <div style={recordTabContentStyle}>
                  <div
                    style={{
                      ...recordBodyCardStyle,
                      ...(isDragging ? recordDragActiveStyle : {}),
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        await handleFileUpload(file);
                      }
                    }}
                  >
                    <div style={recordBodyLabelStyle}>Upload document</div>

                    <div style={recordUploadZoneInnerStyle}>
                      <div style={recordUploadIconStyle}>⬆️</div>
                      <div style={recordUploadTitleStyle}>Drag and drop a file here</div>
                      <div style={recordUploadSubtextStyle}>or choose a file manually</div>
                    </div>

                    <div style={recordFormGridStyle}>
                      <input
                        value={uploadedBy}
                        onChange={(e) => setUploadedBy(e.target.value)}
                        placeholder="Uploaded by"
                        style={recordInputStyle}
                      />
                      <input type="file" onChange={handleDocumentUpload} style={recordInputStyle} />
                      {uploadingDocument && (
                        <div style={recordUploadStateStyle}>Uploading document...</div>
                      )}
                    </div>
                  </div>

                  {loadingDocuments ? (
                    <div style={recordEmptyStateStyle}>Loading documents...</div>
                  ) : documents.length === 0 ? (
                    <div style={recordEmptyStateStyle}>No documents uploaded yet.</div>
                  ) : (
                    <div style={recordStackStyle}>
                      {documents.map((item) => (
                        <div key={item.id} style={recordListCardStyle}>
                          <div style={recordListTopStyle}>
                            <div style={recordDocumentMetaWrapStyle}>
                              <div style={recordDocumentIconStyle}>
                                {getFileIcon(item.file_name, item.mime_type)}
                              </div>
                              <div>
                                <div style={recordListTitleStyle}>{item.file_name}</div>
                                <div style={recordListMetaStyle}>
                                  {item.uploaded_by} • {item.mime_type || "Unknown type"}
                                </div>
                              </div>
                            </div>

                            <span style={miniStatusBadgeStyle("Linked")}>Linked</span>
                          </div>

                          <div style={recordActionRowStyle}>
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(item)}
                              style={recordApproveButtonStyle}
                            >
                              Open
                            </button>

                            <button
                              type="button"
                              disabled={actingDocumentId === item.id}
                              onClick={() => handleDeleteDocument(item)}
                              style={recordRejectButtonStyle}
                            >
                              {actingDocumentId === item.id ? "Working..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {recordTab === "Activity" && (
                <div style={recordTabContentStyle}>
                  {loadingActivities ? (
                    <div style={recordEmptyStateStyle}>Loading activity...</div>
                  ) : activities.length === 0 ? (
                    <div style={recordEmptyStateStyle}>No activity logged yet.</div>
                  ) : (
                    <div style={recordStackStyle}>
                      {activities.map((item) => (
                        <div key={item.id} style={recordListCardStyle}>
                          <div style={recordListTopStyle}>
                            <div>
                              <div style={recordListTitleStyle}>{formatAction(item.action)}</div>
                              <div style={recordListMetaStyle}>
                                {item.actor} •{" "}
                                {new Date(item.created_at).toLocaleString("en-GB")}
                              </div>
                            </div>
                            <span style={miniStatusBadgeStyle("Logged")}>Logged</span>
                          </div>

                          <pre style={recordActivityDetailsStyle}>
                            {JSON.stringify(item.details, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </section>

          <aside style={recordSidebarStyle}>
            <section style={recordPanelStyle}>
              <div style={recordSidebarLabelStyle}>Counterparty</div>
              <div style={recordSidebarTitleStyle}>{contract.counterparty}</div>
              <div style={recordSidebarBodyStyle}>
                This record captures lifecycle, approvals, obligations, linked
                documents, and event history in one place.
              </div>
            </section>

            <section style={recordPanelStyle}>
              <div style={recordSidebarLabelStyle}>Workflow summary</div>
              <div style={recordSidebarMiniGridStyle}>
                <SummaryCard label="Status" value={contract.status} />
                <SummaryCard label="Priority" value={contract.priority} />
                <SummaryCard label="Type" value={contract.type} />
                <SummaryCard label="Law" value={contract.governing_law} />
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={recordSummaryCardStyle}>
      <div style={recordSummaryLabelStyle}>{label}</div>
      <div style={recordSummaryValueStyle}>{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={recordFieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function getFileIcon(fileName: string, mimeType?: string | null) {
  const lowerName = fileName.toLowerCase();
  const lowerType = (mimeType || "").toLowerCase();

  if (lowerType.includes("pdf") || lowerName.endsWith(".pdf")) return "📕";
  if (
    lowerType.includes("word") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx")
  )
    return "📘";
  if (
    lowerType.includes("sheet") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".csv")
  )
    return "📗";
  if (
    lowerType.includes("image") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp")
  )
    return "🖼️";

  return "📄";
}

function formatAction(action: string) {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function priorityBadgeStyle(priority: Contract["priority"]): React.CSSProperties {
  const tones = {
    High: { bg: "rgba(127,29,29,0.35)", text: "#fecaca", border: "rgba(248,113,113,0.2)" },
    Medium: { bg: "rgba(120,53,15,0.35)", text: "#fde68a", border: "rgba(251,191,36,0.2)" },
    Low: { bg: "rgba(20,83,45,0.35)", text: "#bbf7d0", border: "rgba(74,222,128,0.2)" },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: tones[priority].bg,
    color: tones[priority].text,
    border: `1px solid ${tones[priority].border}`,
  };
}

function statusBadgeStyle(status: Contract["status"]): React.CSSProperties {
  const tones = {
    Draft: { bg: "rgba(14,116,144,0.35)", text: "#bae6fd", border: "rgba(56,189,248,0.2)" },
    "In Review": { bg: "rgba(120,53,15,0.35)", text: "#fde68a", border: "rgba(251,191,36,0.2)" },
    Approved: { bg: "rgba(20,83,45,0.35)", text: "#bbf7d0", border: "rgba(74,222,128,0.2)" },
    Signed: { bg: "rgba(76,29,149,0.35)", text: "#ddd6fe", border: "rgba(167,139,250,0.2)" },
    Archived: { bg: "rgba(51,65,85,0.45)", text: "#cbd5e1", border: "rgba(148,163,184,0.18)" },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: tones[status].bg,
    color: tones[status].text,
    border: `1px solid ${tones[status].border}`,
  };
}

function miniStatusBadgeStyle(label: string): React.CSSProperties {
  const lower = label.toLowerCase();

  let bg = "rgba(255,255,255,0.05)";
  let text = "#e5eefc";
  let border = "rgba(255,255,255,0.08)";

  if (
    lower === "approved" ||
    lower === "done" ||
    lower === "complete" ||
    lower === "linked" ||
    lower === "logged"
  ) {
    bg = "rgba(34,197,94,0.16)";
    text = "#bbf7d0";
    border = "rgba(34,197,94,0.18)";
  } else if (lower === "rejected" || lower === "overdue") {
    bg = "rgba(239,68,68,0.16)";
    text = "#fecaca";
    border = "rgba(239,68,68,0.18)";
  } else if (
    lower === "pending" ||
    lower === "required" ||
    lower === "open" ||
    lower === "in progress"
  ) {
    bg = "rgba(251,191,36,0.14)";
    text = "#fde68a";
    border = "rgba(251,191,36,0.18)";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: bg,
    color: text,
    border: `1px solid ${border}`,
    whiteSpace: "nowrap",
  };
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#08111d",
  color: "#f8fbff",
  fontFamily: "Inter, system-ui, sans-serif",
};

const notFoundCardStyle: React.CSSProperties = {
  padding: 28,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const recordPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(250,204,21,0.10), transparent 18%), radial-gradient(circle at bottom right, rgba(96,165,250,0.08), transparent 20%), linear-gradient(180deg, #07101b 0%, #0b1220 48%, #08111d 100%)",
  color: "#e5eefc",
  fontFamily: "Inter, system-ui, sans-serif",
  position: "relative",
  overflow: "hidden",
};

const recordGlowOne: React.CSSProperties = {
  position: "fixed",
  top: -120,
  right: -120,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "rgba(250, 204, 21, 0.08)",
  filter: "blur(30px)",
  pointerEvents: "none",
};

const recordGlowTwo: React.CSSProperties = {
  position: "fixed",
  bottom: -120,
  left: -120,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "rgba(96, 165, 250, 0.08)",
  filter: "blur(30px)",
  pointerEvents: "none",
};

const recordShellStyle: React.CSSProperties = {
  maxWidth: 1480,
  margin: "0 auto",
  padding: "28px 20px 48px",
  position: "relative",
  zIndex: 1,
};

const recordTopbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 18,
  marginBottom: 24,
  padding: "20px 22px",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(14px)",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 10,
  color: "#fde68a",
  fontWeight: 700,
  textDecoration: "none",
};

const recordEyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "#8ea2c8",
  marginBottom: 8,
};

const recordTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1.02,
  letterSpacing: "-0.04em",
  color: "#f8fbff",
};

const recordMetaStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 15,
  color: "#9fb0cd",
};

const recordBadgeWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const recordErrorStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: "12px 14px",
  background: "rgba(127,29,29,0.25)",
  border: "1px solid rgba(248,113,113,0.28)",
  color: "#fecaca",
  borderRadius: 14,
};

const recordSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  marginBottom: 20,
};

const recordSummaryCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
};

const recordSummaryLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8ea2c8",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const recordSummaryValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#f8fbff",
};

const recordMainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.75fr",
  gap: 18,
  alignItems: "start",
};

const recordMainColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const recordSidebarStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const recordPanelStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  boxShadow: "0 14px 40px rgba(0,0,0,0.20)",
};

const recordTabRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 18,
};

const recordTabButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "#cbd5e1",
  fontWeight: 700,
  cursor: "pointer",
};

const recordActiveTabButtonStyle: React.CSSProperties = {
  background: "rgba(250,204,21,0.12)",
  color: "#fde68a",
  border: "1px solid rgba(250,204,21,0.22)",
};

const recordTabContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const recordSectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const recordSectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#f8fbff",
};

const recordSelectStyle: React.CSSProperties = {
  width: 190,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(10, 16, 28, 0.75)",
  color: "#f8fbff",
  fontSize: 14,
  boxSizing: "border-box",
};

const recordDetailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const recordBodyCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const recordBodyLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#7f93b8",
  marginBottom: 8,
};

const recordBodyTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#d9e5f8",
  lineHeight: 1.75,
};

const recordFieldLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#dbe7ff",
};

const recordInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(10, 16, 28, 0.75)",
  color: "#f8fbff",
  fontSize: 14,
  boxSizing: "border-box",
};

const recordEmptyStateStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px dashed rgba(255,255,255,0.14)",
  color: "#9fb0cd",
  background: "rgba(255,255,255,0.02)",
};

const recordStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const recordListCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const recordListTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const recordListTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#f8fbff",
};

const recordListMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8ea2c8",
  marginTop: 4,
};

const recordListBodyStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: "#d9e5f8",
  lineHeight: 1.7,
};

const recordActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 12,
};

const recordActionWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 12,
  flexWrap: "wrap",
};

const recordApproveButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(34,197,94,0.18)",
  color: "#bbf7d0",
  fontWeight: 800,
  cursor: "pointer",
};

const recordRejectButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(239,68,68,0.18)",
  color: "#fecaca",
  fontWeight: 800,
  cursor: "pointer",
};

const recordPrimaryButtonStyle: React.CSSProperties = {
  padding: "13px 16px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #fde047, #f59e0b)",
  color: "#111827",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const recordFormGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 10,
};

const recordDragActiveStyle: React.CSSProperties = {
  border: "1px dashed rgba(250,204,21,0.45)",
  boxShadow: "0 0 0 1px rgba(250,204,21,0.18)",
  background: "rgba(250,204,21,0.05)",
};

const recordUploadZoneInnerStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 6,
  padding: "12px 0 18px",
};

const recordUploadIconStyle: React.CSSProperties = {
  fontSize: 28,
};

const recordUploadTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#f8fbff",
};

const recordUploadSubtextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8ea2c8",
};

const recordUploadStateStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#fde68a",
  fontWeight: 700,
};

const recordDocumentMetaWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const recordDocumentIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: 20,
};

const recordActivityDetailsStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.05)",
  color: "#d9e5f8",
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowX: "auto",
};

const recordSidebarLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "#8ea2c8",
  marginBottom: 8,
};

const recordSidebarTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#f8fbff",
  marginBottom: 8,
};

const recordSidebarBodyStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#d9e5f8",
  lineHeight: 1.75,
};

const recordSidebarMiniGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};