import type { RiskLevel } from "../types";

interface RiskBadgeProps {
  level: RiskLevel;
}

const COLOR_MAP: Record<RiskLevel, string> = {
  EMERGENCY: "bg-red-600 text-white",
  URGENT: "bg-orange-500 text-white",
  ROUTINE: "bg-yellow-500 text-black",
  SELF_CARE: "bg-green-600 text-white",
};

const LABEL_MAP: Record<RiskLevel, string> = {
  EMERGENCY: "Emergency",
  URGENT: "Urgent",
  ROUTINE: "Routine",
  SELF_CARE: "Self Care",
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${COLOR_MAP[level]}`}
    >
      {LABEL_MAP[level]}
    </span>
  );
}
