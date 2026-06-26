import { useEffect, useMemo, useState } from "react";
import { fetchReports } from "../api/index.js";

export default function Reports() {
  const [payload, setPayload] = useState(null);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const report = useMemo(() => normalizeReportsPayload(payload), [payload]);

  const loadReports = async (selectedDomain = "") => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchReports(selectedDomain);
      setPayload(result);
    } catch (requestError) {
      setPayload(null);
      setError(
        requestError?.response?.data?.detail ||
          "Backend unreachable. Start FastAPI on port 8000, then reload the reports tab."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports("");
  }, []);

  const handleDomainChange = (event) => {
    const selectedDomain = event.target.value;
    setDomain(selectedDomain);
    loadReports(selectedDomain);
  };

  return (
    <div className="page wide">
      <div className="report-title-row">
        <header className="header-copy">
          <p className="eyebrow">Research reports</p>
          <h1>Review methodologies, tools, and faculty alignment.</h1>
          <p className="lede">
            The reports tab renders JSON-backed summaries for methodology planning and adviser discovery.
          </p>
        </header>

        {report.domains.length > 0 && (
          <select className="select" value={domain} onChange={handleDomainChange} style={{ maxWidth: 260 }}>
            <option value="">All domains</option>
            {report.domains.map((domainName) => (
              <option key={domainName} value={domainName}>
                {domainName}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="status error">{error}</div>}
      {loading && <div className="status">Building methodology and adviser reports from JSON data.</div>}

      {!loading && !error && (
        <div className="section-stack">
          <section className="card">
            <div className="card-header">
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2>1. Methodology and tools breakdown</h2>
                  <p className="lede" style={{ marginTop: 4 }}>
                    Key methods and tools frequently used across relevant theses.
                  </p>
                </div>
                <span className="badge accent">{report.methodologyBreakdown.length} entries</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Tool or methodology</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Uses</th>
                  </tr>
                </thead>
                <tbody>
                  {report.methodologyBreakdown.map((item) => (
                    <tr key={item.tool || item.methodology}>
                      <td>
                        <strong>{item.tool || item.methodology || "Unspecified"}</strong>
                      </td>
                      <td style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>
                        {item.description || "No generated description was returned."}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="badge accent">{item.count ?? item.uses ?? 0}</span>
                      </td>
                    </tr>
                  ))}
                  {report.methodologyBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-secondary)" }}>
                        No methodology data for this domain.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2>2. Adviser recommendations</h2>
                  <p className="lede" style={{ marginTop: 4 }}>
                    Advisers and faculty authors connected to related research areas.
                  </p>
                </div>
                <span className="badge">{report.adviserRecommendations.length} advisers</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Faculty</th>
                    <th>Domains</th>
                    <th style={{ textAlign: "right" }}>Relevant works</th>
                  </tr>
                </thead>
                <tbody>
                  {report.adviserRecommendations.map((adviser) => (
                    <tr key={adviser.name}>
                      <td>
                        <strong>{adviser.name || "Unnamed adviser"}</strong>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{adviser.faculty || adviser.department || "-"}</td>
                      <td>
                        <div className="meta-row">
                          {adviser.domains.length > 0 ? (
                            adviser.domains.map((domainName) => (
                              <span key={domainName} className="badge info">
                                {domainName}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>-</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                        {adviser.thesesMentored} relevant works
                      </td>
                    </tr>
                  ))}
                  {report.adviserRecommendations.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-secondary)" }}>
                        No adviser data for this domain.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function normalizeReportsPayload(payload) {
  const source = payload || {};
  const methodologyRaw =
    source.methodology_breakdown ||
    source.methodologyBreakdown ||
    source.methods ||
    source.tools ||
    source.methodology_tools ||
    [];
  const advisersRaw =
    source.adviser_recommendations ||
    source.adviserRecommendations ||
    source.advisers ||
    source.advisors ||
    [];

  const methodologyBreakdown = Array.isArray(methodologyRaw)
    ? methodologyRaw.map((item) => ({
        tool: item.tool || item.name || item.methodology || item.method || item.label || "Unspecified",
        methodology: item.methodology || item.method || item.tool || item.name || "Unspecified",
        description: item.description || item.summary || item.generated_description || item.notes || "",
        count: item.count ?? item.uses ?? item.frequency ?? item.total ?? 0,
        domains: toArray(item.domains || item.domain)
      }))
    : [];

  const adviserRecommendations = Array.isArray(advisersRaw)
    ? advisersRaw.map((item) => ({
        name: item.name || item.adviser || item.advisor || item.faculty_name || "Unnamed adviser",
        faculty: item.faculty || item.department || item.college || item.role || "",
        domains: toArray(item.domains || item.domain || item.specializations || item.expertise),
        thesesMentored: item.theses_mentored ?? item.thesesMentored ?? item.works_count ?? item.relevant_works ?? item.count ?? item.total ?? 0
      }))
    : [];

  const explicitDomains = Array.isArray(source.domains) ? source.domains : [];
  const derivedDomains = [
    ...methodologyBreakdown.flatMap((item) => item.domains),
    ...adviserRecommendations.flatMap((item) => item.domains)
  ];

  return {
    methodologyBreakdown,
    adviserRecommendations,
    domains: [...new Set([...explicitDomains, ...derivedDomains].filter(Boolean).map(String))].sort()
  };
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [String(value)];
}
