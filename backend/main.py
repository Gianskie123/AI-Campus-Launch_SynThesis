import os, json
from collections import Counter, defaultdict
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from qdrant_client import QdrantClient
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SynThesis API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

oai  = OpenAI(api_key=os.getenv("AIMLAPI_KEY"), base_url="https://api.aimlapi.com/v1")
qdrant = QdrantClient(host="localhost", port=6333)
COLLECTION  = "theses"
EMBED_MODEL = "text-embedding-3-small"

with open("data/synthesis_research_data.json", encoding="utf-8") as f:
    ALL_THESES = json.load(f)

# ── helpers ──────────────────────────────────────────────

def embed(text: str) -> list[float]:
    return oai.embeddings.create(input=text, model=EMBED_MODEL).data[0].embedding

def semantic_search(query: str, top_k: int = 8) -> list[dict]:
    hits = qdrant.query_points(
        collection_name=COLLECTION,
        query=embed(query),
        limit=top_k,
        with_payload=True,
    ).points
    return [h.payload for h in hits]

def get_supervisor(t: dict) -> str:
    """Return supervisor label depending on record type."""
    if t.get("type") == "thesis":
        return f"Adviser: {t.get('mentor') or 'Unknown'}"
    # faculty_paper — the author IS the expert; no adviser field exists
    return f"Faculty: {t['author'].split(',')[0].strip()}"


def _attribute_records_to_people(records: list[dict]) -> dict[str, dict]:
    """
    Aggregate records per person — thesis advisers/mentors AND faculty
    paper authors — in one place.

    This is shared by build_adviser_ranking() (Brain tab) and reports()
    (Reports tab) so the two can't disagree on who gets credited. reports()
    previously read a literal "adviser" field that doesn't exist anywhere
    in the current schema (theses use "mentor"; faculty papers have no
    adviser at all, just an author list), so every row in the Reports
    tab's adviser table was silently showing "Unknown".
    """
    people: dict[str, dict] = defaultdict(lambda: {
        "score": 0,
        "domains": set(),
        "titles": [],
    })

    for t in records:
        domain = t.get("domain")

        if t.get("type") == "thesis":
            person = t.get("mentor") or "Unknown Adviser"
            people[person]["score"] += 1
            if domain:
                people[person]["domains"].add(domain)
            people[person]["titles"].append(t["title"])

        elif t.get("type") == "faculty_paper":
            raw_authors = t.get("author", "")
            authors = [a.strip() for a in raw_authors.split(",") if a.strip()]
            for i, author in enumerate(authors):
                # Lead/main author counts more than a co-author
                people[author]["score"] += 2 if i == 0 else 1
                if domain:
                    people[author]["domains"].add(domain)
                people[author]["titles"].append(t["title"])

    return people


def build_adviser_ranking(results: list[dict]) -> list[dict]:
    people = _attribute_records_to_people(results)
    return [
        {
            "adviser": name,
            "alignment_score": info["score"],
            "relevant_theses": list(set(info["titles"])),
        }
        for name, info in sorted(people.items(), key=lambda kv: kv[1]["score"], reverse=True)
    ]

# ── models ───────────────────────────────────────────────
class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class BrainRequest(BaseModel):
    query: str
    top_k: int = 8
    history: list[Message] = []

# ── routes ───────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "SynThesis API running"}


# BRAIN — semantic search + GPT conversational research assistant
@app.post("/api/brain")
def brain(req: BrainRequest):
    # Previously, every follow-up re-ran semantic search using ONLY the
    # latest message. That's fine for a first question like "what do we
    # know about xgboost" — but a natural follow-up like "what dataset did
    # they use for that" carries almost no semantic signal on its own, so
    # the retrieved `sources` for that turn were often unrelated to what
    # was actually being discussed, while the system prompt simultaneously
    # told GPT to ground its answer "solely" in those (possibly unrelated)
    # sources.
    #
    # Fix: once history exists, search using the ORIGINAL opening question
    # + the latest message combined, so retrieval stays anchored to the
    # topic while still picking up genuine shifts in the follow-up.
    if req.history:
        opening_query = next(
            (m.content for m in req.history if m.role == "user"),
            req.query,
        )
        search_text = f"{opening_query}. {req.query}"
    else:
        search_text = req.query

    results = semantic_search(search_text, req.top_k)

    adviser_ranking = build_adviser_ranking(results)

    context = "\n".join(
        f"- [{t.get('year', 'n/d')}] \"{t['title']}\" by {t['author']}\n"
        f"  {get_supervisor(t)}\n"
        f"  Methods: {', '.join(t.get('methodology', [])) or 'n/a'}\n"
        f"  Datasets: {', '.join(t.get('datasets', [])) or 'n/a'}\n"
        f"  Abstract: {t.get('abstract', '')}"
        for t in results
    )

    system_prompt = f"""You are SynThesis, a thesis research assistant for FEU Tech students.

STRICT RULE: Base every claim, study reference, finding, and suggestion SOLELY on the
archive context provided below. Do not invent or recall studies outside of it.
If the archive has no relevant information, say so honestly instead of filling gaps with outside knowledge.

RESPONSE BEHAVIOR:
- If this is the FIRST question (no conversation history), always structure your response with these four sections:

  ## What's Been Studied
  Brief summary of what existing theses/papers have explored relevant to the question.

  ## Gap Report
  Specific angles that are underexplored or missing from the archive. Be concrete.

  ## Suggested Thesis Directions
  2–3 actionable thesis directions the student could pursue.

  ## Recommended Methods & Tools
  Tools and methods from the archive that would apply to these directions.

- If this is a FOLLOW-UP question (conversation history exists), respond naturally and conversationally
  like a research mentor. No need to follow the four-section format. Connect your answer to what
  was already discussed and answer in whatever way feels most helpful for that question.

--- FEU Tech Archive Context (for this query) ---
{context}
-------------------------------------------------"""

    # Build full message thread: system + trimmed history + new user message
    MAX_HISTORY = 20
    trimmed_history = req.history[-MAX_HISTORY:]

    messages = [{"role": "system", "content": system_prompt}]

    for msg in trimmed_history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": req.query})

    response = oai.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=700,
    )

    answer = response.choices[0].message.content

    return {
        "answer":          answer,
        "sources":         results,
        "adviser_ranking": adviser_ranking,
        "history": [
            *[{"role": m.role, "content": m.content} for m in req.history],
            {"role": "user",      "content": req.query},
            {"role": "assistant", "content": answer},
        ],
    }

