"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/hooks/useUser";
import {
  X,
  Phone,
  MapPin,
  User,
  Tag,
  Circle,
  Pencil,
  MessageSquare,
  Send,
  Clock,
  Euro,
  LocateFixed,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Lead,
  type Observacion,
  PHASE_LABELS,
  PHASE_OPTIONS,
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  AGENT_OPTIONS,
} from "@/lib/crm-data";

const STATUS_CONFIG = {
  activa: {
    label: "Activa",
    badgeStyle: {
      backgroundColor: "#D4EDBC",
      color: "#288158",
      borderColor: "#B7D99C",
    },
  },
  caliente: {
    label: "Caliente",
    badgeStyle: {
      backgroundColor: "#FFE5D0",
      color: "#C2410C",
      borderColor: "#FDBA74",
    },
  },
  desestimada: {
    label: "Desestimada",
    badgeStyle: {
      backgroundColor: "#F1F5F9",
      color: "#64748B",
      borderColor: "#CBD5E1",
    },
  },
} as const;

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
  onSaveLead: (next: Lead) => Promise<void>;
}

type LeadWithDominio = Lead & {
  dominio?: string | null;
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

function IconRow({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtShort(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTimeShort(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toHistoryCreatedAt(value: string) {
  if (!value) return new Date().toISOString();

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return `${value}T00:00:00.000Z`;
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanUserDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
}

type HistoryEventType = "note" | "field_change";

type LeadHistoryEvent = {
  id: string;
  leadId: string;
  type: HistoryEventType;
  field?: keyof LeadWithDominio;
  prevValue?: string;
  newValue?: string;
  createdAt: string;
  createdBy: string;
  noteText?: string;
};

type LeadActivityEvent = {
  id: string;
  leadId: string;
  createdAt: string;
  createdBy: string;
  text: string;
};

const NOTE_PREFIX = "[NOTA]";
const HISTORY_PREFIX = "[HISTORIAL]";
const SYSTEM_MEMO_PREFIXES = ["[VALORACION]", "[R.G.]", HISTORY_PREFIX];

function parseStoredMemo(memo: string) {
  const trimmed = memo.trim();
  const noteMatch = trimmed.match(/^\[NOTA\]\s*(.*?):\s*([\s\S]*)$/);
  const historyMatch = trimmed.match(/^\[HISTORIAL\]\s*(.*?):\s*([\s\S]*)$/);

  if (noteMatch) {
    return {
      kind: "note" as const,
      createdBy: noteMatch[1].trim() || "Usuario",
      text: noteMatch[2].trim(),
    };
  }

  if (historyMatch) {
    return {
      kind: "history" as const,
      createdBy: historyMatch[1].trim() || "Usuario",
      text: historyMatch[2].trim(),
    };
  }

  return {
    kind: "plain" as const,
    createdBy: "Usuario",
    text: trimmed,
  };
}

function stripSystemMemoPrefix(memo: string, prefix: string) {
  return memo.replace(prefix, "").trim();
}

function parseSystemMemoDetail(memo: string, prefix: string) {
  const detail = stripSystemMemoPrefix(memo, prefix);
  const match = detail.match(/^(.*?):\s*([\s\S]*)$/);
  const reservedLabels = new Set([
    "medio",
    "hora",
    "resultado",
    "dominio",
    "planner",
    "owner",
    "fecha",
  ]);

  if (!match) {
    return {
      createdBy: "",
      text: detail,
    };
  }

  const possibleAuthor = cleanUserDisplayName(match[1].trim());
  if (reservedLabels.has(normalizeBadgeKey(possibleAuthor))) {
    return {
      createdBy: "",
      text: detail,
    };
  }

  return {
    createdBy: possibleAuthor,
    text: match[2].trim(),
  };
}

function buildEventDateLabel(value: string | null | undefined) {
  const formatted = fmtDate(value || "");
  return formatted && formatted !== "—" ? ` para el ${formatted}` : "";
}

function isManualNoteMemo(memo: string) {
  const trimmed = memo.trim();
  return (
    Boolean(trimmed) &&
    (!SYSTEM_MEMO_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) ||
      trimmed.startsWith(NOTE_PREFIX))
  );
}


type RgHistoryEvent = {
  id: string;
  numero: number;
  fecha: string;
  hora: string;
  medio: string;
  resultado: string;
  dominio: string;
  planner: string;
  owner: string;
  memo: string;
};

type ValuationHistoryEvent = {
  id: string;
  numero: number;
  fecha: string;
  hora: string;
  medio: string;
  planner: string;
  owner: string;
  dominio: string;
  resultado: string;
  memo: string;
};

type OpportunityContactRow = {
  id: number | string;
  created_at?: string | null;
  fecha?: string | null;
  memo?: string | null;
  resultado?: boolean | null;
};

type OpportunityOrderRow = {
  id?: number | string;
  opportunity_id?: number | string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  pvp_inicial?: string | number | null;
  pvp_actual?: string | number | null;
  pvp_estimado?: string | number | null;
  com_vendedor?: string | number | null;
  com_comprador?: string | number | null;
  rebajas?: string | number | null;
  health?: string | null;
  memo?: string | null;
  created_at?: string | null;
};

type VisitRow = {
  id?: number | string;
  opportunity_id?: number | string | null;
  estado?: string | null;
  dominio?: string | null;
  planner?: string | null;
  owner?: string | null;
  fecha_visita?: string | null;
  hora?: string | null;
  buyer?: string | null;
  nombre_apellido?: string | null;
  telefono?: string | null;
  telefono_comprador?: string | null;
  dni?: string | null;
  vende?: boolean | string | null;
  observaciones_visita?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

type LeadDetailTab = "resumen" | "valoracion" | "encargo" | "rg" | "visitas";

type EditLeadTab = "resumen" | "inmueble" | "asignacion";

const LEAD_DETAIL_TABS: Array<{ value: LeadDetailTab; label: string }> = [
  { value: "resumen", label: "Resumen" },
  { value: "valoracion", label: "Valoración" },
  { value: "encargo", label: "Encargo" },
  { value: "rg", label: "R.G." },
  { value: "visitas", label: "Visitas" },
];

const EDIT_LEAD_TABS: Array<{ value: EditLeadTab; label: string }> = [
  { value: "resumen", label: "Resumen" },
  { value: "inmueble", label: "Inmueble" },
  { value: "asignacion", label: "Asignación" },
];

const LEAD_DETAIL_PHASE_OPTIONS = PHASE_OPTIONS.filter((opt) =>
  ["Identificada", "Cualificada", "Valorada", "Encargo"].includes(opt.label)
);

const LEAD_DETAIL_STATUS_OPTIONS = [
  { value: "activa", label: "Activa" },
  { value: "caliente", label: "Caliente" },
  { value: "desestimada", label: "Desestimada" },
];

const LEAD_DETAIL_MEDIO_OPTIONS = ["Presencial", "Videollamada", "Teléfono"];
const LEAD_DETAIL_EN_VENTA_OPTIONS = ["SI", "NO", "No Sabe"];

const LEAD_DETAIL_DOMINIO_OPTIONS = [
  "Alcorcón",
  "Chamartín",
  "Investment",
  "Móstoles",
  "Proptech",
];

const PHASE_BADGE_STYLES: Record<
  string,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  identificada: {
    backgroundColor: "#D4EDBC",
    color: "#298259",
    borderColor: "#B7D99C",
  },
  cualificada: {
    backgroundColor: "#94EC89",
    color: "#060905",
    borderColor: "#6FD864",
  },
  valorada: {
    backgroundColor: "#14C02C",
    color: "#FFFFFF",
    borderColor: "#14C02C",
  },
  encargo: {
    backgroundColor: "#109671",
    color: "#FFFFFF",
    borderColor: "#109671",
  },
};

const DOMINIO_BADGE_STYLES: Record<
  string,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  proptech: {
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    borderColor: "#BFDBFE",
  },
  alcorcon: {
    backgroundColor: "#EDE9FE",
    color: "#6D28D9",
    borderColor: "#DDD6FE",
  },
  chamartin: {
    backgroundColor: "#D1FAE5",
    color: "#047857",
    borderColor: "#A7F3D0",
  },
  mostoles: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    borderColor: "#FDE68A",
  },
  investment: {
    backgroundColor: "#FCE7F3",
    color: "#BE185D",
    borderColor: "#FBCFE8",
  },
};

const SOURCE_BADGE_STYLES: Record<
  string,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  tasatucasa: {
    backgroundColor: "#FACC15",
    color: "#111827",
    borderColor: "#EAB308",
  },
  "tasar-online": {
    backgroundColor: "#E9D5FF",
    color: "#7E22CE",
    borderColor: "#D8B4FE",
  },
  home: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
    borderColor: "#CBD5E1",
  },
  "venta-online": {
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    borderColor: "#B91C1C",
  },
  "venta-alquilada": {
    backgroundColor: "#7E22CE",
    color: "#FFFFFF",
    borderColor: "#6B21A8",
  },
};

