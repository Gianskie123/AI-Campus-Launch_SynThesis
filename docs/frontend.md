# SynThesis — Frontend Guide
> 24-hour build · Tabs in scope: **Brain**, **Catalog**, **Map**

---

## Stack

| Tool | Reason |
|---|---|
| **Vite + React** | Fastest dev server, instant HMR |
| **Tailwind CSS** | No design system to configure |
| **react-force-graph-2d** | Constellation node-link graph out of the box |
| **Axios** | Clean async API calls |

---

## Step 1 — Bootstrap (10 min)

```bash
npm create vite@latest synthesis-frontend -- --template react
cd synthesis-frontend
npm install
npm install axios react-force-graph-2d
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### `tailwind.config.js`

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

### `src/index.css` — replace entirely

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg:           #0f1117;
  --surface:      #1a1d27;
  --surface-2:    #21253a;
  --border:       #2a2d3e;
  --accent:       #6c7ff2;   /* blue-violet from mockup */
  --accent-teal:  #34d4a4;
  --accent-amber: #f5a623;
  --text:         #e8eaf0;
  --muted:        #7c80a0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
```

---

## Step 2 — Folder Structure

```
src/
├── api/
│   └── index.js          ← all fetch calls in one place
├── components/
│   ├── Sidebar.jsx
│   ├── Brain.jsx
│   ├── Catalog.jsx
│   └── Map.jsx
├── App.jsx
└── main.jsx
```

---

## Step 3 — API Layer `src/api/index.js`

```js
import axios from "axios";

const BASE = "http://localhost:8000";

export const brainQuery  = (query, top_k = 8) =>
  axios.post(`${BASE}/api/brain`, { query, top_k }).then(r => r.data);

export const fetchCatalog = (params = {}) =>
  axios.get(`${BASE}/api/catalog`, { params }).then(r => r.data);

export const fetchMap = (query = "") =>
  axios.get(`${BASE}/api/map`, { params: { query } }).then(r => r.data);
```

---

## Step 4 — App Shell `src/App.jsx`

```jsx
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Brain   from "./components/Brain";
import Catalog from "./components/Catalog";
import Map     from "./components/Map";

export default function App() {
  const [tab, setTab] = useState("Brain");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar active={tab} setActive={setTab} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {tab === "Brain"   && <Brain />}
        {tab === "Catalog" && <Catalog />}
        {tab === "Map"     && <Map />}
      </main>
    </div>
  );
}
```

---

## Step 5 — Sidebar `src/components/Sidebar.jsx`

```jsx
const TABS = [
  { id: "Brain",   icon: "🧠", label: "Brain"   },
  { id: "Catalog", icon: "📚", label: "Catalog" },
  { id: "Map",     icon: "🗺️", label: "Map"     },
];

export default function Sidebar({ active, setActive }) {
  return (
    <aside style={{
      width: 68,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px 0",
      gap: 8,
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      flexShrink: 0,
    }}>
      {/* Logo mark */}
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        color: "var(--accent)",
        marginBottom: 16,
        letterSpacing: "-1px",
      }}>✦</div>

      {TABS.map(({ id, icon, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            title={label}
            onClick={() => setActive(id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "10px 0",
              width: "100%",
              background: isActive ? "var(--surface-2)" : "transparent",
              border: "none",
              borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              color: isActive ? "var(--accent)" : "var(--muted)",
              fontSize: 10,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 20 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </aside>
  );
}
```

---

## Step 6 — Brain Tab `src/components/Brain.jsx`

This is your **hero feature** — spend the most polish here.

