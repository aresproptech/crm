import { type Lead } from "@/lib/crm-data";
import { LeadCard } from "./lead-card";

export type PipelinePhase = "noticia" | "concertada" | "valorada" | "encargo";

interface PipelineColumnProps {
  phase: PipelinePhase;
  label: string;
  leads: Lead[];
  accentColor: string;
  onOpenLead: (lead: Lead) => void;
}

export function PipelineColumn({
  label,
  leads,
  accentColor,
  onOpenLead,
}: PipelineColumnProps) {
  return (
    <section className="flex min-h-0 w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-column-bg">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {label}
          </span>
        </div>
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-border bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
          {leads.length}
        </span>
      </div>

      <div className="flex min-h-[200px] flex-1 flex-col gap-2 overflow-y-auto p-2">
        {leads.length > 0 ? (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onOpenLead(lead)}
            />
          ))
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-background/60 px-3 text-center text-xs text-muted-foreground">
            No hay leads en esta fase.
          </div>
        )}
      </div>
    </section>
  );
}