function getSourceBadgeStyle(value: string | null | undefined) {
  const key = normalizeBadgeKey(value);

  return (
    SOURCE_BADGE_STYLES[key] ?? {
      backgroundColor: "#F1F5F9",
      color: "#475569",
      borderColor: "#CBD5E1",
    }
  );
}

function normalizeBadgeKey(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function getDominioBadgeStyle(value: string | null | undefined) {
  const key = normalizeBadgeKey(value);

  return (
    DOMINIO_BADGE_STYLES[key] ?? {
      backgroundColor: "#F1F5F9",
      color: "#475569",
      borderColor: "#CBD5E1",
    }
  );
}

function getLeadDominio(lead: Lead) {
  const extendedLead = lead as LeadWithDominio;
  const dominio = extendedLead.dominio?.trim();
  return dominio && dominio !== "—" ? dominio : "";
}

function normalizeLeadStatusKey(status: string | null | undefined) {
  const value = normalizeBadgeKey(status);

  if (
    !value ||
    value === "activa" ||
    value === "activo" ||
    value === "identificar" ||
    value === "identificada" ||
    value === "identificado" ||
    value === "cualificada" ||
    value === "seguimiento"
  ) {
    return "activa";
  }

  if (value === "caliente") return "caliente";
  if (value === "desestimada") return "desestimada";

  return "activa";
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[normalizeLeadStatusKey(status)];
}

function normalizeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function statusLabel(value: string) {
  return (
    LEAD_DETAIL_STATUS_OPTIONS.find((o) => o.value === value)?.label ??
    STATUS_OPTIONS.find((o) => o.value === value)?.label ??
    value
  );
}

function formatEuroValue(raw: string | null | undefined): string {
  const digits = raw?.replace(/\D/g, "") ?? "";
  if (!digits) return "";

  const formatted = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 0,
  }).format(Number(digits));

  return `${formatted} €`;
}

function phaseLabel(value: string) {
  return PHASE_LABELS[value as keyof typeof PHASE_LABELS] ?? value;
}

function fieldDisplayName(field: keyof LeadWithDominio): string {
  switch (field) {
    case "status":
      return "Estado";
    case "phase":
      return "Fase";
    case "valor":
      return "Valor";
    case "fechaNoticia":
      return "Fecha noticia";
    case "fechaValoracion":
      return "Fecha valoración";
    case "hora":
      return "Hora";
    case "planner":
      return "Planner";
    case "owner":
      return "Owner";
    case "medio":
      return "Medio";
    case "enVenta":
      return "En Venta";
    case "dominio":
      return "Dominio";
    default:
      return String(field);
  }
}

function formatFieldValue(field: keyof LeadWithDominio, value: string) {
  if (!value) return "—";
  if (field === "status") return statusLabel(value);
  if (field === "phase") return phaseLabel(value);
  if (field === "fechaNoticia" || field === "fechaValoracion") {
    return fmtShort(value);
  }
  return value;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function displayMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return formatEuroValue(String(value));
  return formatEuroValue(String(value)) || String(value);
}

function formValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function persistedRowId(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const id = String(value);
  if (id.startsWith("rg-") || id.startsWith("valuation-") || id.startsWith("order-")) {
    return null;
  }

  return value;
}

function statusValueFromLabel(label: string) {
  const normalized = normalizeBadgeKey(label);

  return (
    LEAD_DETAIL_STATUS_OPTIONS.find(
      (option) =>
        option.value === normalized || normalizeBadgeKey(option.label) === normalized
    )?.value || ""
  );
}


function getPlanningLabel(dateValue: string | null | undefined) {
  if (!dateValue) return "Sin fecha";

  const normalized = dateValue.slice(0, 10);
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (normalized < todayValue) return "Previas";
  if (normalized > todayValue) return "Próximas";
  return "Hoy";
}

function dateOnlyValue(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function localTodayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function daysBetween(start: string | null | undefined, end: string | null | undefined) {
  const startValue = dateOnlyValue(start);
  const endValue = dateOnlyValue(end);

  if (!startValue || !endValue) return "—";

  const startDate = new Date(`${startValue}T00:00:00`);
  const endDate = new Date(`${endValue}T00:00:00`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "—";

  return String(
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function lastCallLabel(days: number | null) {
  if (days === null) return "Sin llamadas";
  if (days === 0) return "0 días";
  if (days === 1) return "1 día";
  return `${days} días`;
}

function monthValue(value: string | null | undefined) {
  const dateValue = dateOnlyValue(value);
  return dateValue ? dateValue.slice(0, 7) : "—";
}

function percentageValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return `${String(value).replace("%", "")} %`;
}

function SmallDataCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Row label={label}>{children}</Row>
    </div>
  );
}

function LeadDetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number | string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {count !== undefined && (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {count}
          </Badge>
        )}
      </div>
      {children}
    </section>
  );
}

interface PostalCodeResult {
  cp: string;
  municipio: string;
  provincia: string;
  distrito: string | null;
}

