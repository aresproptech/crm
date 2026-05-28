"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import {
  NewLeadModal,
  type NewLeadFormData,
} from "@/components/crm/new-lead-modal";
import { LeadDetailPanel } from "@/components/crm/lead-detail-panel";
import { ImportLeadsCsvModal } from "@/components/crm/import-leads-csv-modal";
import { KanbanBoard } from "@/components/crm/kanban-board";
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
  RefreshCw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { type Lead, PHASE_LABELS, PHASE_COLORS } from "@/lib/crm-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LeadTableRow = Lead & {
  medio: string;
  month: string;
  dominio: string;
  enVenta: string;
};

type SortKey = keyof LeadTableRow;
type SortDir = "asc" | "desc";
type LeadsViewMode = "table" | "kanban";

const LEADS_PAGE_SIZE = 100;

type CrmLeadRow = {
  id: number;
  created_at: string | null;
  fecha: string | null;
  fecha_contacto: string | null;
  fecha_valoracion: string | null;
  hora: string | null;
  is_favorite?: boolean | null;
  propietario: string | null;
  telefono: string | null;
  domicilio: string | null;
  tasacion: string | null;
  estado: string | null;
  memo: string | null;
  en_venta: string | null;
  medio: string | null;
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

const VALID_PHASES: Lead["phase"][] = [
  "noticia",
  "concertada",
  "valorada",
  "encargo",
];

const PHASE_ID_MAP: Partial<Record<Lead["phase"], number>> = {
  noticia: 1,
  concertada: 2,
  valorada: 3,
  encargo: 5,
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

function getValue(lead: LeadTableRow, key: SortKey): string | number {
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

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    dot: string;
    backgroundColor: string;
    color: string;
    borderColor: string;
  }
> = {
  identificar: {
    label: "Identificada",
    dot: "bg-violet-500",
    backgroundColor: "#E5E7EB",
    color: "#374151",
    borderColor: "#D1D5DB",
  },
  cualificada: {
    label: "Cualificada",
    dot: "bg-emerald-500",
    backgroundColor: "#D4EDBC",
    color: "#288158",
    borderColor: "#B7D99C",
  },
  seguimiento: {
    label: "Cualificada",
    dot: "bg-emerald-500",
    backgroundColor: "#D4EDBC",
    color: "#288158",
    borderColor: "#B7D99C",
  },
  caliente: {
    label: "Caliente",
    dot: "bg-orange-500",
    backgroundColor: "#B32400",
    color: "#FFFFFF",
    borderColor: "#B32400",
  },
  desestimada: {
    label: "Desestimada",
    dot: "bg-muted-foreground",
    backgroundColor: "#4B3820",
    color: "#FDE68A",
    borderColor: "#4B3820",
  },
};

function getStatusConfig(status: string | null | undefined) {
  return STATUS_CONFIG[status || "identificar"] ?? STATUS_CONFIG.identificar;
}

const SOURCE_BADGE_STYLES: Record<
  string,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  idealista: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
  papelito: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
  referido: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
  personal: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
  "tasar-online": {
    backgroundColor: "#E6CFF2",
    color: "#6F3FA0",
    borderColor: "#D7B8EA",
  },
  tasaronline: {
    backgroundColor: "#E6CFF2",
    color: "#6F3FA0",
    borderColor: "#D7B8EA",
  },
  tasatucasa: {
    backgroundColor: "#FECE15",
    color: "#111827",
    borderColor: "#EAB308",
  },
  "tasar-bue": {
    backgroundColor: "#0B5CAB",
    color: "#FFFFFF",
    borderColor: "#0B5CAB",
  },
  "venta-online": {
    backgroundColor: "#C00000",
    color: "#FFFFFF",
    borderColor: "#C00000",
  },
  "venta-alquilada": {
    backgroundColor: "#7030A0",
    color: "#FFFFFF",
    borderColor: "#7030A0",
  },
  visita: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
  zona: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
  oficina: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
  portero: {
    backgroundColor: "#E5E7EB",
    color: "#111827",
    borderColor: "#D1D5DB",
  },
};

function normalizeSourceKey(source: string | null | undefined) {
  return (source || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function getSourceBadgeStyle(source: string | null | undefined) {
  const key = normalizeSourceKey(source);

  return (
    SOURCE_BADGE_STYLES[key] ?? {
      backgroundColor: "#F1F5F9",
      color: "#475569",
      borderColor: "#CBD5E1",
    }
  );
}

const MEDIO_BADGE_STYLES: Record<
  string,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  presencial: {
    backgroundColor: "#0F7A45",
    color: "#FFFFFF",
    borderColor: "#0F7A45",
  },
  videollamada: {
    backgroundColor: "#D4EDBC",
    color: "#118047",
    borderColor: "#B7D99C",
  },
  telefono: {
    backgroundColor: "#E5E7EB",
    color: "#374151",
    borderColor: "#D1D5DB",
  },
};

const EN_VENTA_BADGE_STYLES: Record<
  string,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  si: {
    backgroundColor: "#F3B6B6",
    color: "#FFFFFF",
    borderColor: "#F3B6B6",
  },
  no: {
    backgroundColor: "#D4EDBC",
    color: "#288158",
    borderColor: "#B7D99C",
  },
  "no-sabe": {
    backgroundColor: "#E5E7EB",
    color: "#374151",
    borderColor: "#D1D5DB",
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

function getMedioBadgeStyle(value: string | null | undefined) {
  const key = normalizeBadgeKey(value);

  return (
    MEDIO_BADGE_STYLES[key] ?? {
      backgroundColor: "#F1F5F9",
      color: "#475569",
      borderColor: "#CBD5E1",
    }
  );
}

function getEnVentaBadgeStyle(value: string | null | undefined) {
  const key = normalizeBadgeKey(value);

  return (
    EN_VENTA_BADGE_STYLES[key] ?? {
      backgroundColor: "#F1F5F9",
      color: "#475569",
      borderColor: "#CBD5E1",
    }
  );
}

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

function fmtMonth(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return "—";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function normalizePhase(raw: string | null | undefined): Lead["phase"] {
  const value = (raw || "").toLowerCase().trim();

  if (value.includes("noticia")) return "noticia";
  if (value.includes("concertada")) return "concertada";
  if (value.includes("valorada")) return "valorada";
  if (value.includes("encargo")) return "encargo";

  /**
   * Legacy:
   * - "Cualificada" ya no es fase V1, es Estado.
   * - "Vender/Vendida" no se muestra como columna Kanban V1.
   */
  if (value.includes("cualificada")) return "noticia";
  if (value.includes("vendida") || value.includes("vender")) return "encargo";

  return "noticia";
}

function normalizeStatus(raw: string | null | undefined): Lead["status"] {
  const value = (raw || "").toLowerCase().trim();

  if (value === "identificar" || value === "identificada") {
    return "identificar" as Lead["status"];
  }

  if (value === "cualificada") {
    return "cualificada" as Lead["status"];
  }

  if (value === "seguimiento") {
    return "cualificada" as Lead["status"];
  }

  if (value === "caliente") {
    return "caliente" as Lead["status"];
  }

  if (value === "desestimada") {
    return "desestimada" as Lead["status"];
  }

  return "identificar" as Lead["status"];
}

function normalizeValor(raw: string | null | undefined) {
  if (!raw) return "—";
  return raw;
}

function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function normalizePostalId(cp: string | null | undefined): number | null {
  const value = cp?.trim();
  if (!value || !/^\d{5}$/.test(value)) return null;
  return Number(value);
}

function cleanNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const placeholders = new Set(["—", "-", "N/A", "Sin origen", "Sin asignar"]);
  if (placeholders.has(trimmed)) return null;

  return trimmed;
}

function mapCrmLeadToLead(row: CrmLeadRow): LeadTableRow {
  const ownerLabel =
    row.comercial_name?.trim() || row.contact_name?.trim() || "Sin asignar";

  const domicilio = row.domicilio?.trim() || "—";
  const distrito = row.distrito?.trim() || "—";
  const provincia = row.provincia?.trim() || "—";
  const cp = row.cp ? String(row.cp) : "—";

  const fechaNoticia = normalizeDate(row.fecha || row.created_at || "");

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
    fechaNoticia,
    fechaContacto: normalizeDate(row.fecha_contacto),
    fechaValoracion: normalizeDate(row.fecha_valoracion),
    hora: row.hora ? row.hora.slice(0, 5) : "",
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
    medio: row.medio?.trim() || "—",
    month: fmtMonth(fechaNoticia),
    dominio: row.dominio_desc?.trim() || "—",
    enVenta: row.en_venta?.trim() || "No Sabe",
  };
}

export default function LeadsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<LeadTableRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [totalLeadsCount, setTotalLeadsCount] = useState<number | null>(null);
  const [hasMoreLeads, setHasMoreLeads] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<LeadsViewMode>("table");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  async function loadLeadsFromSupabase(options?: { append?: boolean }) {
    const append = options?.append ?? false;
    const from = append ? leads.length : 0;
    const to = from + LEADS_PAGE_SIZE - 1;

    setPageError(null);

    if (append) {
      setLoadingMoreLeads(true);
    } else {
      setLoadingLeads(true);
    }

    const { data, error, count } = await supabase
      .from("crm_leads_view")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Supabase leads error:", error);
      setPageError("No se pudieron cargar los leads. Intentá actualizar la página.");
      setLoadingLeads(false);
      setLoadingMoreLeads(false);
      return;
    }

    const rows = (data ?? []) as CrmLeadRow[];
    const mapped = rows.map((row) => mapCrmLeadToLead(row));
    const nextTotal = count ?? (append ? leads.length + mapped.length : mapped.length);
    const nextLoadedCount = from + mapped.length;
    const nextFavorites = new Set(
      rows.filter((row) => row.is_favorite).map((row) => String(row.id))
    );

    setLeads((prev) => (append ? [...prev, ...mapped] : mapped));
    setFavoriteIds((prev) => {
      if (!append) return nextFavorites;

      const merged = new Set(prev);
      for (const id of nextFavorites) merged.add(id);
      return merged;
    });
    setTotalLeadsCount(nextTotal);
    setHasMoreLeads(nextLoadedCount < nextTotal);
    setLoadingLeads(false);
    setLoadingMoreLeads(false);
  }

  async function handleImportCsv(importedLeads: Lead[]) {
    setPageError(null);
    if (importedLeads.length === 0) return;

    const rowsToInsert = importedLeads.map((lead) => ({
      propietario: cleanNullable(lead.ownerName),
      domicilio: cleanNullable(lead.address),
      telefono: cleanNullable(lead.phone),
      tasacion: cleanNullable(lead.valor),
      estado: cleanNullable(lead.status),
      fecha: cleanNullable(lead.fechaNoticia),
      source_desc: cleanNullable(lead.source),
      comercial_user_desc: cleanNullable(lead.owner),
      dominio_desc: cleanNullable(lead.planner),
      postal_id: normalizePostalId(lead.cp),
      fase_id: PHASE_ID_MAP[lead.phase] ?? 1,
      created_at: new Date().toISOString(),
      memo: cleanNullable(lead.notes),
      en_venta: null,
      medio: cleanNullable(lead.medio),
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
      setPageError("No se pudieron importar los leads. Revisá el archivo e intentá nuevamente.");
      return;
    }

    await loadLeadsFromSupabase({ append: false });
  }

  async function handleCreateLead(form: NewLeadFormData) {
    setPageError(null);

    const rowsToInsert = [
      {
        propietario: cleanNullable(form.ownerName),
        domicilio: cleanNullable(form.address),
        telefono: cleanNullable(form.phone),
        tasacion: cleanNullable(form.valor),
        estado: cleanNullable(form.status),
        fecha: cleanNullable(form.fechaNoticia),
        fecha_contacto: cleanNullable(form.fechaContacto),
        fecha_valoracion: cleanNullable(form.fechaValoracion),
        hora: cleanNullable(form.hora),
        source_desc: cleanNullable(form.source),
        comercial_user_desc: cleanNullable(form.owner),
        dominio_desc: cleanNullable(form.planner),
        postal_id: normalizePostalId(form.cp),
        fase_id: PHASE_ID_MAP[form.phase as Lead["phase"]] ?? 1,
        created_at: new Date().toISOString(),
        memo: cleanNullable(form.notes),
        en_venta: cleanNullable(form.enVenta),
        medio: cleanNullable(form.medio),
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
      setPageError("No se pudo crear el lead. Revisá los datos e intentá nuevamente.");
      return;
    }

    await loadLeadsFromSupabase({ append: false });
  }

  async function handleSaveLead(next: Lead) {
    setPageError(null);

    const { error } = await supabase
      .from("opportunities")
      .update({
        propietario: cleanNullable(next.ownerName),
        domicilio: cleanNullable(next.address),
        telefono: cleanNullable(next.phone),
        tasacion: cleanNullable(next.valor),
        estado: cleanNullable(next.status),
        fecha: next.fechaNoticia ? next.fechaNoticia.slice(0, 10) : null,
        fecha_contacto: next.fechaContacto ? next.fechaContacto.slice(0, 10) : null,
        fecha_valoracion: next.fechaValoracion
          ? next.fechaValoracion.slice(0, 10)
          : null,
        hora: cleanNullable(next.hora),
        source_desc: cleanNullable(next.source),
        comercial_user_desc: cleanNullable(next.owner),
        dominio_desc: cleanNullable(next.planner),
        memo: cleanNullable(next.notes),
        medio: cleanNullable(next.medio),
        en_venta: cleanNullable(next.enVenta),
        fase_id: PHASE_ID_MAP[next.phase] ?? 1,
        postal_id: normalizePostalId(next.cp),
      })
      .eq("id", Number(next.id));

    if (error) {
      console.error("Error actualizando lead:", error);
      setPageError("No se pudo guardar el lead. Revisá los datos e intentá nuevamente.");
      return;
    }

    await loadLeadsFromSupabase({ append: false });
    setSelectedLead((prev) =>
      prev && prev.id === next.id ? { ...prev, ...next } : prev
    );
  }

  async function handleToggleFavorite(leadId: string) {
    setPageError(null);
    const nextFavorite = !favoriteIds.has(leadId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (nextFavorite) next.add(leadId);
      else next.delete(leadId);
      return next;
    });

    const { error } = await supabase
      .from("opportunities")
      .update({ is_favorite: nextFavorite })
      .eq("id", Number(leadId));

    if (error) {
      console.error("Error actualizando favorito:", error);
      setPageError("No se pudo actualizar el favorito. Intentá nuevamente.");

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (nextFavorite) next.delete(leadId);
        else next.add(leadId);
        return next;
      });
    }
  }

  useEffect(() => {
    void loadLeadsFromSupabase({ append: false });
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
    const baseLeads = showFavoritesOnly
      ? leads.filter((lead) => favoriteIds.has(lead.id))
      : leads;

    const q = searchTerm.trim().toLowerCase();
    if (!q) return baseLeads;

    return baseLeads.filter((lead) =>
      [
        lead.ownerName,
        lead.address,
        lead.distrito,
        lead.cp,
        lead.phone,
        lead.source,
        lead.medio,
        lead.enVenta,
        lead.month,
        lead.dominio,
        lead.owner,
        PHASE_LABELS[lead.phase],
        getStatusConfig(lead.status).label,
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
  }, [leads, searchTerm, showFavoritesOnly, favoriteIds]);

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

  const visibleTableLeads = sortedLeads;

  const visibleSelectedCount = useMemo(
    () => visibleTableLeads.filter((l) => selectedIds.has(l.id)).length,
    [visibleTableLeads, selectedIds]
  );

  const allVisibleSelected =
    visibleTableLeads.length > 0 && visibleSelectedCount === visibleTableLeads.length;

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
        for (const lead of visibleTableLeads) next.add(lead.id);
      } else {
        for (const lead of visibleTableLeads) next.delete(lead.id);
      }
      return next;
    });
  }

  async function handleConfirmDelete() {
    setPageError(null);
    const idsToDelete = Array.from(selectedIds).map((id) => Number(id));

    const { error } = await supabase
      .from("opportunities")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", idsToDelete);

    if (error) {
      console.error("Error soft deleting leads:", error);
      setPageError("No se pudieron eliminar los leads seleccionados. Intentá nuevamente.");
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
              {visibleTableLeads.length} visibles de {totalLeadsCount ?? leads.length} leads
              {hasMoreLeads ? ` · ${leads.length} cargados` : ""}
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => void loadLeadsFromSupabase({ append: false })}
              disabled={loadingLeads}
              title="Refrescar tabla"
              aria-label="Refrescar tabla"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loadingLeads && "animate-spin")}
              />
            </Button>

            <Button
              size="sm"
              variant={showFavoritesOnly ? "default" : "outline"}
              className="h-7 w-7 p-0"
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
              title="Filtrar favoritos"
              aria-label="Filtrar favoritos"
            >
              <Star
                className={cn("h-3.5 w-3.5", showFavoritesOnly && "fill-current")}
              />
            </Button>

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

        {pageError && (
          <div className="mx-6 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {pageError}
          </div>
        )}

        {viewMode === "table" && selectionMode && selectedIds.size > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/60 px-6 py-2 text-[11px]">
            <span className="text-muted-foreground">
              {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""}{" "}
              seleccionados
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
            <table
              className="border-collapse text-sm"
              style={{ width: 2700, tableLayout: "fixed" }}
            >
              <colgroup>
                {selectionMode && <col style={{ width: 44 }} />}
                <col style={{ width: 48 }} />
                <col style={{ width: 115 }} />
                <col style={{ width: 135 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 135 }} />
                <col style={{ width: 105 }} />
                <col style={{ width: 155 }} />
                <col style={{ width: 155 }} />
                <col style={{ width: 165 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 175 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 310 }} />
                <col style={{ width: 230 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 130 }} />
              </colgroup>
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

                  <th className="w-9 px-3 py-2.5">
                    <span className="sr-only">Favorito</span>
                  </th>

                  {(
                    [
                      { label: "Fase", key: "phase" },
                      { label: "Estado", key: "status" },
                      { label: "F. Noticia", key: "fechaNoticia" },
                      { label: "F. Contacto", key: "fechaContacto" },
                      { label: "F. Valoración", key: "fechaValoracion" },
                      { label: "Hora", key: "hora" },
                      { label: "Medio", key: "medio" },
                      { label: "Month", key: "month" },
                      { label: "Dominio", key: "dominio" },
                      { label: "Planner", key: "planner" },
                      { label: "Owner", key: "owner" },
                      { label: "Origen", key: "source" },
                      { label: "Distrito", key: "distrito" },
                      { label: "CP", key: "cp" },
                      { label: "Valor", key: "valor" },
                      { label: "Domicilio", key: "address" },
                      { label: "Propietario", key: "ownerName" },
                      { label: "Teléfono", key: "phone" },
                      { label: "En Venta", key: "enVenta" },
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
                {visibleTableLeads.map((lead, i) => (
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleFavorite(lead.id);
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={
                          favoriteIds.has(lead.id)
                            ? "Quitar de favoritos"
                            : "Marcar como favorito"
                        }
                        title={
                          favoriteIds.has(lead.id)
                            ? "Quitar de favoritos"
                            : "Marcar como favorito"
                        }
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            favoriteIds.has(lead.id) && "fill-current text-amber-500"
                          )}
                        />
                      </button>
                    </td>

                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={{
                          backgroundColor:
                            (PHASE_COLORS[lead.phase] ?? "#94a3b8") + "1a",
                          color: PHASE_COLORS[lead.phase] ?? "#64748b",
                        }}
                      >
                        <Circle className="h-1.5 w-1.5 fill-current" />
                        {PHASE_LABELS[lead.phase] ?? lead.phase}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      {(() => {
                        const statusConfig = getStatusConfig(lead.status);

                        return (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                            style={{
                              backgroundColor: statusConfig.backgroundColor,
                              color: statusConfig.color,
                              borderColor: statusConfig.borderColor,
                            }}
                          >
                            <Circle className="h-1.5 w-1.5 fill-current" />
                            {statusConfig.label}
                          </span>
                        );
                      })()}
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

                    <td className="px-3 py-2.5">
                      {lead.medio && lead.medio !== "—" ? (
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                          style={getMedioBadgeStyle(lead.medio)}
                        >
                          {lead.medio}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.month}
                    </td>

                    <td className="max-w-[110px] truncate whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.dominio}
                    </td>

                    <td className="max-w-[110px] truncate whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
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
                        <span className="max-w-[125px] truncate text-xs text-muted-foreground">
                          {lead.owner}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={getSourceBadgeStyle(lead.source)}
                      >
                        {lead.source}
                      </span>
                    </td>

                    <td className="truncate whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.distrito}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.cp}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-foreground">
                      {lead.valor}
                    </td>

                    <td className="truncate whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.address}
                    </td>

                    <td className="truncate whitespace-nowrap px-3 py-2.5">
                      <span className="font-medium text-foreground">
                        {lead.ownerName}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {lead.phone}
                    </td>

                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={getEnVentaBadgeStyle(lead.enVenta)}
                      >
                        {lead.enVenta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {visibleTableLeads.length === 0 && (
                <tbody>
                  <tr>
                    <td
                      colSpan={selectionMode ? 21 : 20}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      No hay leads que coincidan con la búsqueda.
                    </td>
                  </tr>
                </tbody>
              )}
            </table>

            {hasMoreLeads && (
              <div className="flex justify-center border-t border-border bg-background px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadLeadsFromSupabase({ append: true })}
                  disabled={loadingMoreLeads}
                  className="h-8 text-xs font-semibold"
                >
                  {loadingMoreLeads ? "Cargando..." : "Ver más"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
            <KanbanBoard
              leads={filteredLeads.filter((lead) => VALID_PHASES.includes(lead.phase))}
              onOpenLead={(lead) => setSelectedLead(lead)}
            />
          </div>
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