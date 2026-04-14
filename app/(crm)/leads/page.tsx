"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import {
  NewLeadModal,
  type NewLeadFormData,
} from "@/components/crm/new-lead-modal";
import { LeadDetailPanel } from "@/components/crm/lead-detail-panel";
import { ImportLeadsCsvModal } from "@/components/crm/import-leads-csv-modal";
import {
  Plus,
  Circle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Trash2,
  Search,
  LayoutGrid,
  Table2,
  Phone,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Lead, PHASE_LABELS, PHASE_COLORS } from "@/lib/crm-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SortKey = keyof Lead;
type SortDir = "asc" | "desc";
type LeadsViewMode = "table" | "kanban";

type CrmLeadRow = {
  id: number;
  created_at: string | null;
  fecha: string | null;
  propietario: string | null;
  telefono: string | null;
  domicilio: string | null;
  tasacion: string | null;
  estado: string | null;
  memo: string | null;
  en_venta: string | null;
  fase_id: number | null;
  fase_name: string | null;
  source_id: number | null;
  source_name: string | null;
  comercial_user_id: number | null;
  comercial_name: string | null;
  contact_user_id: number | null;
  contact_name: string | null;
  postal_id: number | null;
  cp: number | null;
  provincia: string | null;
  distrito: string | null;
  team_id: number | null;
  dominio_desc: string | null;
};

const KANBAN_PHASES: Lead["phase"][] = [
  "noticia",
  "concertada",
  "valorada",
  "cualificada",
  "encargo",
  "vender",
];

const PHASE_ID_MAP: Record<Lead["phase"], number> = {
  noticia: 1,
  concertada: 2,
  valorada: 3,
  cualificada: 4,
  encargo: 5,
  vender: 6,
};

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
}) {
  if (sortKey !== col) {
    return (
      <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/40" />
    );
  }

  return sortDir === "asc" ? (
    <ChevronUp className="h-3 w-3 shrink-0 text-primary" />
  ) : (
    <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
  );
}

function getValue(lead: Lead, key: SortKey): string | number {
  const v = lead[key];
  if (v === undefined || v === null || v === "") return "";

  if (
    ["fechaNoticia", "fechaContacto", "fechaValoracion"].includes(
      key as string
    )
  ) {
    return v as string;
  }

  if (key === "valor") {
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  return String(v).toLowerCase();
}

const STATUS_CONFIG = {
  identificar: { label: "Identificar", dot: "bg-violet-500" },
  seguimiento: { label: "Seguimiento", dot: "bg-blue-500" },
  caliente: { label: "Caliente", dot: "bg-orange-500" },
  desestimada: { label: "Desestimada", dot: "bg-muted-foreground" },
} as const;

function fmt(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function normalizePhase(raw: string | null | undefined): Lead["phase"] {
  const value = (raw || "").toLowerCase().trim();

  if (value.includes("noticia")) return "noticia";
  if (value.includes("concertada")) return "concertada";
  if (value.includes("valorada")) return "valorada";
  if (value.includes("cualificada")) return "cualificada";
  if (value.includes("encargo")) return "encargo";
  if (value.includes("vendida") || value.includes("vender")) return "vender";

  return "noticia";
}

function normalizeStatus(raw: string | null | undefined): Lead["status"] {
  const value = (raw || "").toLowerCase().trim();

  if (value === "identificar" || value === "identificada") return "identificar";
  if (value === "seguimiento") return "seguimiento";
  if (value === "caliente") return "caliente";
  if (value === "desestimada") return "desestimada";

  return "seguimiento";
}

function normalizeValor(raw: string | null | undefined) {
  if (!raw) return "—";
  return raw;
}

function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  // Si ya está en formato yyyy-MM-dd lo devolvemos tal cual
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // Intentamos parsear formatos como "11-Sep-25" o "2025-09-11T..."
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function mapCrmLeadToLead(row: CrmLeadRow): Lead {
  const ownerLabel =
    row.comercial_name?.trim() ||
    row.contact_name?.trim() ||
    "Sin asignar";

  const domicilio = row.domicilio?.trim() || "—";
  const distrito = row.distrito?.trim() || "—";
  const provincia = row.provincia?.trim() || "—";
  const cp = row.cp ? String(row.cp) : "—";

  return {
    id: String(row.id),
    ownerName: row.propietario?.trim() || "—",
    address: domicilio,
    distrito,
    municipio: distrito,
    provincia,
    cp,
    valor: normalizeValor(row.tasacion),
    phone: row.telefono?.trim() || "—",
    source: row.source_name?.trim() || "Sin origen",
    phase: normalizePhase(row.fase_name),
    status: normalizeStatus(row.estado),
    fechaNoticia: normalizeDate(row.fecha || row.created_at || ""),
    fechaContacto: "",
    fechaValoracion: "",
    hora: "",
    planner: row.dominio_desc?.trim() || "—",
    owner: ownerLabel,
    createdAt: row.created_at || "",
    assignedUser: ownerLabel,
    propertyAddress:
      domicilio !== "—"
        ? `${domicilio}, ${distrito !== "—" ? distrito : provincia}`
        : "—",
    notes: row.memo?.trim() || "",
    observaciones: [],
  };
}

function KanbanLeadCard({
  lead,
  onClick,
}: {
  lead: Lead;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: "lead",
      leadId: lead.id,
      phase: lead.phase,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/30 hover:bg-accent/40",
        isDragging && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {lead.ownerName}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{lead.address}</span>
          </div>
        </div>

        <span
          className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: PHASE_COLORS[lead.phase] + "1a",
            color: PHASE_COLORS[lead.phase],
          }}
        >
          {PHASE_LABELS[lead.phase]}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">Origen</span>
          <span className="truncate font-medium text-foreground">{lead.source}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span>Estado</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                STATUS_CONFIG[lead.status].dot
              )}
            />
            {STATUS_CONFIG[lead.status].label}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span>Valor</span>
          <span className="font-medium text-foreground">{lead.valor}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span>Fecha</span>
          <span className="font-medium text-foreground">{fmt(lead.fechaNoticia)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-[11px]">
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{lead.phone}</span>
        </div>
        <span className="truncate text-muted-foreground">{lead.owner}</span>
      </div>
    </button>
  );
}

