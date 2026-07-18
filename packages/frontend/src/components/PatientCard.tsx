import { useState } from "react";
import type { QueueEntry, RiskLevel } from "../types";
import RiskBadge from "./RiskBadge";

interface PatientCardProps {
  entry: QueueEntry;
}

const BORDER_COLOR: Record<RiskLevel, string> = {
  EMERGENCY: "border-l-red-600",
  URGENT: "border-l-orange-500",
  ROUTINE: "border-l-yellow-500",
  SELF_CARE: "border-l-green-600",
};

export default function PatientCard({ entry }: PatientCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { result, chiefComplaint, age, createdAt } = entry;

  const dateStr = new Date(createdAt).toLocaleString();

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md border-l-4 ${BORDER_COLOR[result.riskLevel]}`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {chiefComplaint}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Age: {age} &middot; {dateStr}
            </p>
          </div>
          <RiskBadge level={result.riskLevel} />
        </div>

        {/* Info rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Confidence:</span>{" "}
            <span className="font-medium">
              {(result.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-gray-500">Action:</span>{" "}
            <span className="font-medium text-gray-800">
              {result.recommendedAction}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-2">{result.followUpGuidance}</p>

        {/* Expandable reasoning */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-900 focus:outline-none"
        >
          {expanded ? "Hide reasoning" : "Show reasoning"}
        </button>

        {expanded && (
          <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-700 border border-gray-200">
            {result.reasoning}
          </div>
        )}
      </div>
    </div>
  );
}
