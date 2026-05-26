import { Circle, MapPin, Phone, Tag } from "lucide-react";
import { type Lead } from "@/lib/crm-data";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  identificar: {
    label: "Identificada",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  cualificada: {
    label: "Cualificada",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  seguimiento: {
    label: "Cualificada",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  caliente: {
    label: "Caliente",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  desestimada: {
    label: "Desestimada",
    className: "bg-muted text-muted-foreground border-border",
  },
};

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.identificar;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const status = getStatusConfig(lead.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md",
        "focus:outline-none focus:ring-2 focus:ring-primary/30"
      )}
      aria-label={`Abrir lead: ${lead.ownerName || "Sin propietario"}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug text-foreground">
            {lead.ownerName || "Sin propietario"}
          </p>
          <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
            {lead.address || "Sin domicilio"}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            status.className
          )}
        >
          <Circle className="h-1.5 w-1.5 fill-current" />
          {status.label}
        </span>
      </div>

      <div className="mb-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-mono">{lead.phone || "—"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {[lead.distrito, lead.cp].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Tag className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{lead.source || "Sin origen"}</span>
        </span>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {lead.owner || "Sin owner"}
        </span>
      </div>
    </button>
  );
}