function KanbanColumn({
  phase,
  leads,
  onOpenLead,
}: {
  phase: Lead["phase"];
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: phase,
  });

  return (
    <div className="flex min-h-[500px] w-[320px] shrink-0 flex-col rounded-2xl border border-border bg-muted/30">
      <div className="sticky top-0 z-10 rounded-t-2xl border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PHASE_COLORS[phase] }}
            />
            <span className="truncate text-sm font-semibold text-foreground">
              {PHASE_LABELS[phase]}
            </span>
          </div>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-foreground">
            {leads.length}
          </span>
        </div>
      </div>

      <SortableContext
        items={leads.map((lead) => lead.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 space-y-3 overflow-y-auto p-3 transition-colors",
            isOver && "rounded-b-2xl bg-primary/5"
          )}
        >
          {leads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
              Sin leads en esta fase
            </div>
          ) : (
            leads.map((lead) => (
              <KanbanLeadCard
                key={lead.id}
                lead={lead}
                onClick={() => onOpenLead(lead)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function LeadsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<LeadsViewMode>("table");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  async function handleKanbanDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = String(active.id);
    const overId = String(over.id);

    const activeLead = leads.find((lead) => lead.id === activeLeadId);
    if (!activeLead) return;

    let targetPhase: Lead["phase"] | null = null;

    if (
      overId === "noticia" ||
      overId === "concertada" ||
      overId === "valorada" ||
      overId === "cualificada" ||
      overId === "encargo" ||
      overId === "vender"
    ) {
      targetPhase = overId;
    } else {
      const targetLead = leads.find((lead) => lead.id === overId);
      if (targetLead) targetPhase = targetLead.phase;
    }

    if (!targetPhase || activeLead.phase === targetPhase) return;

    // Actualizamos UI inmediatamente (optimistic update)
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === activeLeadId ? { ...lead, phase: targetPhase! } : lead
      )
    );

    // Persistimos en Supabase
    const { error } = await supabase
      .from("opportunities")
      .update({ fase_id: PHASE_ID_MAP[targetPhase] })
      .eq("id", Number(activeLeadId));

    if (error) {
      console.error("Error actualizando fase en Supabase:", error);
      // Revertimos el cambio en UI si falla
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === activeLeadId ? { ...lead, phase: activeLead.phase } : lead
        )
      );
    }
  }

  async function loadLeadsFromSupabase() {
    setLoadingLeads(true);

    const { data, error } = await supabase
      .from("crm_leads_view")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase leads error:", error);
      setLoadingLeads(false);
      return;
    }

    const mapped = (data ?? []).map((row) => mapCrmLeadToLead(row as CrmLeadRow));
    setLeads(mapped);
    setLoadingLeads(false);
  }

  async function handleImportCsv(importedLeads: Lead[]) {
    if (importedLeads.length === 0) return;

    const rowsToInsert = importedLeads.map((lead) => ({
      propietario: lead.ownerName || null,
      domicilio: lead.address || null,
      telefono: lead.phone || null,
      tasacion: lead.valor || null,
      estado: lead.status || null,
      fecha: lead.fechaNoticia || null,
      source_desc: lead.source || null,
      comercial_user_desc: lead.owner || null,
      dominio_desc: lead.planner || null,
      postal_id: null,
      fase_id: null,
      created_at: new Date().toISOString(),
      memo: lead.notes || null,
      en_venta: null,
      contact_user_desc: null,
      source_id: null,
      comercial_user_id: null,
      contact_user_id: null,
      team_id: null,
      deleted_at: null,
    }));

    const { error } = await supabase.from("opportunities").insert(rowsToInsert);

    if (error) {
      console.error("Error importing CSV to Supabase:", error);
      return;
    }

    await loadLeadsFromSupabase();
  }

  async function handleCreateLead(form: NewLeadFormData) {
    const rowsToInsert = [
      {
        propietario: form.ownerName || null,
        domicilio: form.address || null,
        telefono: form.phone || null,
        tasacion: form.valor || null,
        estado: form.status || null,
        fecha: form.fechaNoticia || null,
        source_desc: form.source || null,
        comercial_user_desc: form.owner || null,
        dominio_desc: form.distrito || null,
        postal_id: form.cp && !isNaN(Number(form.cp)) ? Number(form.cp) : null,
        fase_id: PHASE_ID_MAP[form.phase as Lead["phase"]] ?? 1,
        created_at: new Date().toISOString(),
        memo: form.notes || null,
        en_venta: null,
        contact_user_desc: null,
        source_id: null,
        comercial_user_id: null,
        contact_user_id: null,
        team_id: null,
        deleted_at: null,
      },
    ];

    const { error } = await supabase.from("opportunities").insert(rowsToInsert);

    if (error) {
      console.error("Error creating lead in Supabase:", error);
      return;
    }

    await loadLeadsFromSupabase();
  }

  async function handleSaveLead(next: Lead) {
    const { error } = await supabase
      .from("opportunities")
      .update({
        propietario: next.ownerName || null,
        domicilio: next.address || null,
        telefono: next.phone || null,
        tasacion: next.valor || null,
        estado: next.status || null,
        fecha: next.fechaNoticia ? next.fechaNoticia.slice(0, 10) : null,
        source_desc: next.source || null,
        comercial_user_desc: next.owner || null,
        dominio_desc: next.planner || null,
        memo: next.notes || null,
        fase_id: PHASE_ID_MAP[next.phase] ?? 1,
      })
      .eq("id", Number(next.id));

    if (error) {
      console.error("Error actualizando lead:", error);
      return;
    }

    await loadLeadsFromSupabase();
    setSelectedLead((prev) =>
      prev && prev.id === next.id ? { ...prev, ...next } : prev
    );
  }

  useEffect(() => {
    loadLeadsFromSupabase();
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filteredLeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return leads;

    return leads.filter((lead) =>
      [
        lead.ownerName,
        lead.address,
        lead.distrito,
        lead.cp,
        lead.phone,
        lead.source,
        lead.owner,
        PHASE_LABELS[lead.phase],
        STATUS_CONFIG[lead.status].label,
        lead.valor,
        lead.hora ?? "",
        lead.fechaNoticia ?? "",
        lead.fechaContacto ?? "",
        lead.fechaValoracion ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [leads, searchTerm]);

  const sortedLeads = useMemo(() => {
    if (!sortKey) return filteredLeads;

    return [...filteredLeads].sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);

      if (av === "" && bv !== "") return 1;
      if (bv === "" && av !== "") return -1;

      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredLeads, sortKey, sortDir]);

  const kanbanGroups = useMemo(() => {
    return KANBAN_PHASES.map((phase) => ({
      phase,
      leads: filteredLeads.filter((lead) => lead.phase === phase),
    }));
  }, [filteredLeads]);

  const visibleSelectedCount = useMemo(
    () => sortedLeads.filter((l) => selectedIds.has(l.id)).length,
    [sortedLeads, selectedIds]
  );

  const allVisibleSelected =
    sortedLeads.length > 0 && visibleSelectedCount === sortedLeads.length;

  function toggleRowSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const lead of sortedLeads) next.add(lead.id);
      } else {
        for (const lead of sortedLeads) next.delete(lead.id);
      }
      return next;
    });
  }

  async function handleConfirmDelete() {
    const idsToDelete = Array.from(selectedIds).map((id) => Number(id));

    const { error } = await supabase
      .from("opportunities")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", idsToDelete);

    if (error) {
      console.error("Error soft deleting leads:", error);
      return;
    }

    setLeads((prev) => prev.filter((lead) => !selectedIds.has(lead.id)));

    if (selectedLead && selectedIds.has(selectedLead.id)) {
      setSelectedLead(null);
    }

    setSelectedIds(new Set());
    setConfirmOpen(false);
  }

  return (
    <>
      <Topbar title="Leads" onCreateLead={() => setModalOpen(true)} />

      <main className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {viewMode === "table" ? sortedLeads.length : filteredLeads.length} leads en total
            </span>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar leads..."
                className="h-8 w-[260px] rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
                Tabla
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("kanban");
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  viewMode === "kanban"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs font-semibold"
              onClick={() => setImportOpen(true)}
            >
              Importar CSV
            </Button>

            {viewMode === "table" && (
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs font-semibold"
                onClick={() => {
                  if (selectionMode) {
                    setSelectionMode(false);
                    setSelectedIds(new Set());
                  } else {
                    setSelectionMode(true);
                  }
                }}
              >
                {selectionMode ? "Cancelar selección" : "Seleccionar"}
              </Button>
            )}

            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs font-semibold"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo lead
            </Button>
          </div>
        </div>

        {viewMode === "table" && selectionMode && selectedIds.size > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/60 px-6 py-2 text-[11px]">
            <span className="text-muted-foreground">
              {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} seleccionados
            </span>

            <Button
              size="sm"
              variant="destructive"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar seleccionados
            </Button>
          </div>
        )}

        {loadingLeads && (
          <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
            Cargando leads desde Supabase...
          </div>
        )}

        {viewMode === "table" ? (
          <div className="relative flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 1500 }}>
              <thead className="sticky top-0 z-20 bg-card">
                <tr className="border-b border-border bg-card/95 text-left backdrop-blur">
                  {selectionMode && (
                    <th className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border text-primary"
                        aria-label="Seleccionar todos"
                      />
                    </th>
                  )}

                  {(
                    [
                      { label: "Propietario", key: "ownerName" },
                      { label: "Domicilio", key: "address" },
                      { label: "Distrito", key: "distrito" },
                      { label: "CP", key: "cp" },
                      { label: "Valor", key: "valor" },
                      { label: "Teléfono", key: "phone" },
                      { label: "Origen", key: "source" },
                      { label: "Fase", key: "phase" },
                      { label: "Estado", key: "status" },
                      { label: "F. Noticia", key: "fechaNoticia" },
                      { label: "F. Contacto", key: "fechaContacto" },
                      { label: "F. Valoración", key: "fechaValoracion" },
                      { label: "Hora", key: "hora" },
                      { label: "Planner", key: "planner" },
                      { label: "Owner", key: "owner" },
                    ] as { label: string; key: SortKey }[]
                  ).map(({ label, key }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="group cursor-pointer select-none whitespace-nowrap px-3 py-2.5"
                    >
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors group-hover:text-foreground">
                        {label}
                        <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="bg-background">
                {sortedLeads.map((lead, i) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors hover:bg-accent/60",
                      selectedLead?.id === lead.id && "bg-accent",
                      i % 2 === 0 ? "bg-card" : "bg-background"
                    )}
                  >
                    {selectionMode && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRowSelection(lead.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 rounded border-border text-primary"
                          aria-label="Seleccionar lead"
                        />
                      </td>
                    )}

                    <td className="px-3 py-2.5">
                      <span className="whitespace-nowrap font-medium text-foreground">
                        {lead.ownerName}
                      </span>
                    </td>

                    <td className="max-w-[180px] truncate whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.address}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.distrito}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.cp}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-foreground">
                      {lead.valor}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.phone}
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
                        {lead.source}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: PHASE_COLORS[lead.phase] + "1a",
                          color: PHASE_COLORS[lead.phase],
                        }}
                      >
                        <Circle className="h-1.5 w-1.5 fill-current" />
                        {PHASE_LABELS[lead.phase]}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            STATUS_CONFIG[lead.status].dot
                          )}
                        />
                        {STATUS_CONFIG[lead.status].label}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {fmt(lead.fechaNoticia)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {fmt(lead.fechaContacto)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {fmt(lead.fechaValoracion)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.hora || "—"}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.planner ?? "—"}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold uppercase text-primary">
                          {lead.owner
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lead.owner}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleKanbanDragEnd}
          >
            <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
              <div className="flex h-full gap-4">
                {kanbanGroups.map(({ phase, leads }) => (
                  <KanbanColumn
                    key={phase}
                    phase={phase}
                    leads={leads}
                    onOpenLead={setSelectedLead}
                  />
                ))}
              </div>
            </div>
          </DndContext>
        )}
      </main>

      <NewLeadModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleCreateLead}
      />

      <ImportLeadsCsvModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImportCsv}
      />

      <LeadDetailPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onSaveLead={handleSaveLead}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar leads seleccionados</DialogTitle>
            <DialogDescription>
              Esta acción eliminará {selectedIds.size} lead
              {selectedIds.size !== 1 ? "s" : ""} y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}