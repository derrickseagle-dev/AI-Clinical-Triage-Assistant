import { useState, useEffect, useCallback } from "react";
import type { QueueEntry } from "./types";
import TriageQueue from "./components/TriageQueue";
import TriageForm from "./components/TriageForm";
import PatientIntake from "./components/PatientIntake";

type Tab = "clinician" | "patient";

function App() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [backendStatus, setBackendStatus] = useState<string>("checking...");
  const [activeTab, setActiveTab] = useState<Tab>("clinician");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus("unreachable"));
  }, []);

  const handleResult = useCallback((entry: QueueEntry) => {
    setQueue((prev) => [entry, ...prev]);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Astrata Health</h1>
            <p className="text-xs text-gray-500">
              AI Clinical Triage Assistant
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                backendStatus === "ok" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-gray-600">
              Backend:{" "}
              <span className="font-medium">{backendStatus}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="flex gap-0 -mb-px" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("clinician")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "clinician"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Clinician Dashboard
            </button>
            <button
              onClick={() => setActiveTab("patient")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "patient"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Patient Intake
            </button>
          </nav>
        </div>
      </div>

      {/* Main content */}
      {activeTab === "clinician" ? (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Triage form sidebar */}
            <aside className="lg:col-span-1">
              <div className="sticky top-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  New Assessment
                </h2>
                <TriageForm onResult={handleResult} />
              </div>
            </aside>

            {/* Triage queue */}
            <section className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Triage Queue
                  {queue.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({queue.length} patient{queue.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </h2>
              </div>
              <TriageQueue entries={queue} />
            </section>
          </div>
        </main>
      ) : (
        <main className="flex-1">
          <PatientIntake />
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
        Astrata Health &mdash; For clinical decision support only. Not a
        substitute for professional medical judgment.
      </footer>
    </div>
  );
}

export default App;
