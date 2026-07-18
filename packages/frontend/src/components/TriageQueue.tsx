import { useEffect, useRef } from "react";
import type { QueueEntry } from "../types";
import { RISK_ORDER } from "../types";
import PatientCard from "./PatientCard";

interface TriageQueueProps {
  entries: QueueEntry[];
}

export default function TriageQueue({ entries }: TriageQueueProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sort by risk severity (EMERGENCY first), then by newest first within same risk
  const sorted = [...entries].sort((a, b) => {
    const riskDiff = RISK_ORDER[a.result.riskLevel] - RISK_ORDER[b.result.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Auto-scroll to new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg
          className="h-16 w-16 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <p className="text-lg font-medium">No patients in queue</p>
        <p className="text-sm mt-1">
          Submit a triage assessment to populate the queue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((entry) => (
        <PatientCard key={entry.id} entry={entry} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
