import { Routes, Route } from "react-router-dom";
import ContractDetailPage from "./pages/ContractDetailPage";
import { useEffect, useMemo, useState } from "react";
import {
  createContract,
  defaultContractForm,
  fetchContracts,
  updateContractStatus,
  type Contract,
  type ContractFormData,
} from "./lib/contracts";
import {
  areAllRequiredApprovalsApproved,
  createMissingApprovals,
  getRequiredApprovalTypes,
  updateApprovalDecision,
  type Approval,
  type ApprovalDecision,
} from "./lib/approvals";
import {
  createObligation,
  deleteObligation,
  fetchObligationsByContractId,
  updateObligationStatus,
  type Obligation,
  type ObligationStatus,
} from "./lib/obligations";
import {
  deleteDocumentRecord,
  fetchDocumentsByContractId,
  getSignedDocumentUrl,
  uploadDocumentForContract,
  type DocumentRecord,
} from "./lib/documents";
import {
  createActivity,
  fetchActivitiesByContractId,
  type Activity,
} from "./lib/activities";
import { supabase } from "./lib/supabase";

type DetailTab =
  | "Overview"
  | "Approvals"
  | "Obligations"
  | "Documents"
  | "Activity";

export default function App() {
  return(
    <Routes>
      <Route path="/" element={<Dashboard/>} />
      <Route path="/contract/:id" element={<ContractDetailPage/>} />
    </Routes>
  );
}

