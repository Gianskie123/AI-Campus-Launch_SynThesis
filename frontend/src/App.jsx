import { useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Brain from "./components/Brain.jsx";
import Catalog from "./components/Catalog.jsx";
import Reports from "./components/Reports.jsx";

export default function App() {
  const [tab, setTab] = useState("Brain");

  return (
    <div className="app-shell">
      <Sidebar active={tab} setActive={setTab} />
      <main className="main-panel" aria-live="polite">
        {tab === "Brain" && <Brain />}
        {tab === "Catalog" && <Catalog />}
        {tab === "Reports" && <Reports />}
      </main>
    </div>
  );
}
