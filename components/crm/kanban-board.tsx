import { type Lead } from "@/lib/crm-data";
import { PipelineColumn, type PipelinePhase } from "./pipeline-column";

const COLUMNS: { phase: PipelinePhase; label: string; accentColor: string }[] = [
  { phase: "identificada", label: "Identificada", accentColor: "#94a3b8" },
  { phase: "cualificada", label: "Cualificada", accentColor: "#60a5fa" },
  { phase: "valorada", label: "Valorada", accentColor: "#a78bfa" },
  { phase: "encargo", label: "Encargo", accentColor: "#10b981" },
];

type KanbanBoardProps = {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onMoveLead?: (leadId: string, nextPhase: PipelinePhase) => void;
};

export function KanbanBoard({ leads, onOpenLead, onMoveLead }: KanbanBoardProps) {
  return (
    <div className="flex min-h-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
      {COLUMNS.map(({ phase, label, accentColor }) => (
        <PipelineColumn
          key={phase}
          phase={phase}
          label={label}
          leads={leads.filter((lead) => lead.phase === phase)}
          accentColor={accentColor}
          onOpenLead={onOpenLead}
          onMoveLead={onMoveLead}
        />
      ))}
    </div>
  );
}
