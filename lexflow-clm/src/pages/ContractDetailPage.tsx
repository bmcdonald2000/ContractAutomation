import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import {
  fetchContractById,
  type Contract,
} from "../lib/contracts";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  console.log("Route param id:", id);

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) {
        setError("No contract ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const found = await fetchContractById(id);

        if (!found) {
          setError("Contract not found");
          setContract(null);
        } else {
          setContract(found);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load contract"
        );
        setContract(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  // ---------------- UI STATES ----------------

  if (loading) {
    return <div style={pageStyle}>Loading contract...</div>;
  }

  if (error) {
    return <div style={pageStyle}>{error}</div>;
  }

  if (!contract) {
    return <div style={pageStyle}>No contract data</div>;
  }

  // ---------------- MAIN VIEW ----------------

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={titleStyle}>{contract.title}</h1>

        <div style={gridStyle}>
          <Detail label="Type" value={contract.type} />
          <Detail label="Owner" value={contract.owner} />
          <Detail label="Counterparty" value={contract.counterparty} />
          <Detail
            label="Value"
            value={`£${contract.value_gbp.toLocaleString()}`}
          />
          <Detail label="Status" value={contract.status} />
          <Detail label="Priority" value={contract.priority} />
          <Detail label="Law" value={contract.governing_law} />
          <Detail label="Renewal" value={contract.renewal_date} />
        </div>

        <Box title="Key obligation">{contract.obligation}</Box>

        <Box title="Notes">{contract.notes || "No notes provided"}</Box>
      </div>
    </div>
  );
}

// ---------------- COMPONENTS ----------------

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailCardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

function Box({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={boxStyle}>
      <div style={labelStyle}>{title}</div>
      <div style={bodyStyle}>{children}</div>
    </div>
  );
}

// ---------------- STYLES ----------------

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0b1220",
  color: "#e5eefc",
  padding: 40,
  fontFamily: "Inter, sans-serif",
};

const containerStyle: CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};

const titleStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const detailCardStyle: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.05)",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 6,
};

const valueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
};

const boxStyle: CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: "rgba(255,255,255,0.05)",
};

const bodyStyle: CSSProperties = {
  marginTop: 6,
  lineHeight: 1.6,
};