```jsx
import { useState } from "react";
import { brainQuery } from "../api";

const SUGGESTIONS = [
  "CNN for crop disease detection",
  "NLP sentiment analysis Filipino text",
  "IoT smart classroom monitoring",
  "Inventory system mobile app",
];

export default function Brain() {
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const run = async (q) => {
    const input = (q || query).trim();
    if (!input) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await brainQuery(input);
      setResult(data);
    } catch {
      setError("Backend unreachable — make sure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
        Team Brain
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 28 }}>
        Ask about any research topic. Get a gap report and thesis direction suggestions.
      </p>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
          placeholder='e.g. "deep learning for medical imaging"'
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          onClick={() => run()}
          disabled={loading}
          style={{
            background: loading ? "var(--border)" : "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "0 20px",
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Thinking…" : "Search"}
        </button>
      </div>

      {/* Quick suggestions */}
      {!result && !loading && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setQuery(s); run(s); }}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: 12,
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[90, 75, 85, 60].map((w, i) => (
            <div key={i} style={{
              height: 14,
              width: `${w}%`,
              background: "var(--surface)",
              borderRadius: 6,
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#2a1a1a",
          border: "1px solid #5a2020",
          borderRadius: 10,
          padding: 16,
          color: "#f87171",
          fontSize: 13,
        }}>{error}</div>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* GPT answer */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            fontSize: 14,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}>
            {result.answer}
          </div>

          {/* Source cards */}
          {result.sources?.length > 0 && (
            <div>
              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
                {result.sources.length} theses retrieved
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.sources.map(t => <ThesisCard key={t.id} thesis={t} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThesisCard({ thesis }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{thesis.title}</p>
      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>
        {thesis.author} · {thesis.year} · {thesis.adviser}
      </p>
      <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
        {thesis.abstract?.slice(0, 130)}…
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {thesis.keywords?.slice(0, 5).map(kw => (
          <span key={kw} style={{
            background: "var(--surface-2)",
            color: "var(--accent)",
            borderRadius: 20,
            padding: "3px 10px",
            fontSize: 11,
          }}>{kw}</span>
        ))}
      </div>
    </div>
  );
}
```

---

## Step 7 — Catalog Tab `src/components/Catalog.jsx`

