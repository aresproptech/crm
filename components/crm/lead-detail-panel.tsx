"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  X,
  Phone,
  MapPin,
  Calendar,
  User,
  Tag,
  Circle,
  Pencil,
  MessageSquare,
  Send,
  Clock,
  Hash,
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
  PHASE_COLORS,
  PHASE_OPTIONS,
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  AGENT_OPTIONS,
} from "@/lib/crm-data";

const STATUS_CONFIG = {
  identificar: { label: "Identificar", className: "bg-violet-50 text-violet-700 border-violet-200" },
  seguimiento: { label: "Seguimiento", className: "bg-blue-50 text-blue-700 border-blue-200" },
  caliente: { label: "Caliente", className: "bg-orange-50 text-orange-700 border-orange-200" },
  desestimada: { label: "Desestimada", className: "bg-muted text-muted-foreground border-border" },
} as const;

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

function IconRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
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
  createdAt: string; // ISO
  createdBy: string;
  noteText?: string;
};

const CURRENT_USER = "Ana Martínez";

function normalizeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function statusLabel(value: string) {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
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
    default:
      return String(field);
  }
}

function formatFieldValue(field: keyof Lead, value: string) {
  if (!value) return "—";
  if (field === "status") return statusLabel(value);
  if (field === "phase") return phaseLabel(value);
  if (field === "fechaNoticia" || field === "fechaValoracion") return fmtShort(value);
  return value;
}

// ─── CP lookup via API ────────────────────────────────────────────────────────

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

// ─── Edit Modal ──────────────────────────────────────────────────────────────

interface EditLeadModalProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (next: Lead) => void;
}

