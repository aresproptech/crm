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
  hideEmptyColumns?: boolean;
};

export function KanbanBoard({
  leads,
  onOpenLead,
  onMoveLead,
  hideEmptyColumns = false,
}: KanbanBoardProps) {
  const visibleColumns = hideEmptyColumns
    ? COLUMNS.filter(({ phase }) => leads.some((lead) => lead.phase === phase))
    : COLUMNS;

  if (visibleColumns.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center text-sm text-muted-foreground">
        No se encontraron leads para esta búsqueda.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
      {visibleColumns.map(({ phase, label, accentColor }) => (
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
