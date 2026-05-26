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

type HistoryEventType = "note" | "field_change";

type LeadHistoryEvent = {
  id: string;
  leadId: string;
  type: HistoryEventType;
  field?: keyof Lead;
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

const LEAD_DETAIL_MEDIO_OPTIONS = [
  "Presencial",
  "Videollamada",
  "Teléfono",
];

const LEAD_DETAIL_EN_VENTA_OPTIONS = ["SI", "NO", "No Sabe"];

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

function fieldDisplayName(field: keyof Lead): string {
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
    default:
      return String(field);
  }
}

function formatFieldValue(field: keyof Lead, value: string) {
  if (!value) return "—";
  if (field === "status") return statusLabel(value);
  if (field === "phase") return phaseLabel(value);
  if (field === "fechaNoticia" || field === "fechaValoracion")
    return fmtShort(value);
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
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (next: Lead) => Promise<void>;
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

  useEffect(() => {
    setForm({
      ...lead,
      valor: formatEuroValue(lead.valor),
    });
    setCpAutoFilled(false);
  }, [lead]);

  function set(field: keyof Lead, value: string) {
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
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(1100px,calc(100vw-2rem))] max-w-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Editar lead
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Actualiza la información del lead.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 py-2 md:grid-cols-3">
          <div className="flex flex-col gap-1.5 md:col-span-3">
            <Label className="text-xs font-medium">Propietario</Label>
            <Input
              value={form.ownerName}
              onChange={(e) => set("ownerName", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-3">
            <Label className="text-xs font-medium">Domicilio</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">CP</Label>
            <div className="relative">
              <Input
                value={form.cp}
                onChange={(e) => handleCpChange(e.target.value)}
                className="h-8 text-sm font-mono pr-8"
                placeholder="5 dígitos"
                maxLength={5}
                inputMode="numeric"
                disabled={cpLoading}
              />
              {cpLoading && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              Municipio
              {cpAutoFilled && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                  <LocateFixed className="h-2.5 w-2.5" />
                  auto
                </span>
              )}
            </Label>
            <Input
              value={form.municipio}
              onChange={(e) => set("municipio", e.target.value)}
              className={cn(
                "h-8 text-sm",
                cpAutoFilled && "border-primary/40 bg-primary/5"
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              Distrito
              {cpAutoFilled && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                  <LocateFixed className="h-2.5 w-2.5" />
                  auto
                </span>
              )}
            </Label>
            <Input
              value={form.distrito}
              onChange={(e) => handleDistritoChange(e.target.value)}
              className={cn(
                "h-8 text-sm",
                cpAutoFilled && "border-primary/40 bg-primary/5"
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              Provincia
              {cpAutoFilled && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                  <LocateFixed className="h-2.5 w-2.5" />
                  auto
                </span>
              )}
            </Label>
            <Input
              value={form.provincia}
              onChange={(e) => set("provincia", e.target.value)}
              className={cn(
                "h-8 text-sm",
                cpAutoFilled && "border-primary/40 bg-primary/5"
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Valor</Label>
            <Input
              value={form.valor}
              onChange={(e) => handleValorChange(e.target.value)}
              className="h-8 text-sm"
              placeholder="Ej. 450.000 €"
              inputMode="numeric"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Teléfono</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Origen</Label>
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o} className="text-sm">
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Hora</Label>
            <Input
              type="time"
              value={form.hora}
              onChange={(e) => set("hora", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Medio</Label>
            <Select value={form.medio ?? ""} onValueChange={(v) => set("medio", v)}>
              <SelectTrigger className="h-8 text-sm">
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
            <Label className="text-xs font-medium">En Venta</Label>
            <Select value={form.enVenta ?? "No Sabe"} onValueChange={(v) => set("enVenta", v)}>
              <SelectTrigger className="h-8 text-sm">
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fase</Label>
            <Select value={form.phase} onValueChange={(v) => set("phase", v)}>
              <SelectTrigger className="h-8 text-sm">
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Estado</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="h-8 text-sm">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="planner" className="text-xs font-medium">Planner</Label>
            <Select value={form.planner ?? ""} onValueChange={(v) => set("planner", v)}>
              <SelectTrigger id="planner" className="h-8 text-sm">
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
            <Label className="text-xs font-medium">Owner</Label>
            <Select value={form.owner} onValueChange={(v) => set("owner", v)}>
              <SelectTrigger className="h-8 text-sm">
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fecha noticia</Label>
            <Input
              type="date"
              value={form.fechaNoticia}
              onChange={(e) => set("fechaNoticia", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fecha contacto</Label>
            <Input
              type="date"
              value={form.fechaContacto}
              onChange={(e) => set("fechaContacto", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fecha valoración</Label>
            <Input
              type="date"
              value={form.fechaValoracion}
              onChange={(e) => set("fechaValoracion", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Hora</Label>
            <Input
              type="time"
              value={form.hora}
              onChange={(e) => set("hora", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-3">
            <Label className="text-xs font-medium">Notas</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              className="text-sm min-h-[72px] resize-none"
              placeholder="Observaciones generales..."
            />
          </div>
        </div>

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
  const currentUserName = useMemo(() => {
    const userRecord = userWithRole as unknown as {
      name?: string | null;
      user?: string | null;
      email?: string | null;
    } | null;

    return (
      userRecord?.name?.trim() ||
      userRecord?.user?.trim() ||
      userRecord?.email?.trim() ||
      "Usuario"
    );
  }, [userWithRole]);
  const [editOpen, setEditOpen] = useState(false);
  const [obsText, setObsText] = useState("");
  const [obsError, setObsError] = useState<string | null>(null);
  const [obsSaving, setObsSaving] = useState(false);
  const [localObsByLead, setLocalObsByLead] = useState<
    Record<string, Observacion[]>
  >({});
  const [historyByLead, setHistoryByLead] = useState<
    Record<string, LeadHistoryEvent[]>
  >({});
  const [overridesByLead, setOverridesByLead] = useState<Record<string, Partial<Lead>>>({});

// Carga observaciones/gestiones desde opportunity_contacts cuando cambia el lead
useEffect(() => {
  if (!lead) return;

  async function fetchObservations() {
    if (!lead) return;
    const { data, error } = await supabase
      .from("opportunity_contacts")
      .select("id, created_at, fecha, memo, resultado")
      .eq("oportunity_id", Number(lead.id))
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando observaciones:", error);
      return;
    }

    const mapped = ((data ?? []) as OpportunityContactRow[]).map((row) => ({
      id: String(row.id),
      date:
        row.fecha ??
        row.created_at?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      text: row.memo?.trim() || "Sin detalle",
    }));

    // Reemplazamos las observaciones locales con las de Supabase
    setLocalObsByLead((prev) => ({
      ...prev,
      [lead.id]: mapped,
    }));
  }

  void fetchObservations();
}, [lead?.id]);

  const effectiveLead = useMemo(() => {
    if (!lead) return null;
    const override = overridesByLead[lead.id];
    return override ? ({ ...lead, ...override } as Lead) : lead;
  }, [lead, overridesByLead]);

  const allObs: Observacion[] = useMemo(() => {
    if (!effectiveLead) return [];
    const local = localObsByLead[effectiveLead.id] ?? [];
    return [...(effectiveLead.observaciones ?? []), ...local].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [effectiveLead, localObsByLead]);

  const allHistory: LeadHistoryEvent[] = useMemo(() => {
    if (!effectiveLead) return [];
    const noteEvents: LeadHistoryEvent[] = allObs.map((o) => ({
      id: `note-${o.id}`,
      leadId: effectiveLead.id,
      type: "note",
      createdAt: `${o.date || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
      createdBy: currentUserName,
      noteText: o.text,
    }));
    const fieldEvents = historyByLead[effectiveLead.id] ?? [];
    return [...fieldEvents, ...noteEvents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [effectiveLead, allObs, historyByLead, currentUserName]);

  async function addObservacion() {
    const trimmed = obsText.trim();
    if (!trimmed || !effectiveLead || obsSaving) return;

    setObsSaving(true);
    setObsError(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("opportunity_contacts")
        .insert({
          oportunity_id: Number(effectiveLead.id),
          fecha: today,
          memo: trimmed,
        })
        .select("id, created_at, fecha, memo, resultado")
        .single();

      if (error) {
        console.error("Error guardando observación en opportunity_contacts:", error);
        setObsError("No se pudo guardar la observación. Inténtalo de nuevo.");
        return;
      }

      const savedRow = data as OpportunityContactRow;
      const saved: Observacion = {
        id: String(savedRow.id),
        date:
          savedRow.fecha ??
          savedRow.created_at?.slice(0, 10) ??
          new Date().toISOString().slice(0, 10),
        text: savedRow.memo?.trim() || trimmed,
      };

      setLocalObsByLead((prev) => ({
        ...prev,
        [effectiveLead.id]: [saved, ...(prev[effectiveLead.id] ?? [])],
      }));

      setObsText("");
    } finally {
      setObsSaving(false);
    }
  }

  function appendFieldChangeEvents(prev: Lead, next: Lead) {
    const tracked: Array<keyof Lead> = [
      "valor",
      "phase",
      "status",
      "fechaNoticia",
      "fechaValoracion",
      "hora",
      "planner",
      "owner",
      "medio",
      "enVenta",
    ];

    const changes: LeadHistoryEvent[] = [];
    for (const field of tracked) {
      const before = normalizeValue(prev[field]);
      const after = normalizeValue(next[field]);
      if (before === after) continue;

      changes.push({
        id: crypto.randomUUID(),
        leadId: prev.id,
        type: "field_change",
        field,
        prevValue: before,
        newValue: after,
        createdAt: new Date().toISOString(),
        createdBy: currentUserName,
      });
    }

    if (changes.length === 0) return;

    setHistoryByLead((prevMap) => ({
      ...prevMap,
      [prev.id]: [...changes, ...(prevMap[prev.id] ?? [])],
    }));
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/10 transition-opacity duration-200",
          lead ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[520px] max-w-[calc(100vw-1rem)] flex-col border-l border-border bg-card shadow-xl transition-transform duration-200 ease-in-out",
          lead ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Detalle del lead"
      >
        {effectiveLead && (
          <>
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-3">
                <h2 className="truncate text-base font-semibold leading-tight text-foreground">
                  {effectiveLead.ownerName}
                </h2>
                <p className="text-xs text-muted-foreground truncate">
                  {effectiveLead.address}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs font-medium"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onClose}
                  aria-label="Cerrar panel"
                >
                  <X className="h-4 w-4" />
                </Button>
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
              <Badge
                variant="outline"
                className="h-7 rounded-md px-3 text-sm font-semibold text-muted-foreground"
              >
                {effectiveLead.source}
              </Badge>
            </div>

            <div className="flex flex-1 flex-col gap-0 overflow-y-auto divide-y divide-border">
              <div className="px-5 py-5">
                <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                  <div className="col-span-2 rounded-lg border border-border bg-background/60 p-3">
                    <IconRow icon={MapPin}>
                      <Row label="Domicilio">
                        {effectiveLead.address}
                        {effectiveLead.distrito ? `, ${effectiveLead.distrito}` : ""}
                        {effectiveLead.cp ? ` (${effectiveLead.cp})` : ""}
                      </Row>
                    </IconRow>
                  </div>

                  <IconRow icon={Phone}>
                    <Row label="Teléfono">{effectiveLead.phone || "—"}</Row>
                  </IconRow>

                  <IconRow icon={Euro}>
                    <Row label="Valor">{formatEuroValue(effectiveLead.valor) || "—"}</Row>
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
                    <Row label="En Venta">{effectiveLead.enVenta || "No Sabe"}</Row>
                  </IconRow>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 px-5 py-5">
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-background/60 p-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    F. Noticia
                  </span>
                  <span className="text-xs text-foreground">
                    {fmtDate(effectiveLead.fechaNoticia)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-background/60 p-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    F. Contacto
                  </span>
                  <span className="text-xs text-foreground">
                    {fmtDate(effectiveLead.fechaContacto)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-background/60 p-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    F. Valoración
                  </span>
                  <span className="text-xs text-foreground">
                    {fmtDate(effectiveLead.fechaValoracion)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-background/60 p-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Hora
                  </span>
                  <span className="text-xs text-foreground">
                    {effectiveLead.hora || "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-background/60 p-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Medio
                  </span>
                  <span className="text-xs text-foreground">
                    {effectiveLead.medio || "—"}
                  </span>
                </div>
              </div>

              {effectiveLead.notes && (
                <div className="flex flex-col gap-2 px-5 py-5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Notas
                  </span>
                  <p className="rounded-lg border border-border bg-background/60 px-3 py-3 text-sm leading-relaxed text-foreground">
                    {effectiveLead.notes}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-4 px-5 py-5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Observaciones
                  </span>
                  {allObs.length > 0 && (
                    <span className="ml-auto flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                      {allObs.length}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Textarea
                    value={obsText}
                    onChange={(e) => {
                      setObsText(e.target.value);
                      if (obsError) setObsError(null);
                    }}
                    placeholder="Escribe una observación..."
                    className="min-h-[88px] resize-none bg-background text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void addObservacion();
                      }
                    }}
                  />

                  {obsError && (
                    <p className="text-xs text-destructive">{obsError}</p>
                  )}

                  <Button
                    size="sm"
                    className="self-end h-7 gap-1.5 text-xs"
                    disabled={!obsText.trim() || obsSaving}
                    onClick={() => void addObservacion()}
                  >
                    {obsSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    {obsSaving ? "Guardando..." : "Añadir"}
                  </Button>
                </div>

                {allHistory.length > 0 ? (
                  <div className="flex flex-col gap-0 relative">
                    <div
                      className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
                      aria-hidden="true"
                    />
                    {allHistory.map((ev) => (
                      <div key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                        <div
                          className={cn(
                            "relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-card",
                            ev.type === "field_change"
                              ? "border-muted-foreground/30"
                              : "border-primary/30"
                          )}
                        />
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <time className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                              {fmtShort(ev.createdAt)}
                            </time>
                          </div>
                          {ev.type === "note" ? (
                            <p className="text-sm text-foreground leading-relaxed rounded-md border border-border bg-muted/30 px-3 py-2">
                              {ev.noteText}
                            </p>
                          ) : (
                            <p className="text-sm text-foreground leading-relaxed rounded-md border border-border bg-background px-3 py-2">
                              <span className="font-medium">{ev.createdBy}</span>{" "}
                              cambió{" "}
                              <span className="font-medium">
                                {fieldDisplayName(ev.field as keyof Lead)}
                              </span>{" "}
                              de{" "}
                              <span className="font-medium">
                                {formatFieldValue(
                                  ev.field as keyof Lead,
                                  ev.prevValue ?? ""
                                )}
                              </span>{" "}
                              a{" "}
                              <span className="font-medium">
                                {formatFieldValue(
                                  ev.field as keyof Lead,
                                  ev.newValue ?? ""
                                )}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Sin observaciones todavía.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-border px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-medium"
                onClick={onClose}
              >
                Cerrar
              </Button>
            </div>
          </>
        )}
      </aside>

      {effectiveLead && (
        <EditLeadModal
          lead={effectiveLead}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSave={async (next) => {
            appendFieldChangeEvents(effectiveLead, next);
            await onSaveLead(next);
            setOverridesByLead((prev) => ({ ...prev, [next.id]: { ...next } }));
          }}
        />
      )}
    </>
  );
}