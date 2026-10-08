// Root component. Until the repo-connection flow (pages/, issue #1) can pass a
// real repo ID, a sample picker chooses which mock dataset the dashboard shows.
import { useState } from "react";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import SampleRepoPicker from "./components/dashboard/SampleRepoPicker.jsx";

export default function App() {
  const [repoId, setRepoId] = useState("cortex");

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Cortex</h1>
          <p className="app__tagline">Codebase ownership &amp; bus-factor risk</p>
        </div>
        <SampleRepoPicker value={repoId} onChange={setRepoId} />
      </header>

      {/* key={repoId} gives each repo a fresh Dashboard, so filters and the
          expanded row reset when switching repos. */}
      <Dashboard key={repoId} repoId={repoId} />
    </main>
  );
}