# CATALOG — full list with keyword, domain, year filters
@app.get("/api/catalog")
def catalog(
    q:      str = Query(default=""),
    domain: str = Query(default=""),
    year:   int = Query(default=None),
):
    results = ALL_THESES

    if q:
        ql = q.lower()
        results = [
            t for t in results
            if ql in t["title"].lower()
            or ql in t["abstract"].lower()
            or any(ql in kw.lower() for kw in t.get("keywords", []))
        ]

    if domain:
        results = [t for t in results if t.get("domain", "").lower() == domain.lower()]

    if year:
        results = [t for t in results if t.get("year") == year]

    return {"total": len(results), "theses": results}


# MAP — node/edge graph grouped by domain
@app.get("/api/map")
def knowledge_map(query: str = Query(default="")):
    theses = semantic_search(query, top_k=20) if query else ALL_THESES

    clusters: dict[str, list] = {}
    for t in theses:
        domain = t.get("domain", "Other")
        clusters.setdefault(domain, []).append(t)

    nodes, edges = [], []

    for domain, items in clusters.items():
        cid = f"cluster__{domain.replace(' ', '_')}"
        nodes.append({"id": cid, "label": domain, "type": "cluster", "count": len(items)})
        for t in items:
            nodes.append({
                "id":    t["id"],
                "label": t["title"],
                "type":  "thesis",
                "data":  t,
            })
            edges.append({"source": cid, "target": t["id"]})

    return {
        "nodes":    nodes,
        "edges":    edges,
        "clusters": list(clusters.keys()),
    }


# ── REPORTS ──────────────────────────────────────────────
#
# GET /api/reports
#
# Returns two sections shown in the Reports tab:
#
# 1. methodology_breakdown — every distinct tool/method across all theses,
#    with a frequency count and a one-line description generated by GPT-4o.
#    GPT descriptions are generated once at startup and cached in memory
#    so repeated page loads cost nothing.
#
# 2. adviser_recommendations — every adviser/author ranked by attribution
#    score (thesis mentorship + faculty authorship), with the domains they
#    cover. Shares _attribute_records_to_people() with the Brain tab's
#    build_adviser_ranking(), so the two can't drift out of sync.
#
# Optional query param:
#   ?domain=  — filters both sections to theses in that domain only.

# Build descriptions once at startup (no per-request GPT cost).
def _build_tool_descriptions(tools: list[str]) -> dict[str, str]:
    """Ask GPT-4o for a one-sentence description of each tool/method."""
    if not tools:
        return {}

    tool_list = "\n".join(f"- {t}" for t in tools)
    prompt = (
        "For each tool or methodology listed below, write exactly one sentence "
        "(max 20 words) describing what it is and why researchers use it. "
        "Return ONLY a JSON object where keys are the tool names and values are the descriptions. "
        "No markdown, no commentary.\n\n" + tool_list
    )
    try:
        resp = oai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip ```json fences if present
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception:
        return {t: "" for t in tools}

# Gather all unique tools from the full dataset at startup
_ALL_TOOLS: list[str] = sorted({
    tool
    for thesis in ALL_THESES
    for tool in thesis.get("methodology", [])
})
_TOOL_DESCRIPTIONS: dict[str, str] = _build_tool_descriptions(_ALL_TOOLS)


@app.get("/api/reports")
def reports(domain: str = Query(default="")):
    theses = ALL_THESES

    # Optional domain filter
    if domain:
        theses = [t for t in theses if t.get("domain", "").lower() == domain.lower()]

    # ── 1. Methodology & Tools Breakdown ─────────────────
    tool_counter: Counter = Counter()
    for t in theses:
        for tool in t.get("methodology", []):
            tool_counter[tool] += 1

    methodology_breakdown = [
        {
            "tool":        tool,
            "count":       count,
            "description": _TOOL_DESCRIPTIONS.get(tool, ""),
        }
        for tool, count in tool_counter.most_common()
    ]

    # ── 2. Adviser/Author Recommendations ─────────────────
    people = _attribute_records_to_people(theses)

    adviser_recommendations = sorted(
        [
            {
                "name":             name,
                "faculty":          "CCSMA",
                "theses_mentored":  info["score"],
                "domains":          sorted(info["domains"]),
            }
            for name, info in people.items()
        ],
        key=lambda x: x["theses_mentored"],
        reverse=True,
    )

    # ── Available domain list (for filter dropdown) ───────
    all_domains = sorted({t.get("domain", "") for t in ALL_THESES if t.get("domain")})

    return {
        "methodology_breakdown":    methodology_breakdown,
        "adviser_recommendations":  adviser_recommendations,
        "domains":                  all_domains,
        "filtered_by":              domain or None,
        "thesis_count":             len(theses),
    }