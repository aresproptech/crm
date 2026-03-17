import { cn } from "@/lib/utils";
import { Phone, Radio, Flame, XCircle, BadgeHelp } from "lucide-react";

export type LeadStatus = "identificar" | "seguimiento" | "caliente" | "desestimada";

export interface Lead {
  id: string;
  ownerName: string;
  phone: string;
  status: LeadStatus;
  source: string;
  propertyAddress?: string;
}

const statusConfig: Record<
  LeadStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  identificar: {
    label: "Identificar",
    icon: BadgeHelp,
    className: "bg-violet-50 text-violet-600 border border-violet-100",
  },
  seguimiento: {
    label: "Seguimiento",
    icon: Radio,
    className:
      "bg-blue-50 text-blue-600 border border-blue-100",
  },
  caliente: {
    label: "Caliente",
    icon: Flame,
    className:
      "bg-orange-50 text-orange-600 border border-orange-100",
  },
  desestimada: {
    label: "Desestimada",
    icon: XCircle,
    className:
      "bg-muted text-muted-foreground border border-border",
  },
};

interface LeadCardProps {
  lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
  const status = statusConfig[lead.status];
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border bg-card p-3 shadow-sm",
        "cursor-grab active:cursor-grabbing select-none",
        "transition-all duration-150",
        "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5"
      )}
      role="article"
      aria-label={`Lead: ${lead.ownerName}`}
    >
      {/* Drag handle hint */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-0.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-0.5">
              {[0, 1].map((j) => (
                <div
                  key={j}
                  className="h-1 w-1 rounded-full bg-muted-foreground/30"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Owner */}
      <div className="mb-2 pr-6">
        <p className="text-sm font-semibold text-foreground leading-snug text-pretty">
          {lead.ownerName}
        </p>
        {lead.propertyAddress && (
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug truncate">
            {lead.propertyAddress}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className="mb-3 flex items-center gap-1.5">
        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground font-mono">
          {lead.phone}
        </span>
      </div>

      {/* Footer: status + source */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            status.className
          )}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {status.label}
        </span>
        <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {lead.source}
        </span>
      </div>
    </div>
  );
}
