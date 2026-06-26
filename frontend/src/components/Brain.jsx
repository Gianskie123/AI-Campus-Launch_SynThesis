import { useMemo, useState } from "react";
import { brainQuery } from "../api/index.js";
import BrainConstellation from "./BrainConstellation.jsx";

const DEFAULT_SECTIONS = [
  "Research landscape",
  "Relevant theses",
  "Research gaps",
  "Recommended direction"
];

const EXAMPLES = [
  "machine learning for crop disease detection",
  "CNN-based document classification",
  "mobile learning analytics for senior high school"
];

export default function Brain() {
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSource, setActiveSource] = useState(null);
  const [history, setHistory] = useState([]);
  const [submittedQuery, setSubmittedQuery] = useState("");

  const normalized = useMemo(() => normalizeBrainPayload(payload), [payload]);

  const runQuery = async (submittedQuery = query) => {
    const cleanQuery = submittedQuery.trim();
    if (!cleanQuery) return;

    setQuery(cleanQuery);
    setSubmittedQuery(cleanQuery);
    setLoading(true);
    setError(null);
    setActiveSource(null);

    try {
      const result = await brainQuery(cleanQuery, 8, history);
      setPayload(result);
      if (Array.isArray(result?.history)) {
        setHistory(result.history);
      }
    } catch (requestError) {
      setPayload(null);
      setError(
        requestError?.response?.data?.detail ||
          "Backend unreachable. Start FastAPI on port 8000, then retry the query."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runQuery();
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-copy">
          <p className="eyebrow">SynThesis Brain</p>
          <h1>Ask the research corpus with cited evidence.</h1>
          <p className="lede">
            Submit a topic and review a structured synthesis with source theses, citation chips, and an alignment signal.
          </p>
        </div>
        {normalized.confidence && <ConfidenceBadge value={normalized.confidence} />}
      </header>

      <section className="card" aria-label="Brain query form">
        <div className="card-body">
          <form onSubmit={handleSubmit} className="section-stack">
            <textarea
              className="textarea"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask about a topic, method, dataset, or unexplored thesis angle."
            />
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <div className="toolbar" aria-label="Example queries">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="button secondary"
                    onClick={() => runQuery(example)}
                    disabled={loading}
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="toolbar">
                {history.length > 0 && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setHistory([]);
                      setPayload(null);
                      setActiveSource(null);
                      setSubmittedQuery("");
                    }}
                  >
                    Clear context
                  </button>
                )}
                <button className="button" type="submit" disabled={loading || !query.trim()}>
                  {loading ? "Synthesizing" : history.length > 0 ? "Send follow-up" : "Run synthesis"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <div style={{ height: 20 }} />

      {history.length > 0 && !loading && !error && (
        <div className="status">Conversation context active: {Math.floor(history.length / 2)} research turn(s).</div>
      )}
      {payload?.warning && !loading && !error && <div className="status">{payload.warning}</div>}
      {error && <div className="status error">{error}</div>}
      {loading && <div className="status">Building a cited answer from the thesis corpus.</div>}

      {submittedQuery && !error && (
        <>
          <BrainConstellation
            query={submittedQuery}
            sources={normalized.sources}
            activeSource={activeSource}
            onSourceSelect={setActiveSource}
          />
          <div style={{ height: 20 }} />
        </>
      )}

      {!loading && !error && !payload && (
        <div className="grid-2">
          {DEFAULT_SECTIONS.map((title, index) => (
            <div key={title} className="answer-section">
              <span className="kicker">Section {index + 1}</span>
              <h3>{title}</h3>
              <p>The structured response will appear here after the first query.</p>
            </div>
          ))}
        </div>
      )}

      {!loading && normalized.sections.length > 0 && (
        <section className="section-stack" aria-label="Brain answer">
          <div className="grid-2">
            {normalized.sections.map((section, index) => (
              <AnswerSection
                key={`${section.title}-${index}`}
                title={section.title || DEFAULT_SECTIONS[index] || `Section ${index + 1}`}
                content={section.content}
                index={index}
                onCitationClick={setActiveSource}
              />
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2>Source thesis cards</h2>
                  <p className="lede" style={{ marginTop: 4 }}>
                    Click a card or citation chip to inspect the evidence used in the synthesis.
                  </p>
                </div>
                <span className="badge accent">{normalized.sources.length} sources</span>
              </div>
            </div>
            <div className="card-body">
              {normalized.sources.length === 0 ? (
                <div className="status">No source theses were returned for this query.</div>
              ) : (
                <div className="source-grid">
                  {normalized.sources.map((source, index) => (
                    <SourceCard
                      key={source.id || `${source.title}-${index}`}
                      source={source}
                      index={index}
                      active={activeSource === index + 1 || activeSource === source.id}
                      onClick={() => setActiveSource(index + 1)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ConfidenceBadge({ value }) {
  const normalizedValue = typeof value === "number" && value <= 1 ? Math.round(value * 100) : Math.round(Number(value));
  const label = Number.isFinite(normalizedValue) ? `${normalizedValue}% alignment` : String(value);

  return <span className="badge success">{label}</span>;
}

function AnswerSection({ title, content, index, onCitationClick }) {
  const blocks = normalizeContentBlocks(content);

  return (
    <article className="answer-section">
      <span className="kicker">Section {index + 1}</span>
      <h3>{title}</h3>
      {blocks.length === 0 ? (
        <p>No content returned for this section.</p>
      ) : (
        blocks.map((block, blockIndex) => {
          if (Array.isArray(block)) {
            return (
              <ul key={blockIndex}>
                {block.map((item, itemIndex) => (
                  <li key={`${blockIndex}-${itemIndex}`}>{renderWithCitations(item, onCitationClick)}</li>
                ))}
              </ul>
            );
          }

          return <p key={blockIndex}>{renderWithCitations(block, onCitationClick)}</p>;
        })
      )}
    </article>
  );
}

function SourceCard({ source, index, active, onClick }) {
  return (
    <button
      type="button"
      className={`source-card${active ? " active" : ""}`}
      style={{ textAlign: "left", cursor: "pointer" }}
      onClick={onClick}
    >
      <div className="meta-row">
        <span className="citation-chip">[{index + 1}]</span>
        {source.domain && <span className="badge info">{source.domain}</span>}
        {source.year && <span className="badge">{source.year}</span>}
        {source.recordType && <span className="badge">{formatRecordType(source.recordType)}</span>}
      </div>
      <h3>{source.title || "Untitled thesis"}</h3>
      <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {source.summary || source.abstract || source.description || "No summary provided."}
      </p>
      <div className="meta-row" style={{ marginTop: "auto" }}>
        {source.type && <span className="badge">{formatRecordType(source.type)}</span>}
        {source.proponents && <span className="badge">Proponents: {source.proponents}</span>}
        {!source.proponents && source.author && <span className="badge">{source.author}</span>}
        {source.supervisorLabel && <span className="badge">{source.supervisorLabel}</span>}
        {!source.supervisorLabel && source.adviser && <span className="badge">Adviser: {source.adviser}</span>}
        {source.score && <span className="badge accent">Score {formatScore(source.score)}</span>}
      </div>
    </button>
  );
}

function normalizeBrainPayload(payload) {
  if (!payload) {
    return { sections: [], sources: [], confidence: null };
  }

  const answer = payload.answer ?? payload.response ?? payload.result ?? payload.synthesis ?? payload;
  const sections = normalizeSections(answer, payload.sections);
  const sources = normalizeSources(payload.sources ?? payload.theses ?? payload.results ?? payload.matches ?? []);
  const confidence = payload.confidence ?? payload.alignment_confidence ?? payload.alignment ?? null;

  return { sections, sources, confidence };
}

function normalizeSections(answer, explicitSections) {
  if (Array.isArray(explicitSections)) {
    return explicitSections.map((section, index) => ({
      title: section.title || section.heading || DEFAULT_SECTIONS[index] || `Section ${index + 1}`,
      content: section.content || section.body || section.text || section.items || ""
    }));
  }

  if (typeof answer === "string") {
    return parseMarkdownLikeSections(answer);
  }

  if (answer && typeof answer === "object") {
    const preferredKeys = [
      ["research_landscape", "Research landscape"],
      ["overview", "Research landscape"],
      ["relevant_theses", "Relevant theses"],
      ["sources_summary", "Relevant theses"],
      ["research_gaps", "Research gaps"],
      ["gaps", "Research gaps"],
      ["recommended_direction", "Recommended direction"],
      ["recommendations", "Recommended direction"],
      ["next_steps", "Recommended direction"]
    ];

    const mapped = preferredKeys
      .filter(([key]) => answer[key])
      .map(([key, title]) => ({ title, content: answer[key] }));

    if (mapped.length > 0) return mapped;

    return Object.entries(answer)
      .filter(([, value]) => typeof value !== "object" || Array.isArray(value))
      .map(([key, value]) => ({ title: titleCase(key), content: value }));
  }

  return [];
}

function parseMarkdownLikeSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = { title: DEFAULT_SECTIONS[0], content: [] };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (headingMatch) {
      if (current.content.length > 0) sections.push(current);
      current = { title: headingMatch[1].trim(), content: [] };
    } else if (line.trim()) {
      current.content.push(line.trim());
    }
  }

  if (current.content.length > 0) sections.push(current);

  if (sections.length === 0) {
    return [{ title: "Synthesis", content: text }];
  }

  return sections.slice(0, 4).map((section) => ({ ...section, content: section.content.join("\n") }));
}

function normalizeContentBlocks(content) {
  if (!content) return [];
  if (Array.isArray(content)) return [content.map(String)];

  return String(content)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
      const isList = lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line));
      return isList ? lines.map((line) => line.replace(/^[-*]\s+/, "")) : lines.join(" ");
    });
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];

  return sources.map((source, index) => {
    const thesis = source.thesis || source.metadata || source;
    const proponents = peopleFromFields(thesis.proponents || thesis.proponent || thesis.proponents_text || thesis.authors || thesis.author || thesis.student || thesis.students);

    return {
      id: thesis.id || thesis.thesis_id || source.id || index + 1,
      type: thesis.type || thesis.record_type,
      title: thesis.title || thesis.name || source.title,
      author: proponents.text || thesis.author || thesis.authors || thesis.student,
      proponents: proponents.text,
      adviser: thesis.adviser || thesis.advisor || thesis.mentor || (thesis.type === "faculty_paper" ? firstAuthor(thesis.author) : ""),
      supervisorLabel: supervisorLabel(thesis),
      recordType: thesis.type || source.type || "",
      domain: thesis.domain || thesis.category || thesis.cluster,
      year: thesis.year || thesis.publication_year,
      summary: thesis.summary || thesis.abstract || source.snippet || source.text,
      abstract: thesis.abstract,
      score: source.score || thesis.score
    };
  });
}

function renderWithCitations(text, onCitationClick) {
  const parts = String(text).split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;

    const citationNumber = Number(match[1]);
    return (
      <button
        key={`${part}-${index}`}
        type="button"
        className="citation-chip"
        onClick={() => onCitationClick(citationNumber)}
        aria-label={`Open source ${citationNumber}`}
      >
        {part}
      </button>
    );
  });
}

function supervisorLabel(thesis) {
  if (thesis.supervisor_label) return thesis.supervisor_label;
  if (thesis.type === "faculty_paper") return `Faculty: ${firstAuthor(thesis.author)}`;
  const adviser = thesis.adviser || thesis.advisor || thesis.mentor;
  return adviser ? `Adviser: ${adviser}` : "";
}

function peopleFromFields(value) {
  if (!value) return { list: [], text: "" };
  if (Array.isArray(value)) {
    const list = value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
    return { list, text: list.join(", ") };
  }
  const text = String(value).trim();
  return { list: text ? [text] : [], text };
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

function firstAuthor(author) {
  return String(author || "")
    .split(",")
    .map((part) => part.trim())
    .find(Boolean) || "Unknown faculty";
}

function formatRecordType(type) {
  return titleCase(String(type).replace(/_/g, " "));
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return String(score);
  if (value <= 1) return value.toFixed(2);
  return Math.round(value).toString();
}