function Dashboard() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [form, setForm] = useState<ContractFormData>(defaultContractForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approverName, setApproverName] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [actingApprovalId, setActingApprovalId] = useState<string | null>(null);

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loadingObligations, setLoadingObligations] = useState(false);
  const [obligationError, setObligationError] = useState<string | null>(null);
  const [obligationTitle, setObligationTitle] = useState("");
  const [obligationOwner, setObligationOwner] = useState("");
  const [obligationDueDate, setObligationDueDate] = useState("");
  const [obligationNotes, setObligationNotes] = useState("");
  const [actingObligationId, setActingObligationId] = useState<string | null>(null);
  const [creatingObligation, setCreatingObligation] = useState(false);

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [actingDocumentId, setActingDocumentId] = useState<string | null>(null);
  const [uploadedBy, setUploadedBy] = useState("");

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function loadContracts() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchContracts();
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }

  async function loadApprovals(contract: Contract | null) {
    if (!contract) {
      setApprovals([]);
      return;
    }

    try {
      setLoadingApprovals(true);
      setApprovalError(null);
      const rows = await createMissingApprovals(contract);
      setApprovals(rows);
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : "Failed to load approvals"
      );
    } finally {
      setLoadingApprovals(false);
    }
  }

  async function loadObligations(contract: Contract | null) {
    if (!contract) {
      setObligations([]);
      return;
    }

    try {
      setLoadingObligations(true);
      setObligationError(null);
      const rows = await fetchObligationsByContractId(contract.id);
      setObligations(rows);
    } catch (err) {
      setObligationError(
        err instanceof Error ? err.message : "Failed to load obligations"
      );
    } finally {
      setLoadingObligations(false);
    }
  }

  async function loadDocuments(contract: Contract | null) {
    if (!contract) {
      setDocuments([]);
      return;
    }

    try {
      setLoadingDocuments(true);
      setDocumentError(null);
      const rows = await fetchDocumentsByContractId(contract.id);
      setDocuments(rows);
    } catch (err) {
      setDocumentError(
        err instanceof Error ? err.message : "Failed to load documents"
      );
    } finally {
      setLoadingDocuments(false);
    }
  }

  async function loadActivities(contract: Contract | null) {
    if (!contract) {
      setActivities([]);
      return;
    }

    try {
      setLoadingActivities(true);
      setActivityError(null);
      const rows = await fetchActivitiesByContractId(contract.id);
      setActivities(rows);
    } catch (err) {
      setActivityError(
        err instanceof Error ? err.message : "Failed to load activity"
      );
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
      if (selectedContract && payload.contract_id === selectedContract.id) {
        setActivities((prev) => [created, ...prev]);
      }
    } catch {
      // keep UI alive even if logging fails
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    try {
      setCreating(true);
      setError(null);
      const created = await createContract(form);
      setForm(defaultContractForm);
      await loadContracts();
      setSelectedId(created.id);
      setActiveTab("Overview");

      await logActivity({
        contract_id: created.id,
        action: "contract_created",
        actor: "User",
        details: {
          title: created.title,
          type: created.type,
          counterparty: created.counterparty,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contract");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(
    contractId: string,
    status: Contract["status"]
  ) {
    try {
      setUpdatingId(contractId);
      setError(null);
      const updated = await updateContractStatus(contractId, status);

      setContracts((prev) =>
        prev.map((contract) => (contract.id === contractId ? updated : contract))
      );

      await logActivity({
        contract_id: contractId,
        action: "contract_status_updated",
        actor: "User",
        details: { status },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update contract status"
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleApprovalDecision(
    approvalId: string,
    decision: ApprovalDecision
  ) {
    if (!selectedContract) return;

    try {
      setActingApprovalId(approvalId);
      setApprovalError(null);

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
        contract_id: selectedContract.id,
        action: "approval_decided",
        actor: approverName || "Unknown approver",
        details: {
          approval_type: updated.approval_type,
          decision,
          notes: approvalNotes || null,
        },
      });

      if (decision === "Rejected") {
        const updatedContract = await updateContractStatus(
          selectedContract.id,
          "In Review"
        );

        setContracts((prev) =>
          prev.map((contract) =>
            contract.id === selectedContract.id ? updatedContract : contract
          )
        );
      } else if (areAllRequiredApprovalsApproved(selectedContract, nextApprovals)) {
        const updatedContract = await updateContractStatus(
          selectedContract.id,
          "Approved"
        );

        setContracts((prev) =>
          prev.map((contract) =>
            contract.id === selectedContract.id ? updatedContract : contract
          )
        );

        await logActivity({
          contract_id: selectedContract.id,
          action: "contract_auto_approved",
          actor: approverName || "System",
          details: {
            status: "Approved",
          },
        });
      }

      setApprovalNotes("");
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : "Failed to update approval"
      );
    } finally {
      setActingApprovalId(null);
    }
  }

  async function handleCreateObligation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContract) return;
    if (!obligationTitle.trim() || !obligationOwner.trim()) return;

    try {
      setCreatingObligation(true);
      setObligationError(null);

      const created = await createObligation({
        contract_id: selectedContract.id,
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
        contract_id: selectedContract.id,
        action: "obligation_created",
        actor: "User",
        details: {
          title: created.title,
          owner: created.owner,
          due_date: created.due_date,
        },
      });
    } catch (err) {
      setObligationError(
        err instanceof Error ? err.message : "Failed to create obligation"
      );
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
      setObligationError(null);

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
      setObligationError(
        err instanceof Error ? err.message : "Failed to update obligation status"
      );
    } finally {
      setActingObligationId(null);
    }
  }
  async function handleFileUpload(file: File) {
 if (!file || !selectedContract) return;

 try {
 setUploadingDocument(true);
 setDocumentError(null);

 const created = await uploadDocumentForContract({
 contractId: selectedContract.id,
 file,
 uploadedBy: uploadedBy || "User",
 });

 setDocuments((prev) => [created, ...prev]);

 await logActivity({
 contract_id: selectedContract.id,
 action: "document_uploaded",
 actor: uploadedBy || "User",
 details: {
 file_name: created.file_name,
 mime_type: created.mime_type,
 },
 });
 } catch (err) {
 setDocumentError(
 err instanceof Error ? err.message : "Failed to upload document"
 );
 } finally {
 setUploadingDocument(false);
 }
}

  async function handleDeleteObligation(obligationId: string) {
    const obligation = obligations.find((item) => item.id === obligationId);

    try {
      setActingObligationId(obligationId);
      setObligationError(null);

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
      setObligationError(
        err instanceof Error ? err.message : "Failed to delete obligation"
      );
    } finally {
      setActingObligationId(null);
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
      setDocumentError(null);
      const signedUrl = await getSignedDocumentUrl(document.file_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDocumentError(
        err instanceof Error ? err.message : "Failed to open document"
      );
    }
  }

  async function handleDeleteDocument(document: DocumentRecord) {
    try {
      setActingDocumentId(document.id);
      setDocumentError(null);

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
      setDocumentError(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    } finally {
      setActingDocumentId(null);
    }
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

  function updateForm<K extends keyof ContractFormData>(
    key: K,
    value: ContractFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    loadContracts();
  }, []);

  useEffect(() => {
    if (!selectedId && contracts.length > 0) {
      setSelectedId(contracts[0].id);
    }
  }, [contracts, selectedId]);

  const totalValue = contracts.reduce((sum, contract) => sum + contract.value_gbp, 0);
  const inReviewCount = contracts.filter((c) => c.status === "In Review").length;
  const approvedCount = contracts.filter((c) => c.status === "Approved").length;
  const signedCount = contracts.filter((c) => c.status === "Signed").length;

  const selectedContract = useMemo(() => {
    return contracts.find((contract) => contract.id === selectedId) ?? null;
  }, [contracts, selectedId]);

  useEffect(() => {
    if (activeTab === "Approvals") loadApprovals(selectedContract);
    if (activeTab === "Obligations") loadObligations(selectedContract);
    if (activeTab === "Documents") loadDocuments(selectedContract);
    if (activeTab === "Activity") loadActivities(selectedContract);
  }, [activeTab, selectedContract?.id]);

  useEffect(() => {
  if (selectedContract) {
    loadActivities(selectedContract);
  } else {
    setActivities([]);
  }
}, [selectedContract?.id]);

  const requiredApprovalTypes = selectedContract
    ? getRequiredApprovalTypes(selectedContract)
    : [];

  return (
    <div style={pageStyle}>
      <div style={glowOne} />
      <div style={glowTwo} />

      <div style={shellStyle}>
        <header style={topbarStyle}>
          <div style={brandWrapStyle}>
            <div style={brandMarkStyle}>L</div>
            <div>
              <div style={brandTitleStyle}>LexFlow</div>
              <div style={brandSubStyle}>Contract operations prototype</div>
            </div>
          </div>

          <div style={topbarTagStyle}>Built for Brieanna's legal ops portfolio</div>
        </header>

        <section style={heroStyle}>
          <div>
              <div style={eyebrowStyle}>Legal Ops • Workflow Design • CLM Concept</div>
              <h1 style={heroTitleStyle}>
                A contract workflow app
              </h1>
              <p style={heroTextStyle}>
                LexFlow demonstrates structured intake, lifecycle visibility, and
                legal operations workflow design in a clean UI.
              </p>
              </div>
        </section>
        

        <section style={metricsGridStyle}>
          <MetricCard label="Total contracts" value={String(contracts.length)} />
          <MetricCard label="In review" value={String(inReviewCount)} />
          <MetricCard label="Approved" value={String(approvedCount)} />
          <MetricCard label="Signed" value={String(signedCount)} />
          <MetricCard label="Tracked value" value={`£${totalValue.toLocaleString()}`} />
        </section>

        {error && <div style={errorStyle}>{error}</div>}
        {approvalError && <div style={errorStyle}>{approvalError}</div>}
        {obligationError && <div style={errorStyle}>{obligationError}</div>}
        {documentError && <div style={errorStyle}>{documentError}</div>}
        {activityError && <div style={errorStyle}>{activityError}</div>}

        <section style={workspaceStyle}>
          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={sectionKickerStyle}>Intake</div>
                <h2 style={panelTitleStyle}>New contract request</h2>
              </div>
              <div style={panelTagStyle}>Structured entry</div>
            </div>

            <form onSubmit={handleCreate} style={formGridStyle}>
              <Field label="Title">
                <input
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="Enterprise SaaS MSA"
                  style={inputStyle}
                  required
                />
              </Field>

              <TwoCol>
                <Field label="Contract type">
                  <select
                    value={form.type}
                    onChange={(e) => updateForm("type", e.target.value)}
                    style={inputStyle}
                  >
                    {[
                      "MSA",
                      "NDA",
                      "SaaS Agreement",
                      "DPA",
                      "Supplier Agreement",
                      "Consultancy Agreement",
                      "Order Form",
                    ].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Owner">
                  <input
                    value={form.owner}
                    onChange={(e) => updateForm("owner", e.target.value)}
                    placeholder="Legal Ops"
                    style={inputStyle}
                    required
                  />
                </Field>
              </TwoCol>

              <TwoCol>
                <Field label="Counterparty">
                  <input
                    value={form.counterparty}
                    onChange={(e) => updateForm("counterparty", e.target.value)}
                    placeholder="Acme Ltd"
                    style={inputStyle}
                    required
                  />
                </Field>

                <Field label="Value (£)">
                  <input
                    type="number"
                    value={form.value_gbp}
                    onChange={(e) => updateForm("value_gbp", e.target.value)}
                    placeholder="25000"
                    style={inputStyle}
                    required
                  />
                </Field>
              </TwoCol>

              <TwoCol>
                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      updateForm(
                        "priority",
                        e.target.value as ContractFormData["priority"]
                      )
                    }
                    style={inputStyle}
                  >
                    {["High", "Medium", "Low"].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) =>
                      updateForm(
                        "status",
                        e.target.value as ContractFormData["status"]
                      )
                    }
                    style={inputStyle}
                  >
                    {["Draft", "In Review", "Approved", "Signed", "Archived"].map(
                      (item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </TwoCol>

              <TwoCol>
                <Field label="Governing law">
                  <input
                    value={form.governing_law}
                    onChange={(e) => updateForm("governing_law", e.target.value)}
                    placeholder="England & Wales"
                    style={inputStyle}
                    required
                  />
                </Field>

                <Field label="Renewal date">
                  <input
                    type="date"
                    value={form.renewal_date}
                    onChange={(e) => updateForm("renewal_date", e.target.value)}
                    style={inputStyle}
                    required
                  />
                </Field>
              </TwoCol>

              <Field label="Key obligation">
                <input
                  value={form.obligation}
                  onChange={(e) => updateForm("obligation", e.target.value)}
                  placeholder="Quarterly service review and KPI check"
                  style={inputStyle}
                  required
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  placeholder="Commercial context, risk notes, fallback positions..."
                  style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                />
              </Field>

              <div style={checkboxRowStyle}>
                <Checkbox
                  label="Auto renew"
                  checked={form.auto_renew}
                  onChange={(checked) => updateForm("auto_renew", checked)}
                />
                <Checkbox
                  label="Security review required"
                  checked={form.security_review}
                  onChange={(checked) => updateForm("security_review", checked)}
                />
                <Checkbox
                  label="Finance approval required"
                  checked={form.finance_approval}
                  onChange={(checked) => updateForm("finance_approval", checked)}
                />
              </div>

              <button type="submit" disabled={creating} style={ctaButtonStyle}>
                {creating ? "Creating contract..." : "Create contract"}
              </button>
            </form>
          </section>

          <section style={rightColumnStyle}>
  <section style={panelStyle}>
    <div style={panelHeaderStyle}>
      <div>
        <div style={sectionKickerStyle}>Portfolio Build</div>
        <h2 style={panelTitleStyle}>Contract portfolio view</h2>
      </div>
      <div style={panelTagStyle}>
        Supabase connected: {supabase ? "yes" : "no"}
      </div>
    </div>

    {loading ? (
      <div style={emptyStateStyle}>Loading contracts...</div>
    ) : contracts.length === 0 ? (
      <div style={emptyStateStyle}>
        No contracts yet. Use the intake panel to create your first record.
      </div>
    ) : (
      <div style={cardsWrapStyle}>
        {contracts.map((contract) => (
          <div
            key={contract.id}
            style={{
              ...contractCardStyle,
              ...(selectedId === contract.id ? selectedCardStyle : {}),
            }}
          >
            <div
              onClick={() => {
                setSelectedId(contract.id);
              }}
              style={{ cursor: "pointer" }}
            >
              <div style={contractTopRowStyle}>
                <div>
                  <h3 style={contractTitleStyle}>{contract.title}</h3>
                  <div style={contractMetaStyle}>
                    {contract.counterparty} • {contract.type}
                  </div>
                </div>

                <span style={priorityBadgeStyle(contract.priority)}>
                  {contract.priority}
                </span>
              </div>

              <div style={detailGridStyle}>
                <Detail label="Owner" value={contract.owner} />
                <Detail
                  label="Value"
                  value={`£${contract.value_gbp.toLocaleString()}`}
                />
                <Detail label="Law" value={contract.governing_law} />
                <Detail label="Renewal" value={contract.renewal_date} />
              </div>
            </div>

            <div style={statusPreviewRowStyle}>
              <span style={statusBadgeStyle(contract.status)}>
                {contract.status}
              </span>
              <a
                href={`/contract/${contract.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={viewDetailStyle}
              >
                View details →
              </a>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>

  <section style={sidebarStackStyle}>
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div style={sectionKickerStyle}>Selected Contract</div>
          <h2 style={panelTitleStyle}>Quick preview</h2>
        </div>
        <div style={panelTagStyle}>Snapshot</div>
      </div>

      {!selectedContract ? (
        <div style={emptyStateStyle}>Select a contract to preview it here.</div>
      ) : (
        <div style={stackStyle}>
          <div style={quickPreviewCardStyle}>
            <div style={quickPreviewTopStyle}>
              <div>
                <div style={quickPreviewTitleStyle}>{selectedContract.title}</div>
                <div style={listMetaStyle}>
                  {selectedContract.counterparty} • {selectedContract.type}
                </div>
              </div>
              <span style={priorityBadgeStyle(selectedContract.priority)}>
                {selectedContract.priority}
              </span>
            </div>

            <div style={quickPreviewStatsStyle}>
              <DrawerItem label="Owner" value={selectedContract.owner} />
              <DrawerItem
                label="Status"
                value={selectedContract.status}
              />
              <DrawerItem
                label="Value"
                value={`£${selectedContract.value_gbp.toLocaleString()}`}
              />
              <DrawerItem
                label="Renewal"
                value={selectedContract.renewal_date}
              />
            </div>

            <a
              href={`/contract/${selectedContract.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={openRecordButtonStyle}
            >
              Open full record
            </a>
          </div>
        </div>
      )}
    </section>

    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div style={sectionKickerStyle}>Workflow Health</div>
          <h2 style={panelTitleStyle}>Approval pressure</h2>
        </div>
        <div style={panelTagStyle}>Ops signal</div>
      </div>

      <div style={miniMetricGridStyle}>
        <MiniMetric
          label="In review"
          value={String(inReviewCount)}
        />
        <MiniMetric
          label="Approved"
          value={String(approvedCount)}
        />
        <MiniMetric
          label="Signed"
          value={String(signedCount)}
        />
      </div>
    </section>

    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div style={sectionKickerStyle}>Renewals</div>
          <h2 style={panelTitleStyle}>Upcoming dates</h2>
        </div>
        <div style={panelTagStyle}>Watchlist</div>
      </div>

      {contracts.length === 0 ? (
        <div style={emptyStateStyle}>No contracts available yet.</div>
      ) : (
        <div style={stackStyle}>
          {[...contracts]
            .sort(
              (a, b) =>
                new Date(a.renewal_date).getTime() -
                new Date(b.renewal_date).getTime()
            )
            .slice(0, 4)
            .map((contract) => (
              <div key={contract.id} style={sidebarListCardStyle}>
                <div>
                  <div style={listTitleStyle}>{contract.title}</div>
                  <div style={listMetaStyle}>{contract.counterparty}</div>
                </div>
                <div style={renewalDateStyle}>{contract.renewal_date}</div>
              </div>
            ))}
        </div>
      )}
    </section>

    <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={sectionKickerStyle}>Recent Activity</div>
                <h2 style={panelTitleStyle}>Latest events</h2>
              </div>
              <div style={panelTagStyle}>Feed</div>
            </div>

            {activities.length === 0 ? (
              <div style={emptyStateStyle}>
                Select a contract and open the activity tab on its record to build history.
              </div>
            ) : (
              <div style={stackStyle}>
                {activities.slice(0, 4).map((item) => (
                  <div key={item.id} style={sidebarListCardStyle}>
                    <div>
                      <div style={listTitleStyle}>{formatAction(item.action)}</div>
                      <div style={listMetaStyle}>
                        {item.actor} • {new Date(item.created_at).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                    <span style={miniStatusBadgeStyle("Logged")}>Logged</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
        </section>
        </section>
        </div>
        </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniMetricCardStyle}>
      <div style={miniMetricLabelStyle}>{label}</div>
      <div style={miniMetricValueStyle}>{value}</div>
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
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={checkboxStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailCardStyle}>
      <div style={detailLabelStyle}>{label}</div>
      <div style={detailValueStyle}>{value}</div>
    </div>
  );
}

function DrawerItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={drawerItemStyle}>
      <div style={detailLabelStyle}>{label}</div>
      <div style={drawerItemValueStyle}>{value}</div>
    </div>
  );
}

function formatAction(action: string) {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(250,204,21,0.10), transparent 18%), radial-gradient(circle at bottom right, rgba(96,165,250,0.08), transparent 20%), linear-gradient(180deg, #07101b 0%, #0b1220 48%, #08111d 100%)",
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#e5eefc",
  position: "relative",
  overflow: "hidden",
};

const glowOne: React.CSSProperties = {
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

const glowTwo: React.CSSProperties = {
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

const shellStyle: React.CSSProperties = {
  maxWidth: 1480,
  margin: "0 auto",
  padding: "24px 20px 48px",
  position: "relative",
  zIndex: 1,
};

const topbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 24,
  padding: "14px 18px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(14px)",
  borderRadius: 20,
};

const brandWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandMarkStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "linear-gradient(135deg, #fde047, #f59e0b)",
  color: "#0f172a",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
};

const brandTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#f8fafc",
};

const brandSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#93a4c3",
};

const topbarTagStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#dbe7ff",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const heroStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 18,
  marginBottom: 18,
};

const eyebrowStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#fde68a",
  fontSize: 13,
  marginBottom: 16,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 44,
  lineHeight: 1.02,
  letterSpacing: "-0.04em",
  color: "#f8fbff",
  maxWidth: 760,
};

const heroTextStyle: React.CSSProperties = {
  marginTop: 16,
  color: "#9fb0cd",
  fontSize: 17,
  lineHeight: 1.75,
  maxWidth: 720,
};

const heroButtonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 22,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #fde047, #f59e0b)",
  color: "#111827",
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#e2e8f0",
  fontWeight: 700,
};

const heroPanelStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
};

const heroPanelInnerStyle: React.CSSProperties = {
  height: "100%",
  display: "grid",
  alignContent: "space-between",
  gap: 14,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "#8ea2c8",
};

const miniListStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  marginTop: 5,
  color: "#f8fbff",
  fontWeight: 700,
  fontSize: 18,
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 12,
  marginBottom: 20,
};

const metricCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#93a4c3",
  marginBottom: 8,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#f8fbff",
};

const errorStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: "12px 14px",
  background: "rgba(127,29,29,0.25)",
  border: "1px solid rgba(248,113,113,0.28)",
  color: "#fecaca",
  borderRadius: 14,
};

const workspaceStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.9fr 1.1fr",
  gap: 18,
  alignItems: "start",
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 14px 40px rgba(0,0,0,0.20)",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
  marginBottom: 18,
};

const sectionKickerStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "#8ea2c8",
  marginBottom: 8,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#f8fbff",
};

const panelTagStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#dbe7ff",
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  whiteSpace: "nowrap",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#dbe7ff",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(10, 16, 28, 0.75)",
  color: "#f8fbff",
  fontSize: 14,
  boxSizing: "border-box",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 18,
  flexWrap: "wrap",
};

const checkboxStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "#dbe7ff",
};

const ctaButtonStyle: React.CSSProperties = {
  padding: "13px 16px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #fde047, #f59e0b)",
  color: "#111827",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const emptyStateStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px dashed rgba(255,255,255,0.14)",
  color: "#9fb0cd",
  background: "rgba(255,255,255,0.02)",
};

const cardsWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};
const selectedCardStyle: React.CSSProperties = {
  border: "1px solid rgba(250,204,21,0.35)",
  boxShadow: "0 0 0 1px rgba(250,204,21,0.12)",
  background: "rgba(20, 28, 42, 0.82)",
};

const contractTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  marginBottom: 12,
};

const contractTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: "#f8fbff",
};

const contractMetaStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#93a4c3",
  fontSize: 14,
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginBottom: 12,
};

const detailCardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const detailLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#7f93b8",
  marginBottom: 6,
};

const detailValueStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#e6eefb",
};

const statusPreviewRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const viewDetailStyle: React.CSSProperties = {
fontSize: 13,
color: "#fde68a",
fontWeight: 700,
textDecoration: "none",
};

const detailDrawerStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const detailDrawerTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
};

const drawerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  color: "#f8fbff",
};

const drawerMetaStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#93a4c3",
  fontSize: 14,
};

const tabRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const tabButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "#cbd5e1",
  fontWeight: 700,
  cursor: "pointer",
};

const activeTabButtonStyle: React.CSSProperties = {
  background: "rgba(250,204,21,0.12)",
  color: "#fde68a",
  border: "1px solid rgba(250,204,21,0.22)",
};

const tabContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const drawerStatusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const drawerGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const drawerItemStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const drawerItemValueStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#eef4ff",
};

const drawerBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const drawerBodyTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#d9e5f8",
  lineHeight: 1.7,
};

const stackStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const listCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const listCardBlockStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const listCardTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const listTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#f8fbff",
};

const listMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8ea2c8",
  marginTop: 4,
};

const approvalNotesStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: "#d9e5f8",
  lineHeight: 1.7,
};

const approvalActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 12,
};

const approveButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(34,197,94,0.18)",
  color: "#bbf7d0",
  fontWeight: 800,
  cursor: "pointer",
};

const rejectButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(239,68,68,0.18)",
  color: "#fecaca",
  fontWeight: 800,
  cursor: "pointer",
};

const obligationFormStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 10,
};

const obligationActionWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 12,
  flexWrap: "wrap",
};

const drawerFootNoteStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8ea2c8",
  lineHeight: 1.7,
};

const activityDetailsStyle: React.CSSProperties = {
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

const dragActiveStyle: React.CSSProperties = {
border: "1px dashed rgba(250,204,21,0.45)",
boxShadow: "0 0 0 1px rgba(250,204,21,0.18)",
background: "rgba(250,204,21,0.05)",
};

const uploadZoneInnerStyle: React.CSSProperties = {
display: "grid",
justifyItems: "center",
gap: 6,
padding: "12px 0 18px",
};

const uploadIconStyle: React.CSSProperties = {
fontSize: 28,
};

const uploadTitleStyle: React.CSSProperties = {
fontSize: 15,
fontWeight: 700,
color: "#f8fbff",
};

const uploadSubtextStyle: React.CSSProperties = {
fontSize: 13,
color: "#8ea2c8",
};

const uploadingStateStyle: React.CSSProperties = {
fontSize: 13,
color: "#fde68a",
fontWeight: 700,
};

const documentCardStyle: React.CSSProperties = {
padding: 14,
borderRadius: 16,
background: "rgba(10, 16, 28, 0.55)",
border: "1px solid rgba(255,255,255,0.06)",
};

const documentTopStyle: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "start",
marginBottom: 12,
};