async function fetchPostalCode(cp: string): Promise<PostalCodeResult | null> {
  try {
    const res = await fetch(`/api/postal-code/${cp}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface EditLeadModalProps {
  lead: LeadWithDominio;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (next: LeadWithDominio) => Promise<void>;
}

function EditLeadModal({
  lead,
  open,
  onOpenChange,
  onSave,
}: EditLeadModalProps) {
  const [form, setForm] = useState({
    ...lead,
    valor: formatEuroValue(lead.valor),
  });
  const [cpLoading, setCpLoading] = useState(false);
  const [cpAutoFilled, setCpAutoFilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<EditLeadTab>("resumen");

  useEffect(() => {
    setForm({
      ...lead,
      valor: formatEuroValue(lead.valor),
    });
    setCpAutoFilled(false);
    setSaveError(null);
    setActiveEditTab("resumen");
  }, [lead]);

  function set(field: keyof LeadWithDominio, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleValorChange(value: string) {
    set("valor", formatEuroValue(value));
  }

  const handleCpChange = useCallback(async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    set("cp", digits);
    setCpAutoFilled(false);

    if (digits.length !== 5) return;

    setCpLoading(true);
    try {
      const result = await fetchPostalCode(digits);
      if (result) {
        set("municipio", result.municipio);
        set("provincia", result.provincia);
        if (result.distrito) set("distrito", result.distrito);
        setCpAutoFilled(true);
      }
    } finally {
      setCpLoading(false);
    }
  }, []);

  function handleDistritoChange(value: string) {
    set("distrito", value);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    try {
      await onSave(form);
      onOpenChange(false);
    } catch (error) {
      console.error("Error guardando lead:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los cambios. Revisá los datos e intentá nuevamente."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-3rem)] max-w-none sm:max-w-[1180px] max-h-[92vh] overflow-hidden p-0">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
            <DialogTitle className="text-base font-semibold">
              Editar lead
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Actualiza la información del lead.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-[190px_minmax(0,1fr)] overflow-hidden">
            <aside className="border-r border-border bg-muted/20 p-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Secciones
              </div>
              <nav className="space-y-1">
                {EDIT_LEAD_TABS.map((tab) => {
                  const isActive = activeEditTab === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveEditTab(tab.value)}
                      className={cn(
                        "flex h-10 w-full items-center rounded-lg px-3 text-left text-xs font-semibold uppercase tracking-wide transition",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="min-h-0 overflow-y-auto px-6 py-5">
              {activeEditTab === "resumen" && (
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Estado del lead
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">Fase</Label>
                        <Select value={form.phase} onValueChange={(v) => set("phase", v)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_DETAIL_PHASE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-sm">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">Estado</Label>
                        <Select
                          value={form.status}
                          onValueChange={(v) => set("status", v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_DETAIL_STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-sm">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 border-t border-border pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Datos principales
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">Propietario</Label>
                        <Input
                          value={form.ownerName}
                          onChange={(e) => set("ownerName", e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">Teléfono</Label>
                        <Input
                          value={form.phone}
                          onChange={(e) => set("phone", e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">Valor</Label>
                        <Input
                          value={form.valor}
                          onChange={(e) => handleValorChange(e.target.value)}
                          className="h-9 text-sm"
                          placeholder="Ej. 450.000 €"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">En Venta</Label>
                        <Select
                          value={form.enVenta ?? "No Sabe"}
                          onValueChange={(v) => set("enVenta", v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_DETAIL_EN_VENTA_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option} className="text-sm">
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeEditTab === "inmueble" && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Datos del inmueble
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium">CP</Label>
                      <div className="relative">
                        <Input
                          value={form.cp}
                          onChange={(e) => handleCpChange(e.target.value)}
                          className="h-9 pr-8 text-sm font-mono"
                          placeholder="5 dígitos"
                          maxLength={5}
                          inputMode="numeric"
                          disabled={cpLoading}
                        />
                        {cpLoading && (
                          <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-medium">
                        Municipio
                        {cpAutoFilled && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
                            <LocateFixed className="h-2.5 w-2.5" />
                            auto
                          </span>
                        )}
                      </Label>
                      <Input
                        value={form.municipio}
                        onChange={(e) => set("municipio", e.target.value)}
                        className={cn(
                          "h-9 text-sm",
                          cpAutoFilled && "border-primary/40 bg-primary/5"
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-medium">
                        Distrito
                        {cpAutoFilled && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
                            <LocateFixed className="h-2.5 w-2.5" />
                            auto
                          </span>
                        )}
                      </Label>
                      <Input
                        value={form.distrito}
                        onChange={(e) => handleDistritoChange(e.target.value)}
                        className={cn(
                          "h-9 text-sm",
                          cpAutoFilled && "border-primary/40 bg-primary/5"
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-medium">
                        Provincia
                        {cpAutoFilled && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
                            <LocateFixed className="h-2.5 w-2.5" />
                            auto
                          </span>
                        )}
                      </Label>
                      <Input
                        value={form.provincia}
                        onChange={(e) => set("provincia", e.target.value)}
                        className={cn(
                          "h-9 text-sm",
                          cpAutoFilled && "border-primary/40 bg-primary/5"
                        )}
                      />
                    </div>
                  </div>
                </section>
              )}


              {activeEditTab === "asignacion" && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Asignación interna
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="planner" className="text-xs font-medium">
                        Planner
                      </Label>
                      <Select
                        value={form.planner ?? ""}
                        onValueChange={(v) => set("planner", v)}
                      >
                        <SelectTrigger id="planner" className="h-9 text-sm">
                          <SelectValue placeholder="Seleccionar planner" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGENT_OPTIONS.map((agent) => (
                            <SelectItem key={agent} value={agent} className="text-sm">
                              {agent}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium">Dominio</Label>
                      <Select
                        value={form.dominio ?? ""}
                        onValueChange={(v) => set("dominio", v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Seleccionar dominio" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_DETAIL_DOMINIO_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option} className="text-sm">
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium">Owner</Label>
                      <Select value={form.owner} onValueChange={(v) => set("owner", v)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGENT_OPTIONS.map((a) => (
                            <SelectItem key={a} value={a} className="text-sm">
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>
              )}

            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-background px-6 py-4">
          {saveError && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {saveError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LeadDetailPanel({
  lead,
  onClose,
  onSaveLead,
}: LeadDetailPanelProps) {
  const { userWithRole } = useUser();
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteEvents, setNoteEvents] = useState<LeadHistoryEvent[]>([]);
  const [activityEvents, setActivityEvents] = useState<LeadActivityEvent[]>([]);
  const [localLead, setLocalLead] = useState<LeadWithDominio | null>(lead as LeadWithDominio | null);
  const [orders, setOrders] = useState<OpportunityOrderRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeadDetailTab>("resumen");
  const [openRgRowId, setOpenRgRowId] = useState<string | null>(null);
  const [openValuationRowId, setOpenValuationRowId] = useState<string | null>(null);
  const [openOrderRowId, setOpenOrderRowId] = useState<string | null>(null);
  const [openVisitRowId, setOpenVisitRowId] = useState<string | null>(null);
  const [valuationModalOpen, setValuationModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [rgModalOpen, setRgModalOpen] = useState(false);
  const [editingValuationId, setEditingValuationId] = useState<number | string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | string | null>(null);
  const [editingRgId, setEditingRgId] = useState<number | string | null>(null);

  const [encargoForm, setEncargoForm] = useState({
    fecha_inicio: "",
    fecha_fin: "",
    pvp_inicial: "",
    pvp_actual: "",
    pvp_estimado: "",
    com_vendedor: "",
    com_comprador: "",
    memo: "",
  });
  const [encargoSaving, setEncargoSaving] = useState(false);
  const [encargoError, setEncargoError] = useState<string | null>(null);

  const [rgForm, setRgForm] = useState({
    fecha: "",
    hora: "",
    medio: "",
    resultado: "",
    memo: "",
  });
  const [rgSaving, setRgSaving] = useState(false);
  const [rgError, setRgError] = useState<string | null>(null);
  const [rgEntries, setRgEntries] = useState<OpportunityContactRow[]>([]);

  const [valuationForm, setValuationForm] = useState({
    fecha: "",
    hora: "",
    medio: "",
  });
  const [valuationSaving, setValuationSaving] = useState(false);
  const [valuationError, setValuationError] = useState<string | null>(null);
  const [valuationEntries, setValuationEntries] = useState<OpportunityContactRow[]>([]);

  useEffect(() => {
    setLocalLead(lead as LeadWithDominio | null);
    setNoteError(null);
  }, [lead]);

  async function loadRelatedData(leadId: string) {
    setRelatedLoading(true);
    setRelatedError(null);

    const numericLeadId = Number(leadId);

    const [ordersResponse, visitsResponse] = await Promise.all([
      supabase
        .from("opportunity_orders")
        .select("*")
        .eq("opportunity_id", numericLeadId),
      supabase
        .from("visitas")
        .select("*")
        .eq("opportunity_id", numericLeadId)
        .order("fecha_visita", { ascending: false }),
    ]);

    if (ordersResponse.error || visitsResponse.error) {
      console.error("Error cargando relaciones del lead:", {
        ordersError: ordersResponse.error,
        visitsError: visitsResponse.error,
      });
      setRelatedError(
        ordersResponse.error?.message ||
          visitsResponse.error?.message ||
          "No se pudieron cargar las relaciones del lead."
      );
      setOrders([]);
      setVisits([]);
      setRelatedLoading(false);
      return;
    }

    setOrders((ordersResponse.data ?? []) as OpportunityOrderRow[]);
    setVisits((visitsResponse.data ?? []) as VisitRow[]);
    setRelatedLoading(false);
  }

  useEffect(() => {
    if (!lead?.id) {
      setOrders([]);
      setVisits([]);
      setRelatedError(null);
      return;
    }

    void loadRelatedData(lead.id);
  }, [lead?.id]);

  const effectiveLead = localLead;

  const currentUserName = useMemo(() => {
    const rawUser = userWithRole as Record<string, unknown> | null | undefined;
    const rawCrmUser = rawUser?.crmUser as Record<string, unknown> | null | undefined;
    const raw =
      stringFromUnknown(rawCrmUser?.name) ||
      stringFromUnknown(rawCrmUser?.nombre) ||
      stringFromUnknown(rawCrmUser?.email) ||
      stringFromUnknown(rawUser?.full_name) ||
      stringFromUnknown(rawUser?.display_name) ||
      stringFromUnknown(rawUser?.name) ||
      stringFromUnknown(rawUser?.nombre) ||
      stringFromUnknown(rawUser?.email) ||
      "Usuario";

    return cleanUserDisplayName(raw);
  }, [userWithRole]);

  async function persistActivity(text: string) {
    if (!effectiveLead) return;

    const createdBy = currentUserName || "Usuario";
    const { error } = await supabase.from("opportunity_contacts").insert({
      opportunity_id: Number(effectiveLead.id),
      fecha: new Date().toISOString().slice(0, 10),
      memo: `${HISTORY_PREFIX} ${createdBy}: ${text}`,
      resultado: true,
    });

    if (error) {
      console.error("Error guardando historial:", error);
    }
  }

  async function handleCallLead() {
    if (!effectiveLead) return;

    await persistActivity("Llamó al lead");
    await loadObservations(effectiveLead.id);
  }

  async function loadObservations(leadId: string) {
    const { data, error } = await supabase
      .from("opportunity_contacts")
      .select("id, created_at, fecha, memo, resultado")
      .eq("opportunity_id", Number(leadId))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando observaciones:", error);
      setNoteEvents([]);
      setActivityEvents([]);
      setNoteError(`No se pudieron cargar las observaciones: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as OpportunityContactRow[];

    const notes: LeadHistoryEvent[] = rows
      .filter((row) => Boolean(row.memo?.trim()))
      .filter((row) => isManualNoteMemo(row.memo || ""))
      .map((row) => ({
        id: String(row.id),
        leadId,
        type: "note",
        createdAt: row.created_at || toHistoryCreatedAt(row.fecha || ""),
        createdBy: parseStoredMemo(row.memo || "").createdBy,
        noteText: parseStoredMemo(row.memo || "").text,
      }));

    const activities: LeadActivityEvent[] = rows
      .filter((row) => Boolean(row.memo?.trim()))
      .flatMap((row) => {
        const memo = row.memo?.trim() || "";
        const parsed = parseStoredMemo(memo);
        const createdAt = row.created_at || toHistoryCreatedAt(row.fecha || "");

        if (parsed.kind === "history") {
          return [
            {
              id: String(row.id),
              leadId,
              createdAt,
              createdBy: parsed.createdBy,
              text: parsed.text,
            },
          ];
        }

        if (memo.startsWith("[VALORACION]")) {
          const detail = parseSystemMemoDetail(memo, "[VALORACION]");
          return [
            {
              id: String(row.id),
              leadId,
              createdAt,
              createdBy: detail.createdBy || currentUserName || parsed.createdBy,
              text: `Agregó una valoración${buildEventDateLabel(row.fecha)}${
                detail.text ? `: ${detail.text}` : ""
              }`,
            },
          ];
        }

        if (memo.startsWith("[R.G.]")) {
          const detail = parseSystemMemoDetail(memo, "[R.G.]");
          return [
            {
              id: String(row.id),
              leadId,
              createdAt,
              createdBy: detail.createdBy || currentUserName || parsed.createdBy,
              text: `Agregó una R.G.${buildEventDateLabel(row.fecha)}${
                detail.text ? `: ${detail.text}` : ""
              }`,
            },
          ];
        }

        return [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setNoteEvents(notes);
    setActivityEvents(activities);
  }

  async function loadRgEntries(leadId: string) {
    const { data, error } = await supabase
      .from("opportunity_contacts")
      .select("id, created_at, fecha, memo, resultado")
      .eq("opportunity_id", Number(leadId))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando R.G.:", error);
      setRgEntries([]);
      return;
    }

    const rows = ((data ?? []) as OpportunityContactRow[]).filter((row) =>
      row.memo?.trim().startsWith("[R.G.]")
    );

    setRgEntries(rows);
  }

  async function loadValuationEntries(leadId: string) {
    const { data, error } = await supabase
      .from("opportunity_contacts")
      .select("id, created_at, fecha, memo, resultado")
      .eq("opportunity_id", Number(leadId))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando valoraciones:", error);
      setValuationEntries([]);
      return;
    }

    const rows = ((data ?? []) as OpportunityContactRow[]).filter((row) =>
      row.memo?.trim().startsWith("[VALORACION]")
    );

    setValuationEntries(rows);
  }

  useEffect(() => {
    if (!lead?.id) {
      setNoteEvents([]);
      setActivityEvents([]);
      setRgEntries([]);
      setValuationEntries([]);
      return;
    }

    void loadObservations(lead.id);
    void loadRgEntries(lead.id);
    void loadValuationEntries(lead.id);
  }, [lead?.id, currentUserName]);

  function buildFieldChangeEvents(prev: LeadWithDominio, next: LeadWithDominio) {
    const tracked: Array<keyof LeadWithDominio> = [
      "valor",
      "phase",
      "status",
      "fechaValoracion",
      "hora",
      "medio",
      "planner",
      "dominio",
      "owner",
      "enVenta",
    ];

    return tracked.flatMap((field) => {
      const before = normalizeValue(prev[field]);
      const after = normalizeValue(next[field]);
      if (before === after) return [];

      return [
        {
          id: `change-${next.id}-${String(field)}-${Date.now()}`,
          leadId: next.id,
          type: "field_change" as const,
          field,
          prevValue: before,
          newValue: after,
          createdAt: new Date().toISOString(),
          createdBy: currentUserName || "Usuario",
        },
      ];
    });
  }

  async function handleSave(next: LeadWithDominio) {
    if (!effectiveLead) return;

    const changes = buildFieldChangeEvents(effectiveLead, next);
    await onSaveLead(next);
    setLocalLead(next);

    if (changes.length > 0) {
      await Promise.all(
        changes.map((event) =>
          persistActivity(
            `Cambió ${fieldDisplayName(event.field!)} de ${formatFieldValue(
              event.field!,
              event.prevValue || ""
            )} a ${formatFieldValue(event.field!, event.newValue || "")}`
          )
        )
      );
      await loadObservations(next.id);
    }
  }

  async function handleAddNote() {
    if (!effectiveLead || !note.trim()) return;

    const text = note.trim();
    setSavingNote(true);
    setNoteError(null);

    const { data: insertedRows, error: insertError } = await supabase
      .from("opportunity_contacts")
      .insert({
        opportunity_id: Number(effectiveLead.id),
        fecha: new Date().toISOString().slice(0, 10),
        memo: `${NOTE_PREFIX} ${currentUserName || "Usuario"}: ${text}`,
        resultado: true,
      })
      .select("id, created_at, fecha, memo, resultado");

    if (insertError) {
      console.error("Error guardando observación:", insertError);
      setSavingNote(false);
      setNoteError(`No se pudo guardar la observación: ${insertError.message}`);
      return;
    }

    const insertedRow = insertedRows?.[0] as OpportunityContactRow | undefined;

    if (!insertedRow?.id) {
      setSavingNote(false);
      setNoteError(
        "La observación no devolvió ID al guardarse. Revisá permisos/RLS de opportunity_contacts."
      );
      return;
    }

    const { data: persistedRow, error: readBackError } = await supabase
      .from("opportunity_contacts")
      .select("id, created_at, fecha, memo, resultado")
      .eq("id", insertedRow.id)
      .maybeSingle();

    if (readBackError) {
      console.error("Error verificando observación guardada:", readBackError);
      setSavingNote(false);
      setNoteError(
        `La observación se insertó, pero no se pudo verificar: ${readBackError.message}`
      );
      return;
    }

    if (!persistedRow) {
      setSavingNote(false);
      setNoteError(
        "La observación se insertó, pero no se puede leer después. Revisá políticas RLS de SELECT en opportunity_contacts."
      );
      return;
    }

    setNote("");
    await loadObservations(effectiveLead.id);
    setSavingNote(false);
  }

  function resetEncargoForm() {
    setEditingOrderId(null);
    setEncargoError(null);
    setEncargoForm({
      fecha_inicio: "",
      fecha_fin: "",
      pvp_inicial: "",
      pvp_actual: "",
      pvp_estimado: "",
      com_vendedor: "",
      com_comprador: "",
      memo: "",
    });
  }

  function resetRgForm() {
    setEditingRgId(null);
    setRgError(null);
    setRgForm({ fecha: "", hora: "", medio: "", resultado: "", memo: "" });
  }

  function resetValuationForm() {
    setEditingValuationId(null);
    setValuationError(null);
    setValuationForm({ fecha: "", hora: "", medio: "" });
  }

  function openNewEncargoModal() {
    resetEncargoForm();
    setOrderModalOpen(true);
  }

  function openEditEncargoModal(order: OpportunityOrderRow) {
    const orderId = persistedRowId(order.id);
    if (!orderId) return;

    setEditingOrderId(orderId);
    setEncargoError(null);
    setEncargoForm({
      fecha_inicio: dateOnlyValue(order.fecha_inicio),
      fecha_fin: dateOnlyValue(order.fecha_fin),
      pvp_inicial: formValue(order.pvp_inicial),
      pvp_actual: formValue(order.pvp_actual),
      pvp_estimado: formValue(order.pvp_estimado),
      com_vendedor: formValue(order.com_vendedor),
      com_comprador: formValue(order.com_comprador),
      memo: formValue(order.memo),
    });
    setOrderModalOpen(true);
  }

  function openNewRgModal() {
    resetRgForm();
    setRgModalOpen(true);
  }

  function openEditRgModal(event: RgHistoryEvent) {
    const rgId = persistedRowId(event.id);
    if (!rgId) return;

    setEditingRgId(rgId);
    setRgError(null);
    setRgForm({
      fecha: dateOnlyValue(event.fecha),
      hora: event.hora || "",
      medio: event.medio === "—" ? "" : event.medio,
      resultado: statusValueFromLabel(event.resultado),
      memo: event.memo || "",
    });
    setRgModalOpen(true);
  }

  function openNewValuationModal() {
    resetValuationForm();
    setValuationModalOpen(true);
  }

  function openEditValuationModal(event: ValuationHistoryEvent) {
    const valuationId = persistedRowId(event.id);
    if (!valuationId) return;

    setEditingValuationId(valuationId);
    setValuationError(null);
    setValuationForm({
      fecha: dateOnlyValue(event.fecha),
      hora: event.hora || "",
      medio: event.medio === "—" ? "" : event.medio,
    });
    setValuationModalOpen(true);
  }

  async function handleAddEncargo() {
    if (!effectiveLead) return;

    setEncargoSaving(true);
    setEncargoError(null);

    const payload = {
      opportunity_id: Number(effectiveLead.id),
      fecha_inicio: encargoForm.fecha_inicio || null,
      fecha_fin: encargoForm.fecha_fin || null,
      pvp_inicial: encargoForm.pvp_inicial ? Number(encargoForm.pvp_inicial) : null,
      pvp_actual: encargoForm.pvp_actual ? Number(encargoForm.pvp_actual) : null,
      pvp_estimado: encargoForm.pvp_estimado ? Number(encargoForm.pvp_estimado) : null,
      com_vendedor: encargoForm.com_vendedor ? Number(encargoForm.com_vendedor) : null,
      com_comprador: encargoForm.com_comprador ? Number(encargoForm.com_comprador) : null,
      memo: encargoForm.memo.trim() || null,
    };

    const { error } = editingOrderId
      ? await supabase
          .from("opportunity_orders")
          .update(payload)
          .eq("id", editingOrderId)
      : await supabase.from("opportunity_orders").insert(payload);

    setEncargoSaving(false);

    if (error) {
      console.error("Error guardando encargo:", error);
      setEncargoError(`No se pudo guardar el encargo: ${error.message}`);
      return;
    }

    const wasEditing = Boolean(editingOrderId);
    resetEncargoForm();
    setOrderModalOpen(false);
    await persistActivity(wasEditing ? "Editó un encargo" : "Agregó un encargo");
    await loadObservations(effectiveLead.id);
    await loadRelatedData(effectiveLead.id);
  }

  async function handleAddRg() {
    if (!effectiveLead) return;

    if (!rgForm.fecha) {
      setRgError("La fecha es obligatoria.");
      return;
    }

    setRgSaving(true);
    setRgError(null);

    const resultadoLabel =
      LEAD_DETAIL_STATUS_OPTIONS.find((option) => option.value === rgForm.resultado)
        ?.label || "—";

    const summaryLine = `[R.G.] ${currentUserName || "Usuario"}: Medio: ${
      rgForm.medio || "—"
    } | Resultado: ${resultadoLabel}${rgForm.hora ? ` | Hora: ${rgForm.hora}` : ""}`;
    const memo = rgForm.memo.trim()
      ? `${summaryLine}\n${rgForm.memo.trim()}`
      : summaryLine;

    const payload = {
      opportunity_id: Number(effectiveLead.id),
      fecha: rgForm.fecha,
      memo,
      resultado: true,
    };

    const { error } = editingRgId
      ? await supabase.from("opportunity_contacts").update(payload).eq("id", editingRgId)
      : await supabase.from("opportunity_contacts").insert(payload);

    setRgSaving(false);

    if (error) {
      console.error("Error guardando R.G.:", error);
      setRgError(`No se pudo guardar la R.G.: ${error.message}`);
      return;
    }

    const wasEditing = Boolean(editingRgId);
    resetRgForm();
    setRgModalOpen(false);
    if (wasEditing) {
      await persistActivity("Editó una R.G.");
    }
    await loadRgEntries(effectiveLead.id);
    await loadObservations(effectiveLead.id);
  }

  async function handleAddValuation() {
    if (!effectiveLead) return;

    if (!valuationForm.fecha) {
      setValuationError("La fecha es obligatoria.");
      return;
    }

    setValuationSaving(true);
    setValuationError(null);

    const summaryLine = `[VALORACION] ${currentUserName || "Usuario"}: Medio: ${
      valuationForm.medio || "—"
    }${valuationForm.hora ? ` | Hora: ${valuationForm.hora}` : ""}`;

    const payload = {
      opportunity_id: Number(effectiveLead.id),
      fecha: valuationForm.fecha,
      memo: summaryLine,
      resultado: true,
    };

    const { error } = editingValuationId
      ? await supabase
          .from("opportunity_contacts")
          .update(payload)
          .eq("id", editingValuationId)
      : await supabase.from("opportunity_contacts").insert(payload);

    setValuationSaving(false);

    if (error) {
      console.error("Error guardando valoración:", error);
      setValuationError(`No se pudo guardar la valoración: ${error.message}`);
      return;
    }

    const wasEditing = Boolean(editingValuationId);
    resetValuationForm();
    setValuationModalOpen(false);
    if (wasEditing) {
      await persistActivity("Editó una valoración");
    }
    await loadValuationEntries(effectiveLead.id);
    await loadObservations(effectiveLead.id);
  }

  if (!effectiveLead) return null;

  const domicilioParts = [
    effectiveLead.address,
    effectiveLead.municipio,
    effectiveLead.cp && effectiveLead.cp !== "—" ? `(${effectiveLead.cp})` : "",
  ].filter((part) => part && part !== "—");

  const parsedRgEntries: RgHistoryEvent[] = rgEntries.map((row, index) => {
    const memoText = row.memo?.trim() || "";
    const [summaryLine, ...rest] = memoText.split("\n");
    const match = summaryLine.match(
      /^\[R\.G\.\] Medio: (.*?) \| Resultado: (.*?)(?: \| Hora: (.*))?$/
    );

    return {
      id: String(row.id),
      numero: rgEntries.length - index,
      fecha: row.fecha || row.created_at || "",
      hora: match?.[3] || "",
      medio: match?.[1] || "—",
      resultado: match?.[2] || "—",
      dominio: getLeadDominio(effectiveLead) || "—",
      planner: effectiveLead.planner || "—",
      owner: effectiveLead.owner || "—",
      memo: rest.join("\n").trim(),
    };
  });

  const legacyRgEvent: RgHistoryEvent[] =
    parsedRgEntries.length === 0 && effectiveLead.fechaNoticia
      ? [
          {
            id: `rg-${effectiveLead.id}-${effectiveLead.fechaNoticia}`,
            numero: 1,
            fecha: effectiveLead.fechaNoticia,
            hora: effectiveLead.hora || "",
            medio: effectiveLead.medio || "—",
            resultado: statusLabel(effectiveLead.status),
            dominio: getLeadDominio(effectiveLead) || "—",
            planner: effectiveLead.planner || "—",
            owner: effectiveLead.owner || "—",
            memo: "R.G. derivada de la información actual del lead.",
          },
        ]
      : [];

  const rgHistoryEvents: RgHistoryEvent[] = [...parsedRgEntries, ...legacyRgEvent];

  const parsedValuationEntries: ValuationHistoryEvent[] = valuationEntries.map(
    (row, index) => {
      const memoText = row.memo?.trim() || "";
      const match = memoText.match(
        /^\[VALORACION\] Medio: (.*?)(?: \| Hora: (.*))?$/
      );

      return {
        id: String(row.id),
        numero: valuationEntries.length - index,
        fecha: row.fecha || row.created_at || "",
        hora: match?.[2] || "",
        medio: match?.[1] || "—",
        planner: effectiveLead.planner || "—",
        owner: effectiveLead.owner || "—",
        dominio: getLeadDominio(effectiveLead) || "—",
        resultado: statusLabel(effectiveLead.status),
        memo: "",
      };
    }
  );

  const legacyValuationEvent: ValuationHistoryEvent[] =
    parsedValuationEntries.length === 0 && effectiveLead.fechaValoracion
      ? [
          {
            id: `valuation-${effectiveLead.id}-${effectiveLead.fechaValoracion}`,
            numero: 1,
            fecha: effectiveLead.fechaValoracion,
            hora: effectiveLead.hora || "",
            medio: effectiveLead.medio || "—",
            planner: effectiveLead.planner || "—",
            owner: effectiveLead.owner || "—",
            dominio: getLeadDominio(effectiveLead) || "—",
            resultado: statusLabel(effectiveLead.status),
            memo: "Valoración derivada de la información actual del lead.",
          },
        ]
      : [];

  const valuationHistoryEvents: ValuationHistoryEvent[] = [
    ...parsedValuationEntries,
    ...legacyValuationEvent,
  ];

  const lastCallEvent =
    activityEvents.find((event) =>
      normalizeBadgeKey(event.text).startsWith("llamo-al-lead")
    ) || null;
  const lastCallDays = daysSince(lastCallEvent?.createdAt);

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-[1080px] max-w-[calc(100vw-1rem)] flex-col border-l border-border bg-background shadow-2xl">
      <div className="relative flex shrink-0 border-b border-border px-5 py-4">
        <div className="min-w-0 w-full pr-8 text-center md:text-left">
          <h2 className="truncate text-base font-semibold text-foreground">
            {effectiveLead.ownerName}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {effectiveLead.address || "—"}
          </p>

          {effectiveLead.phone && effectiveLead.phone !== "—" && (
            <>
              <a
                href={`tel:${effectiveLead.phone.replace(/[^+\d]/g, "")}`}
                onClick={() => void handleCallLead()}
                className="mx-auto mt-2 flex h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 md:hidden"
              >
                Llamar
              </a>

              <a
                href={`tel:${effectiveLead.phone.replace(/[^+\d]/g, "")}`}
                onClick={() => void handleCallLead()}
                className="mt-1 hidden text-xs font-medium text-muted-foreground transition hover:text-foreground md:block"
              >
                {effectiveLead.phone}
              </a>
            </>
          )}
        </div>

        <div className="absolute right-5 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Cerrar panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-3">
        <Badge
          variant="outline"
          className="h-7 gap-1.5 rounded-md px-3 text-sm font-semibold"
          style={getStatusConfig(effectiveLead.status).badgeStyle}
        >
          <Circle className="h-2 w-2 fill-current" />
          {getStatusConfig(effectiveLead.status).label}
        </Badge>

        <Badge
          variant="outline"
          className="h-7 rounded-md px-3 text-sm font-semibold"
          style={
            PHASE_BADGE_STYLES[effectiveLead.phase] ?? {
              backgroundColor: "#F1F5F9",
              color: "#475569",
              borderColor: "#CBD5E1",
            }
          }
        >
          {PHASE_LABELS[effectiveLead.phase]}
        </Badge>

        {getLeadDominio(effectiveLead) && (
          <Badge
            variant="outline"
            className="h-7 rounded-md px-3 text-sm font-semibold"
            style={getDominioBadgeStyle(getLeadDominio(effectiveLead))}
          >
            {getLeadDominio(effectiveLead)}
          </Badge>
        )}

        <Badge
          variant="outline"
          className="h-7 rounded-md px-3 text-sm font-semibold"
          style={getSourceBadgeStyle(effectiveLead.source)}
        >
          {effectiveLead.source || "—"}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mt-5 border-t border-border pt-4">
          {relatedError && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              No se pudieron cargar algunas relaciones: {relatedError}
            </div>
          )}

          <div className="space-y-4">
            <nav className="flex w-full touch-pan-x gap-1 overflow-x-auto rounded-xl border border-border bg-muted/20 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-5 md:overflow-visible">
              {LEAD_DETAIL_TABS.map((tab) => {
                const isActive = activeTab === tab.value;
                const count =
                  tab.value === "encargo"
                    ? orders.length
                    : tab.value === "visitas"
                      ? visits.length
                      : tab.value === "rg"
                        ? rgHistoryEvents.length
                        : tab.value === "valoracion"
                          ? valuationHistoryEvents.length
                          : undefined;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "inline-flex h-10 min-w-max flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-center text-[11px] font-semibold uppercase tracking-wide transition sm:px-4 md:min-w-0 md:px-2",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span>{tab.label}</span>
                    {count !== undefined && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px]",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-background text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 rounded-xl border border-border bg-background p-5 shadow-sm">
              {activeTab === "resumen" && (
                <div className="space-y-3">
                  <div className="space-y-5">
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Datos generales
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1.5 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                          onClick={() => setEditOpen(true)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar datos
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                        <SmallDataCard label="Propietario">
                          {effectiveLead.ownerName || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Teléfono">
                          {effectiveLead.phone || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Última llamada">
                          <span>{lastCallLabel(lastCallDays)}</span>
                          {lastCallEvent ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {fmtDateTimeShort(lastCallEvent.createdAt)}
                            </span>
                          ) : null}
                        </SmallDataCard>
                        <SmallDataCard label="Valor">
                          {effectiveLead.valor || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="F. Noticia">
                          {fmtDate(effectiveLead.fechaNoticia)}
                        </SmallDataCard>
                        <SmallDataCard label="F. Contacto">
                          {fmtDate(effectiveLead.fechaContacto)}
                        </SmallDataCard>
                        <SmallDataCard label="En Venta">
                          {effectiveLead.enVenta || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Planner">
                          {effectiveLead.planner || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Owner">
                          {effectiveLead.owner || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Origen">
                          {effectiveLead.source || "—"}
                        </SmallDataCard>
                      </div>
                    </section>

                    <section className="space-y-3 border-t border-border pt-4">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Datos del inmueble
                      </h4>
                      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                        <SmallDataCard label="Domicilio">
                          {domicilioParts.length > 0 ? domicilioParts.join(", ") : "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Distrito">
                          {effectiveLead.distrito || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="CP">
                          {effectiveLead.cp || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Municipio">
                          {effectiveLead.municipio || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Provincia">
                          {effectiveLead.provincia || "—"}
                        </SmallDataCard>
                        <SmallDataCard label="Dominio">
                          {getLeadDominio(effectiveLead) || "—"}
                        </SmallDataCard>
                      </div>
                    </section>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Observaciones
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {noteEvents.length}
                      </Badge>
                    </div>

                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Escribe una observación..."
                      className="min-h-[76px] resize-none text-sm"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={handleAddNote}
                        disabled={!note.trim() || savingNote}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Añadir
                      </Button>
                    </div>

                    {noteError && (
                      <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                        {noteError}
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      {noteEvents.length === 0 && (
                        <p className="text-xs italic text-muted-foreground">
                          Sin observaciones todavía.
                        </p>
                      )}

                      {noteEvents.map((event) => (
                        <div key={event.id} className="relative border-l border-border pl-4">
                          <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-primary bg-background" />
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{fmtDateTimeShort(event.createdAt)}</span>
                            <span>por {event.createdBy}</span>
                          </div>
                          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                            {event.noteText}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Historial
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {activityEvents.length}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {activityEvents.length === 0 && (
                        <p className="text-xs italic text-muted-foreground">
                          Sin actividad registrada todavía.
                        </p>
                      )}

                      {activityEvents.map((event) => (
                        <div key={event.id} className="relative border-l border-border pl-4">
                          <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-primary bg-background" />
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{fmtDateTimeShort(event.createdAt)}</span>
                            <span>por {event.createdBy}</span>
                          </div>
                          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                            {event.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "valoracion" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
  <div className="flex items-center gap-2">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Historial de valoraciones
    </h3>
    <Badge variant="secondary" className="rounded-full text-[10px]">
      {valuationHistoryEvents.length}
    </Badge>
  </div>

  <Button
    type="button"
    size="sm"
    className="h-8 text-xs"
    onClick={openNewValuationModal}
  >
    Agregar valoración
  </Button>
</div>

                  {valuationHistoryEvents.length === 0 ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs italic text-muted-foreground">
                        No hay valoraciones cargadas todavía.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                      <div className="grid min-w-[760px] grid-cols-[94px_1.3fr_90px_1fr_1fr_1fr_72px] border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Valoración</span>
                        <span>Fecha</span>
                        <span>Hora</span>
                        <span>Medio</span>
                        <span>Planner</span>
                        <span>Resultado</span>
                        <span />
                      </div>

                      {valuationHistoryEvents.map((event) => {
                        const isOpen = openValuationRowId === event.id;

                        return (
                          <div key={event.id} className="border-b border-border last:border-b-0">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenValuationRowId((current) =>
                                  current === event.id ? null : event.id
                                )
                              }
                              className="grid w-full min-w-[760px] grid-cols-[94px_1.3fr_90px_1fr_1fr_1fr_72px] items-center px-3 py-3 text-left text-sm transition hover:bg-muted/40"
                            >
                              <span className="font-semibold text-foreground">
                                #{event.numero}
                              </span>
                              <span className="text-foreground">{fmtDate(event.fecha)}</span>
                              <span className="text-muted-foreground">
                                {event.hora || "—"}
                              </span>
                              <span className="text-muted-foreground">{event.medio}</span>
                              <span className="text-muted-foreground">{event.planner}</span>
                              <span>
                                <Badge variant="outline" className="rounded-md text-[11px]">
                                  {event.resultado}
                                </Badge>
                              </span>
                              <span className="flex items-center justify-end gap-2">
                                {persistedRowId(event.id) ? (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    title="Editar valoración"
                                    aria-label="Editar valoración"
                                    className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                    onClick={(clickEvent) => {
                                      clickEvent.stopPropagation();
                                      openEditValuationModal(event);
                                    }}
                                    onKeyDown={(keyEvent) => {
                                      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                                      keyEvent.preventDefault();
                                      keyEvent.stopPropagation();
                                      openEditValuationModal(event);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground/40" />
                                )}
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    isOpen && "rotate-180"
                                  )}
                                />
                              </span>
                            </button>

                            {isOpen && (
                              <div className="border-t border-border bg-muted/20 px-4 py-4">
                                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                  <SmallDataCard label="Número valoración">
                                    #{event.numero}
                                  </SmallDataCard>
                                  <SmallDataCard label="Fecha valoración">
                                    {fmtDate(event.fecha)}
                                  </SmallDataCard>
                                  <SmallDataCard label="Hora">
                                    {event.hora || "—"}
                                  </SmallDataCard>
                                  <SmallDataCard label="Medio">
                                    {event.medio}
                                  </SmallDataCard>
                                  <SmallDataCard label="Planner">
                                    {event.planner}
                                  </SmallDataCard>
                                  <SmallDataCard label="Owner">
                                    {event.owner}
                                  </SmallDataCard>
                                  <SmallDataCard label="Dominio">
                                    {event.dominio}
                                  </SmallDataCard>
                                  <SmallDataCard label="Resultado">
                                    {event.resultado}
                                  </SmallDataCard>
                                </div>

                                <div className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                                  <span className="font-semibold uppercase tracking-wide text-foreground">
                                    Observación / memo:{" "}
                                  </span>
                                  {event.memo || "—"}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "encargo" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
  <div className="flex items-center gap-2">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Encargo
    </h3>
    <Badge variant="secondary" className="rounded-full text-[10px]">
      {orders.length}
    </Badge>
  </div>

  <Button
    type="button"
    size="sm"
    className="h-8 text-xs"
    onClick={openNewEncargoModal}
  >
    Agregar encargo
  </Button>
</div>

                  {relatedLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando encargos...</p>
                  ) : orders.length === 0 ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs italic text-muted-foreground">
                        No hay encargos cargados todavía.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                      <div className="grid min-w-[760px] grid-cols-[84px_1.2fr_1.2fr_1fr_1fr_1fr_72px] border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Encargo</span>
                        <span>Inicio</span>
                        <span>Fin</span>
                        <span>PVP inicial</span>
                        <span>PVP actual</span>
                        <span>Health</span>
                        <span />
                      </div>

                      {orders.map((order, index) => {
                        const rowId = String(order.id ?? `order-${index}`);
                        const isOpen = openOrderRowId === rowId;
                        const inicio = order.fecha_inicio || "";
                        const fin = order.fecha_fin || "";
                        const diasGestion = daysBetween(inicio, localTodayValue());
                        const diasRestantes = daysBetween(localTodayValue(), fin);

                        return (
                          <div key={rowId} className="border-b border-border last:border-b-0">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenOrderRowId((current) =>
                                  current === rowId ? null : rowId
                                )
                              }
                              className="grid w-full min-w-[760px] grid-cols-[84px_1.2fr_1.2fr_1fr_1fr_1fr_72px] items-center px-3 py-3 text-left text-sm transition hover:bg-muted/40"
                            >
                              <span className="font-semibold text-foreground">
                                #{index + 1}
                              </span>
                              <span className="text-foreground">{fmtDate(inicio)}</span>
                              <span className="text-foreground">{fmtDate(fin)}</span>
                              <span className="text-muted-foreground">
                                {displayMoney(order.pvp_inicial)}
                              </span>
                              <span className="text-muted-foreground">
                                {displayMoney(order.pvp_actual)}
                              </span>
                              <span>
                                <Badge variant="outline" className="rounded-md text-[11px]">
                                  {displayValue(order.health || "0,0")}
                                </Badge>
                              </span>
                              <span className="flex items-center justify-end gap-2">
                                {persistedRowId(order.id) ? (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    title="Editar encargo"
                                    aria-label="Editar encargo"
                                    className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                    onClick={(clickEvent) => {
                                      clickEvent.stopPropagation();
                                      openEditEncargoModal(order);
                                    }}
                                    onKeyDown={(keyEvent) => {
                                      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                                      keyEvent.preventDefault();
                                      keyEvent.stopPropagation();
                                      openEditEncargoModal(order);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground/40" />
                                )}
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    isOpen && "rotate-180"
                                  )}
                                />
                              </span>
                            </button>

                            {isOpen && (
                              <div className="border-t border-border bg-muted/20 px-4 py-4">
                                <section className="space-y-3">
                                  <h5 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Datos del encargo #{index + 1}
                                  </h5>
                                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                    <SmallDataCard label="Health">
                                      {displayValue(order.health || "0,0")}
                                    </SmallDataCard>
                                    <SmallDataCard label="Estado">
                                      {statusLabel(effectiveLead.status)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Dominio">
                                      {getLeadDominio(effectiveLead) || "—"}
                                    </SmallDataCard>
                                    <SmallDataCard label="Origen">
                                      {effectiveLead.source || "—"}
                                    </SmallDataCard>
                                    <SmallDataCard label="Inicio">
                                      {fmtDate(inicio)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Fin">
                                      {fmtDate(fin)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Días gestión">
                                      {diasGestion}
                                    </SmallDataCard>
                                    <SmallDataCard label="Días rest.">
                                      {diasRestantes}
                                    </SmallDataCard>
                                    <SmallDataCard label="In month">
                                      {monthValue(inicio)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Out month">
                                      {monthValue(fin)}
                                    </SmallDataCard>
                                  </div>
                                </section>

                                <section className="mt-5 space-y-3 border-t border-border pt-4">
                                  <h5 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Inmueble y responsables
                                  </h5>
                                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                    <SmallDataCard label="Domicilio">
                                      {domicilioParts.length > 0 ? domicilioParts.join(", ") : "—"}
                                    </SmallDataCard>
                                    <SmallDataCard label="Propietario">
                                      {effectiveLead.ownerName || "—"}
                                    </SmallDataCard>
                                    <SmallDataCard label="Planner">
                                      {effectiveLead.planner || "—"}
                                    </SmallDataCard>
                                    <SmallDataCard label="Owner">
                                      {effectiveLead.owner || "—"}
                                    </SmallDataCard>
                                  </div>
                                </section>

                                <section className="mt-5 space-y-3 border-t border-border pt-4">
                                  <h5 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Comisiones y PVP
                                  </h5>
                                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                    <SmallDataCard label="% vendedor">
                                      {percentageValue(order.com_vendedor)}
                                    </SmallDataCard>
                                    <SmallDataCard label="% comprador">
                                      {percentageValue(order.com_comprador)}
                                    </SmallDataCard>
                                    <SmallDataCard label="PVP inicial">
                                      {displayMoney(order.pvp_inicial)}
                                    </SmallDataCard>
                                    <SmallDataCard label="PVP actual">
                                      {displayMoney(order.pvp_actual)}
                                    </SmallDataCard>
                                    <SmallDataCard label="PVP estimado">
                                      {displayMoney(order.pvp_estimado)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Rebajas">
                                      {displayValue(order.rebajas)}
                                    </SmallDataCard>
                                    <SmallDataCard label="PVP desvío">
                                      —
                                    </SmallDataCard>
                                    <SmallDataCard label="% desvío">
                                      —
                                    </SmallDataCard>
                                  </div>
                                </section>

                                <section className="mt-5 border-t border-border pt-4">
                                  <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Memo
                                  </h5>
                                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                                    {order.memo || "—"}
                                  </div>
                                </section>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "rg" && (
                <div className="space-y-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Historial R.G.
                      </h4>
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {rgHistoryEvents.length}
                      </Badge>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={openNewRgModal}
                    >
                      Agregar R.G.
                    </Button>
                  </div>

                  {rgHistoryEvents.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">
                      Sin gestiones R.G. registradas todavía.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                      <div className="grid min-w-[720px] grid-cols-[64px_1.3fr_90px_1fr_1fr_1fr_72px] border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>R.G.</span>
                        <span>Fecha</span>
                        <span>Hora</span>
                        <span>Medio</span>
                        <span>Resultado</span>
                        <span>Dominio</span>
                        <span />
                      </div>

                      {rgHistoryEvents.map((event) => {
                        const isOpen = openRgRowId === event.id;

                        return (
                          <div key={event.id} className="border-b border-border last:border-b-0">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenRgRowId((current) =>
                                  current === event.id ? null : event.id
                                )
                              }
                              className="grid w-full min-w-[720px] grid-cols-[64px_1.3fr_90px_1fr_1fr_1fr_72px] items-center px-3 py-3 text-left text-sm transition hover:bg-muted/40"
                            >
                              <span className="font-semibold text-foreground">
                                #{event.numero}
                              </span>
                              <span className="text-foreground">{fmtDate(event.fecha)}</span>
                              <span className="text-muted-foreground">
                                {event.hora || "—"}
                              </span>
                              <span className="text-muted-foreground">{event.medio}</span>
                              <span>
                                <Badge variant="outline" className="rounded-md text-[11px]">
                                  {event.resultado}
                                </Badge>
                              </span>
                              <span className="text-muted-foreground">{event.dominio}</span>
                              <span className="flex items-center justify-end gap-2">
                                {persistedRowId(event.id) ? (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    title="Editar R.G."
                                    aria-label="Editar R.G."
                                    className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                    onClick={(clickEvent) => {
                                      clickEvent.stopPropagation();
                                      openEditRgModal(event);
                                    }}
                                    onKeyDown={(keyEvent) => {
                                      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                                      keyEvent.preventDefault();
                                      keyEvent.stopPropagation();
                                      openEditRgModal(event);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground/40" />
                                )}
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    isOpen && "rotate-180"
                                  )}
                                />
                              </span>
                            </button>

                            {isOpen && (
                              <div className="border-t border-border bg-muted/20 px-4 py-4">
                                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                  <SmallDataCard label="Número R.G.">
                                    #{event.numero}
                                  </SmallDataCard>
                                  <SmallDataCard label="Fecha R.G.">
                                    {fmtDate(event.fecha)}
                                  </SmallDataCard>
                                  <SmallDataCard label="Hora">
                                    {event.hora || "—"}
                                  </SmallDataCard>
                                  <SmallDataCard label="Medio">
                                    {event.medio}
                                  </SmallDataCard>
                                  <SmallDataCard label="Resultado">
                                    {event.resultado}
                                  </SmallDataCard>
                                  <SmallDataCard label="Dominio">
                                    {event.dominio}
                                  </SmallDataCard>
                                  <SmallDataCard label="Planner">
                                    {event.planner}
                                  </SmallDataCard>
                                  <SmallDataCard label="Owner">
                                    {event.owner}
                                  </SmallDataCard>
                                </div>

                                <div className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                                  <span className="font-semibold uppercase tracking-wide text-foreground">
                                    Observación / memo:{" "}
                                  </span>
                                  {event.memo || "—"}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "visitas" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Historial de visitas
                      </h3>
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {visits.length}
                      </Badge>
                    </div>
                  </div>

                  {relatedLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando visitas...</p>
                  ) : visits.length === 0 ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs italic text-muted-foreground">
                        Sin visitas asociadas todavía.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                      <div className="grid min-w-[760px] grid-cols-[84px_1.2fr_90px_1fr_1fr_1fr_72px] border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Visita</span>
                        <span>Fecha</span>
                        <span>Hora</span>
                        <span>Comprador</span>
                        <span>Teléfono</span>
                        <span>Estado</span>
                        <span />
                      </div>

                      {visits.map((visit, index) => {
                        const rowId = String(visit.id ?? `visit-${index}`);
                        const isOpen = openVisitRowId === rowId;

                        return (
                          <div key={rowId} className="border-b border-border last:border-b-0">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenVisitRowId((current) =>
                                  current === rowId ? null : rowId
                                )
                              }
                              className="grid w-full min-w-[760px] grid-cols-[84px_1.2fr_90px_1fr_1fr_1fr_72px] items-center px-3 py-3 text-left text-sm transition hover:bg-muted/40"
                            >
                              <span className="font-semibold text-foreground">
                                #{index + 1}
                              </span>
                              <span className="text-foreground">
                                {fmtDate(visit.fecha_visita || "")}
                              </span>
                              <span className="text-muted-foreground">
                                {visit.hora || "—"}
                              </span>
                              <span className="text-muted-foreground">
                                {displayValue(visit.nombre_apellido || visit.buyer)}
                              </span>
                              <span className="text-muted-foreground">
                                {displayValue(visit.telefono_comprador || visit.telefono)}
                              </span>
                              <span>
                                <Badge variant="outline" className="rounded-md text-[11px]">
                                  {displayValue(visit.estado)}
                                </Badge>
                              </span>
                              <span className="flex items-center justify-end gap-2">
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    isOpen && "rotate-180"
                                  )}
                                />
                              </span>
                            </button>

                            {isOpen && (
                              <div className="border-t border-border bg-muted/20 px-4 py-4">
                                <section className="space-y-3">
                                  <h5 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Datos de la visita #{index + 1}
                                  </h5>

                                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                    <SmallDataCard label="Fecha visita">
                                      {fmtDate(visit.fecha_visita || "")}
                                    </SmallDataCard>
                                    <SmallDataCard label="Hora">
                                      {visit.hora || "—"}
                                    </SmallDataCard>
                                    <SmallDataCard label="Estado">
                                      {displayValue(visit.estado)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Buyer">
                                      {displayValue(visit.buyer)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Nombre">
                                      {displayValue(visit.nombre_apellido)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Teléfono">
                                      {displayValue(visit.telefono_comprador || visit.telefono)}
                                    </SmallDataCard>
                                    <SmallDataCard label="DNI">
                                      {displayValue(visit.dni)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Vende">
                                      {displayValue(visit.vende)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Planner">
                                      {displayValue(visit.planner)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Owner">
                                      {displayValue(visit.owner)}
                                    </SmallDataCard>
                                    <SmallDataCard label="Dominio">
                                      {displayValue(visit.dominio)}
                                    </SmallDataCard>
                                  </div>
                                </section>

                                <section className="mt-5 border-t border-border pt-4">
                                  <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Observaciones
                                  </h5>
                                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                                    {visit.observaciones_visita || "—"}
                                  </div>
                                </section>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <Button variant="outline" className="w-full" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <Dialog
        open={valuationModalOpen}
        onOpenChange={(open) => {
          setValuationModalOpen(open);
          if (!open) resetValuationForm();
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {editingValuationId ? "Editar valoración" : "Agregar valoración"}
            </DialogTitle>
            <DialogDescription>
              {editingValuationId
                ? "Actualiza los datos principales de la valoración del lead."
                : "Carga los datos principales de la valoración del lead."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Fecha valoración</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={valuationForm.fecha}
                onChange={(e) =>
                  setValuationForm((prev) => ({ ...prev, fecha: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Hora</Label>
              <Input
                type="time"
                className="h-9 text-sm"
                value={valuationForm.hora}
                onChange={(e) =>
                  setValuationForm((prev) => ({ ...prev, hora: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Medio</Label>
              <Select
                value={valuationForm.medio}
                onValueChange={(value) =>
                  setValuationForm((prev) => ({ ...prev, medio: value }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar medio" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_DETAIL_MEDIO_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-sm">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {valuationError ? (
            <p className="text-sm text-destructive">{valuationError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setValuationModalOpen(false)}
              disabled={valuationSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAddValuation}
              disabled={valuationSaving}
            >
              {valuationSaving
                ? "Guardando..."
                : editingValuationId
                  ? "Actualizar valoración"
                  : "Guardar valoración"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={orderModalOpen}
        onOpenChange={(open) => {
          setOrderModalOpen(open);
          if (!open) resetEncargoForm();
        }}
      >
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>{editingOrderId ? "Editar encargo" : "Agregar encargo"}</DialogTitle>
            <DialogDescription>
              {editingOrderId
                ? "Actualiza los datos principales del encargo del lead."
                : "Carga los datos principales del encargo del lead."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Fecha inicio</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={encargoForm.fecha_inicio}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, fecha_inicio: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Fecha fin</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={encargoForm.fecha_fin}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, fecha_fin: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">PVP inicial</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Ej. 450.000 €"
                inputMode="numeric"
                value={encargoForm.pvp_inicial}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, pvp_inicial: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">PVP actual</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Ej. 440.000 €"
                inputMode="numeric"
                value={encargoForm.pvp_actual}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, pvp_actual: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">PVP estimado</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Ej. 430.000 €"
                inputMode="numeric"
                value={encargoForm.pvp_estimado}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, pvp_estimado: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Comisión vendedor</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Ej. 3 %"
                inputMode="decimal"
                value={encargoForm.com_vendedor}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, com_vendedor: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Comisión comprador</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Ej. 3 %"
                inputMode="decimal"
                value={encargoForm.com_comprador}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, com_comprador: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className="text-xs font-medium">Observación</Label>
              <Textarea
                placeholder="Observaciones del encargo..."
                className="min-h-[96px] resize-none text-sm"
                value={encargoForm.memo}
                onChange={(e) =>
                  setEncargoForm((prev) => ({ ...prev, memo: e.target.value }))
                }
              />
            </div>
          </div>

          {encargoError ? (
            <p className="text-sm text-destructive">{encargoError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOrderModalOpen(false)}
              disabled={encargoSaving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddEncargo} disabled={encargoSaving}>
              {encargoSaving
                ? "Guardando..."
                : editingOrderId
                  ? "Actualizar encargo"
                  : "Guardar encargo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rgModalOpen}
        onOpenChange={(open) => {
          setRgModalOpen(open);
          if (!open) resetRgForm();
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingRgId ? "Editar R.G." : "Agregar R.G."}</DialogTitle>
            <DialogDescription>
              {editingRgId
                ? "Actualiza los datos principales de la reunión de gestión del lead."
                : "Carga los datos principales de la reunión de gestión del lead."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Fecha R.G.</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={rgForm.fecha}
                onChange={(e) => setRgForm((prev) => ({ ...prev, fecha: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Hora</Label>
              <Input
                type="time"
                className="h-9 text-sm"
                value={rgForm.hora}
                onChange={(e) => setRgForm((prev) => ({ ...prev, hora: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Medio</Label>
              <Select
                value={rgForm.medio}
                onValueChange={(value) => setRgForm((prev) => ({ ...prev, medio: value }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar medio" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_DETAIL_MEDIO_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-sm">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Resultado</Label>
              <Select
                value={rgForm.resultado}
                onValueChange={(value) =>
                  setRgForm((prev) => ({ ...prev, resultado: value }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar resultado" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_DETAIL_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className="text-xs font-medium">Observación</Label>
              <Textarea
                placeholder="Observaciones de la R.G..."
                className="min-h-[96px] resize-none text-sm"
                value={rgForm.memo}
                onChange={(e) => setRgForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </div>
          </div>

          {rgError ? <p className="text-sm text-destructive">{rgError}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRgModalOpen(false)}
              disabled={rgSaving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddRg} disabled={rgSaving}>
              {rgSaving
                ? "Guardando..."
                : editingRgId
                  ? "Actualizar R.G."
                  : "Guardar R.G."}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditLeadModal
        lead={effectiveLead}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSave}
      />
    </aside>
  );
}
