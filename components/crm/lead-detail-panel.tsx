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
  identificar: {
    label: "Identificada",
    badgeStyle: {
      backgroundColor: "#EEF2FF",
      color: "#4338CA",
      borderColor: "#C7D2FE",
    },
  },
  cualificada: {
    label: "Cualificada",
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

type OpportunityContactRow = {
  id: number | string;
  created_at?: string | null;
  fecha?: string | null;
  memo?: string | null;
  resultado?: boolean | null;
};

const LEAD_DETAIL_PHASE_OPTIONS = PHASE_OPTIONS.filter((opt) =>
  ["Noticia", "Concertada", "Valorada", "Encargo"].includes(opt.label)
);

const LEAD_DETAIL_STATUS_OPTIONS = [
  { value: "identificar", label: "Identificada" },
  { value: "cualificada", label: "Cualificada" },
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
  noticia: {
    backgroundColor: "#D4EDBC",
    color: "#298259",
    borderColor: "#B7D99C",
  },
  concertada: {
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

function getStatusConfig(status: string) {
  if (status === "seguimiento") return STATUS_CONFIG.cualificada;

  return (
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.identificar
  );
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

  useEffect(() => {
    setForm({
      ...lead,
      valor: formatEuroValue(lead.valor),
    });
    setCpAutoFilled(false);
    setSaveError(null);
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
      <DialogContent className="w-[calc(100vw-3rem)] max-w-none sm:max-w-[1180px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Editar lead
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Actualiza la información del lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
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

          <section className="space-y-3">
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

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del inmueble
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-1.5 md:col-span-4">
                <Label className="text-xs font-medium">Domicilio</Label>
                <Input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

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

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Seguimiento y valoración
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Fecha contacto</Label>
                <Input
                  type="date"
                  value={form.fechaContacto}
                  onChange={(e) => set("fechaContacto", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Fecha valoración</Label>
                <Input
                  type="date"
                  value={form.fechaValoracion}
                  onChange={(e) => set("fechaValoracion", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Hora</Label>
                <Input
                  type="time"
                  value={form.hora}
                  onChange={(e) => set("hora", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Medio</Label>
                <Select
                  value={form.medio ?? ""}
                  onValueChange={(v) => set("medio", v)}
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
          </section>

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

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notas
            </h3>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              className="min-h-[84px] resize-none text-sm"
              placeholder="Observaciones generales..."
            />
          </section>
        </div>

        {saveError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
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
  const [historyEvents, setHistoryEvents] = useState<LeadHistoryEvent[]>([]);
  const [localLead, setLocalLead] = useState<LeadWithDominio | null>(lead as LeadWithDominio | null);

  useEffect(() => {
    setLocalLead(lead as LeadWithDominio | null);
    setNoteError(null);
  }, [lead]);

  const effectiveLead = localLead;

  const currentUserName = useMemo(() => {
    const rawUser = userWithRole as Record<string, unknown> | null | undefined;
    const raw =
      stringFromUnknown(rawUser?.full_name) ||
      stringFromUnknown(rawUser?.display_name) ||
      stringFromUnknown(rawUser?.name) ||
      stringFromUnknown(rawUser?.nombre) ||
      stringFromUnknown(rawUser?.email) ||
      "Usuario";

    return cleanUserDisplayName(raw);
  }, [userWithRole]);

  async function loadObservations(leadId: string) {
    const { data, error } = await supabase
      .from("opportunity_contacts")
      .select("id, created_at, fecha, memo, resultado")
      .eq("opportunity_id", Number(leadId))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando observaciones:", error);
      setHistoryEvents([]);
      setNoteError(`No se pudieron cargar las observaciones: ${error.message}`);
      return;
    }

    const events: LeadHistoryEvent[] = ((data ?? []) as OpportunityContactRow[])
      .filter((row) => Boolean(row.memo?.trim()))
      .map((row) => ({
        id: String(row.id),
        leadId,
        type: "note",
        createdAt: row.created_at || toHistoryCreatedAt(row.fecha || ""),
        createdBy: currentUserName || "Usuario",
        noteText: row.memo?.trim() || "",
      }));

    setHistoryEvents(events);
  }

  useEffect(() => {
    if (!lead?.id) {
      setHistoryEvents([]);
      return;
    }

    void loadObservations(lead.id);
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
      setHistoryEvents((prev) => [...changes, ...prev]);
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
        memo: text,
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

  if (!effectiveLead) return null;

  const domicilioParts = [
    effectiveLead.address,
    effectiveLead.municipio,
    effectiveLead.cp && effectiveLead.cp !== "—" ? `(${effectiveLead.cp})` : "",
  ].filter((part) => part && part !== "—");

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-[430px] flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">
            {effectiveLead.ownerName}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {effectiveLead.address || "—"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
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
          className="h-7 rounded-md px-3 text-sm font-semibold text-muted-foreground"
        >
          {effectiveLead.source}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <IconRow icon={MapPin}>
            <Row label="Domicilio">
              {domicilioParts.length > 0 ? domicilioParts.join(", ") : "—"}
            </Row>
          </IconRow>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <IconRow icon={Phone}>
            <Row label="Teléfono">{effectiveLead.phone || "—"}</Row>
          </IconRow>
          <IconRow icon={Euro}>
            <Row label="Valor">{effectiveLead.valor || "—"}</Row>
          </IconRow>
          <IconRow icon={User}>
            <Row label="Owner / Agente">{effectiveLead.owner || "—"}</Row>
          </IconRow>
          <IconRow icon={User}>
            <Row label="Planner">{effectiveLead.planner || "—"}</Row>
          </IconRow>
          <IconRow icon={Tag}>
            <Row label="Origen">{effectiveLead.source || "—"}</Row>
          </IconRow>
          <IconRow icon={Tag}>
            <Row label="En Venta">{effectiveLead.enVenta || "—"}</Row>
          </IconRow>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <Row label="F. Noticia">{fmtDate(effectiveLead.fechaNoticia)}</Row>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <Row label="F. Contacto">{fmtDate(effectiveLead.fechaContacto)}</Row>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <Row label="F. Valoración">
              {fmtDate(effectiveLead.fechaValoracion)}
            </Row>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <Row label="Hora">{effectiveLead.hora || "—"}</Row>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <Row label="Medio">{effectiveLead.medio || "—"}</Row>
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Observaciones
            </div>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {historyEvents.length}
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
            {historyEvents.length === 0 && (
              <p className="text-xs italic text-muted-foreground">
                Sin observaciones todavía.
              </p>
            )}

            {historyEvents.map((event) => (
              <div key={event.id} className="relative border-l border-border pl-4">
                <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-primary bg-background" />
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{fmtDateTimeShort(event.createdAt)}</span>
                  <span>por {event.createdBy}</span>
                </div>
                <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                  {event.type === "field_change" ? (
                    <span>
                      {event.createdBy} cambió {fieldDisplayName(event.field!)} de{" "}
                      {formatFieldValue(event.field!, event.prevValue || "")} a{" "}
                      {formatFieldValue(event.field!, event.newValue || "")}
                    </span>
                  ) : (
                    event.noteText
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <Button variant="outline" className="w-full" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <EditLeadModal
        lead={effectiveLead}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSave}
      />
    </aside>
  );
}