const documentMetaWrapStyle: React.CSSProperties = {
display: "flex",
gap: 12,
alignItems: "center",
};

const documentIconStyle: React.CSSProperties = {
width: 42,
height: 42,
borderRadius: 12,
display: "grid",
placeItems: "center",
background: "rgba(255,255,255,0.05)",
border: "1px solid rgba(255,255,255,0.08)",
fontSize: 20,
};

const contractCardStyle: React.CSSProperties = {
border: "1px solid rgba(255,255,255,0.08)",
borderRadius: 18,
padding: 16,
background: "rgba(10, 16, 28, 0.55)",
textAlign: "left",
};

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

const sidebarStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const quickPreviewCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const quickPreviewTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
};

const quickPreviewTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#f8fbff",
};

const quickPreviewStatsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const openRecordButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: 12,
  textDecoration: "none",
  background: "linear-gradient(135deg, #fde047, #f59e0b)",
  color: "#111827",
  fontWeight: 800,
};

const miniMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
};

const miniMetricCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const miniMetricLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8ea2c8",
  marginBottom: 6,
};

const miniMetricValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#f8fbff",
};

const sidebarListCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  background: "rgba(10, 16, 28, 0.55)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const renewalDateStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#fde68a",
  whiteSpace: "nowrap",
};