```jsx
import { useState, useEffect } from "react";
import { fetchCatalog } from "../api";

const DOMAINS = ["", "Computer Vision", "NLP", "IoT", "Web Systems", "Data Analytics"];

export default function Catalog() {
  const [q,       setQ]       = useState("");
  const [domain,  setDomain]  = useState("");
  const [data,    setData]    = useState({ theses: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetchCatalog({ q, domain });
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const inputStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "9px 14px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
  };

  return (
    <div style={{ padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
        Library
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        {data.total} theses indexed
      </p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load()}
          placeholder="Search by title, keyword, abstract…"
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <select
          value={domain}
          onChange={e => setDomain(e.target.value)}
          style={inputStyle}
        >
          {DOMAINS.map(d => <option key={d} value={d}>{d || "All Domains"}</option>)}
        </select>
        <button
          onClick={load}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0 18px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Search
        </button>
        <button
          onClick={() => { setQ(""); setDomain(""); setTimeout(load, 0); }}
          style={{
            ...inputStyle,
            cursor: "pointer",
            color: "var(--muted)",
          }}
        >
          Reset
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : (
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                {["Title", "Author", "Year", "Domain", "Adviser"].map(h => (
                  <th key={h} style={{
                    textAlign: "left",
                    padding: "11px 16px",
                    color: "var(--muted)",
                    fontWeight: 500,
                    fontSize: 11,
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                    textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.theses.map((t, i) => (
                <tr
                  key={t.id}
                  style={{
                    background: i % 2 === 0 ? "var(--bg)" : "var(--surface)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--bg)" : "var(--surface)"}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 500, maxWidth: 300 }}>
                    <span title={t.title}>
                      {t.title.length > 65 ? t.title.slice(0, 65) + "…" : t.title}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{t.author}</td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{t.year}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      background: "var(--surface-2)",
                      color: "var(--accent-teal)",
                      borderRadius: 20,
                      padding: "3px 10px",
                      fontSize: 11,
                    }}>{t.domain}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: 12 }}>
                    {t.adviser}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.theses.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
              No theses match your filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Step 8 — Map Tab `src/components/Map.jsx`

Constellation force graph — cluster nodes (domains) linked to thesis nodes.

```jsx
import { useState, useEffect, useRef, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { fetchMap } from "../api";

const CLUSTER_COLOR = "#6c7ff2";
const THESIS_COLOR  = "#34d4a4";

export default function Map() {
  const [query,     setQuery]     = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const fgRef = useRef();

  const load = async (q = "") => {
    setLoading(true);
    try {
      const data = await fetchMap(q);
      setGraphData({
        nodes: data.nodes,
        links: data.edges.map(e => ({ source: e.source, target: e.target })),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const paintNode = useCallback((node, ctx, scale) => {
    const isCluster = node.type === "cluster";
    const r = isCluster ? 9 : 5;
    const color = isCluster ? CLUSTER_COLOR : THESIS_COLOR;

    // Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Glow for clusters
    if (isCluster) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
      ctx.fillStyle = `${CLUSTER_COLOR}22`;
      ctx.fill();
    }

    // Label
    const label = node.label?.length > 28 ? node.label.slice(0, 28) + "…" : node.label;
    ctx.font = `${isCluster ? "600 " : ""}${(isCluster ? 12 : 9) / scale}px Inter, sans-serif`;
    ctx.fillStyle = isCluster ? "#e8eaf0" : "#7c80a0";
    ctx.textAlign = "center";
    ctx.fillText(label, node.x, node.y + r + 10 / scale);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", position: "relative" }}>
      {/* Search bar overlay */}
      <div style={{
        position: "absolute",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 8,
        zIndex: 10,
      }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load(query)}
          placeholder="Filter map by topic…"
          style={{
            width: 280,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          onClick={() => load(query)}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0 16px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Filter
        </button>
        <button
          onClick={() => { setQuery(""); load(""); }}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0 14px",
            fontSize: 13,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      {/* Force graph */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
            Building knowledge map…
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            backgroundColor="#0f1117"
            linkColor={() => "#2a2d3e"}
            linkWidth={1}
            nodeCanvasObject={paintNode}
            nodeVal={n => n.type === "cluster" ? (n.count || 1) * 4 : 2}
            onNodeClick={node => setSelected(node)}
            cooldownTicks={80}
          />
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <aside style={{
          width: 280,
          padding: 20,
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              background: "var(--surface-2)",
              color: selected.type === "cluster" ? "var(--accent)" : "var(--accent-teal)",
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 11,
            }}>
              {selected.type === "cluster" ? "Domain" : "Thesis"}
            </span>
            <button
              onClick={() => setSelected(null)}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}
            >✕</button>
          </div>

          <h2 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
            {selected.label}
          </h2>

          {selected.type === "cluster" && (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
              {selected.count} theses in this domain
            </p>
          )}

          {selected.type === "thesis" && selected.data && (
            <>
              <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                {selected.data.author} · {selected.data.year}
              </p>
              <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                Adviser: {selected.data.adviser}
              </p>
              <p style={{ color: "var(--muted)", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                {selected.data.abstract?.slice(0, 160)}…
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selected.data.keywords?.map(kw => (
                  <span key={kw} style={{
                    background: "var(--surface-2)",
                    color: "var(--accent)",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 11,
                  }}>{kw}</span>
                ))}
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
```

---

## Step 9 — Start the Frontend

```bash
npm run dev
```

Opens at `http://localhost:5173`

---

## 24-Hour Build Order

Strictly follow this — a working Brain tab at hour 9 is better than a half-finished everything.

| Window | Task |
|---|---|
| **0–2 hrs** | Generate `theses.json` with 20+ records, 3+ domains |
| **2–4 hrs** | Backend: setup → `ingest.py` → verify Qdrant → all 3 routes working |
| **4–5 hrs** | Frontend: Vite scaffold, `index.css`, `App.jsx`, `Sidebar.jsx`, `api/index.js` |
| **5–8 hrs** | **Brain tab** — search bar, GPT output, source cards, loading states |
| **8–10 hrs** | **Catalog tab** — table, filters, empty states |
| **10–13 hrs** | **Map tab** — force graph, cluster/thesis nodes, detail panel |
| **13–16 hrs** | Visual polish across all three tabs |
| **16–20 hrs** | Bug fixes, run the demo script 3 times, prepare talking points |
| **20–24 hrs** | Freeze code. Sleep. One final dry-run on wakeup. |

---

## Demo Script (2–3 min, practice it twice)

1. **Brain tab** → type `"machine learning for crop disease detection"` → show the four-section GPT output and the source thesis cards below it
2. **Catalog tab** → filter by domain `"Computer Vision"` → show filtered results, then reset and search by keyword `"CNN"`
3. **Map tab** → show the full constellation → click a domain cluster node → click an individual thesis node to open the detail panel → type a topic in the filter bar to narrow the map

---

## Pre-Demo Checklist

- [ ] Backend on `localhost:8000`, frontend on `localhost:5173`
- [ ] Brain query returns a structured four-section response with sources
- [ ] Catalog loads all theses; domain filter and keyword search both work
- [ ] Map renders cluster and thesis nodes; clicking either shows the detail panel
- [ ] No red console errors on any tab
- [ ] Demo script rehearsed end-to-end at least twice