function EditLeadModal({ lead, open, onOpenChange, onSave }: EditLeadModalProps) {
  const [form, setForm] = useState({ ...lead });
  const [cpLoading, setCpLoading] = useState(false);
  const [cpAutoFilled, setCpAutoFilled] = useState(false);

  useEffect(() => {
    setForm({ ...lead });
    setCpAutoFilled(false);
  }, [lead]);

  function set(field: keyof Lead, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
    // Keep cpAutoFilled true — user can still edit distrito freely
  }

  function handleSave() {
    onSave(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Editar lead</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Actualiza la información del lead. Los cambios se guardarán automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 py-2">
          {/* Propietario */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Propietario</Label>
            <Input
              value={form.ownerName}
              onChange={(e) => set("ownerName", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Domicilio */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Domicilio</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* CP */}
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

          {/* Municipio */}
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
              className={cn("h-8 text-sm", cpAutoFilled && "border-primary/40 bg-primary/5")}
              placeholder="Ej. Madrid"
            />
          </div>

          {/* Distrito */}
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
              className={cn("h-8 text-sm", cpAutoFilled && "border-primary/40 bg-primary/5")}
              placeholder="Ej. Salamanca"
            />
          </div>

          {/* Provincia */}
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
              className={cn("h-8 text-sm", cpAutoFilled && "border-primary/40 bg-primary/5")}
              placeholder="Ej. Madrid"
            />
          </div>

          {/* Valor */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Valor estimado</Label>
            <Input
              value={form.valor}
              onChange={(e) => set("valor", e.target.value)}
              className="h-8 text-sm"
              placeholder="ej. 350.000 €"
            />
          </div>

          {/* Teléfono */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Teléfono</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Fase */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fase</Label>
            <Select value={form.phase} onValueChange={(v) => set("phase", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Estado</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origen */}
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

          {/* Owner */}
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

          {/* Fecha Noticia */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fecha noticia</Label>
            <Input
              type="date"
              value={form.fechaNoticia}
              onChange={(e) => set("fechaNoticia", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Fecha Contacto */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fecha contacto</Label>
            <Input
              type="date"
              value={form.fechaContacto}
              onChange={(e) => set("fechaContacto", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Fecha Valoración */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Fecha valoración</Label>
            <Input
              type="date"
              value={form.fechaValoracion}
              onChange={(e) => set("fechaValoracion", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Hora */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Hora visita</Label>
            <Input
              type="time"
              value={form.hora}
              onChange={(e) => set("hora", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Planner */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Planner</Label>
            <Input
              value={form.planner ?? ""}
              onChange={(e) => set("planner", e.target.value)}
              className="h-8 text-sm"
              placeholder="—"
            />
          </div>

          {/* Notas */}
          <div className="col-span-2 flex flex-col gap-1.5">
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
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function LeadDetailPanel({ lead, onClose }: LeadDetailPanelProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [obsText, setObsText] = useState("");
  const [localObsByLead, setLocalObsByLead] = useState<Record<string, Observacion[]>>(
    {}
  );
  const [historyByLead, setHistoryByLead] = useState<Record<string, LeadHistoryEvent[]>>(
    {}
  );
  const [overridesByLead, setOverridesByLead] = useState<Record<string, Partial<Lead>>>(
    {}
  );

  const effectiveLead = useMemo(() => {
    if (!lead) return null;
    const override = overridesByLead[lead.id];
    return override ? ({ ...lead, ...override } as Lead) : lead;
  }, [lead, overridesByLead]);

  // Merge mock observaciones + locally added ones
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
      createdBy: CURRENT_USER,
      noteText: o.text,
    }));
    const fieldEvents = historyByLead[effectiveLead.id] ?? [];
    return [...fieldEvents, ...noteEvents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [effectiveLead, allObs, historyByLead]);

  function addObservacion() {
    const trimmed = obsText.trim();
    if (!trimmed) return;
    const newObs: Observacion = {
      id: `local-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      text: trimmed,
    };
    if (!effectiveLead) return;
    setLocalObsByLead((prev) => ({
      ...prev,
      [effectiveLead.id]: [newObs, ...(prev[effectiveLead.id] ?? [])],
    }));
    setObsText("");
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
        createdBy: CURRENT_USER,
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
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/10 transition-opacity duration-200",
          lead ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-border bg-card shadow-xl transition-transform duration-200 ease-in-out",
          lead ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Detalle del lead"
      >
        {effectiveLead && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-3">
                <h2 className="text-sm font-semibold text-foreground leading-tight truncate">
                  {effectiveLead.ownerName}
                </h2>
                <p className="text-xs text-muted-foreground truncate">{effectiveLead.address}</p>
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

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-3">
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", STATUS_CONFIG[effectiveLead.status].className)}
              >
                <Circle className="mr-1 h-1.5 w-1.5 fill-current" />
                {STATUS_CONFIG[effectiveLead.status].label}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs font-medium"
                style={{
                  borderColor: PHASE_COLORS[effectiveLead.phase] + "55",
                  color: PHASE_COLORS[effectiveLead.phase],
                }}
              >
                {PHASE_LABELS[effectiveLead.phase]}
              </Badge>
              <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
                {effectiveLead.source}
              </Badge>
            </div>

            {/* Scrollable body */}
            <div className="flex flex-1 flex-col gap-0 overflow-y-auto divide-y divide-border">
              {/* Core fields */}
              <div className="flex flex-col gap-3.5 px-5 py-5">
                <IconRow icon={Phone}>
                  <Row label="Teléfono">{effectiveLead.phone}</Row>
                </IconRow>
                <IconRow icon={MapPin}>
                  <Row label="Domicilio">
                    {effectiveLead.address}{effectiveLead.distrito ? `, ${effectiveLead.distrito}` : ""}{effectiveLead.cp ? ` (${effectiveLead.cp})` : ""}
                  </Row>
                </IconRow>
                <IconRow icon={Euro}>
                  <Row label="Valor estimado">{effectiveLead.valor || "—"}</Row>
                </IconRow>
                <IconRow icon={User}>
                  <Row label="Owner / Agente">{effectiveLead.owner}</Row>
                </IconRow>
                <IconRow icon={Tag}>
                  <Row label="Origen">{effectiveLead.source}</Row>
                </IconRow>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3 px-5 py-5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">F. Noticia</span>
                  <span className="text-xs text-foreground">{fmtDate(effectiveLead.fechaNoticia)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">F. Contacto</span>
                  <span className="text-xs text-foreground">{fmtDate(effectiveLead.fechaContacto)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">F. Valoración</span>
                  <span className="text-xs text-foreground">{fmtDate(effectiveLead.fechaValoracion)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hora visita</span>
                  <span className="text-xs text-foreground">{effectiveLead.hora || "—"}</span>
                </div>
              </div>

              {/* Notas */}
              {effectiveLead.notes && (
                <div className="flex flex-col gap-1.5 px-5 py-5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Notas
                  </span>
                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground leading-relaxed">
                    {effectiveLead.notes}
                  </p>
                </div>
              )}

              {/* ── Observaciones ── */}
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

                {/* New observation input */}
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    placeholder="Escribe una observación..."
                    className="text-sm min-h-[68px] resize-none bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        addObservacion();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="self-end h-7 gap-1.5 text-xs"
                    disabled={!obsText.trim()}
                    onClick={addObservacion}
                  >
                    <Send className="h-3 w-3" />
                    Añadir
                  </Button>
                </div>

                {/* Timeline */}
                {allHistory.length > 0 ? (
                  <div className="flex flex-col gap-0 relative">
                    {/* Vertical line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
                    {allHistory.map((ev) => (
                      <div key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {/* Dot */}
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

            {/* Footer */}
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
          onSave={(next) => {
            appendFieldChangeEvents(effectiveLead, next);
            setOverridesByLead((prev) => ({ ...prev, [next.id]: { ...next } }));
          }}
        />
      )}
    </>
  );
}
