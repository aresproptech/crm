"use client";

import { useState, useMemo } from "react";
import { Topbar } from "@/components/crm/topbar";
import { NewLeadModal } from "@/components/crm/new-lead-modal";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type Lead,
  PHASE_LABELS,
  PHASE_COLORS,
  MOCK_LEADS,
} from "@/lib/crm-data";
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
      <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
    );
  }

  return sortDir === "asc" ? (
    <ChevronUp className="h-3 w-3 text-primary shrink-0" />
  ) : (
    <ChevronDown className="h-3 w-3 text-primary shrink-0" />
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
  seguimiento: { label: "Seguimiento", dot: "bg-blue-500" },
  caliente: { label: "Caliente", dot: "bg-orange-500" },
  desestimada: { label: "Desestimada", dot: "bg-muted-foreground" },
} as const;

function fmt(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default function LeadsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchTerm, setSearchTerm] = useState("");

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

  const visibleSelectedCount = useMemo(
    () => sortedLeads.filter((l) => selectedIds.has(l.id)).length,
    [sortedLeads, selectedIds]
  );

  const allVisibleSelected =
    sortedLeads.length > 0 && visibleSelectedCount === sortedLeads.length;

  function toggleRowSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const lead of sortedLeads) {
          next.add(lead.id);
        }
      } else {
        for (const lead of sortedLeads) {
          next.delete(lead.id);
        }
      }
      return next;
    });
  }

  function handleConfirmDelete() {
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

      <main className="flex flex-col flex-1 overflow-hidden mt-14 min-h-0">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {sortedLeads.length} leads en total
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
              className="h-7 gap-1.5 text-xs font-semibold"
              onClick={() => setImportOpen(true)}
            >
              Importar CSV
            </Button>
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

        {selectionMode && selectedIds.size > 0 && (
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

        <div className="relative flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 1500 }}>
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b border-border bg-card/95 backdrop-blur text-left">
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
                    className="px-3 py-2.5 whitespace-nowrap cursor-pointer select-none group"
                  >
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
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
                    <span className="font-medium text-foreground whitespace-nowrap">
                      {lead.ownerName}
                    </span>
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap max-w-[180px] truncate">
                    {lead.address}
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {lead.distrito}
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {lead.cp}
                  </td>

                  <td className="px-3 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">
                    {lead.valor}
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {lead.phone}
                  </td>

                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
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

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {fmt(lead.fechaNoticia)}
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {fmt(lead.fechaContacto)}
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {fmt(lead.fechaValoracion)}
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {lead.hora || "—"}
                  </td>

                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {lead.planner ?? "—"}
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary uppercase">
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
      </main>

      <NewLeadModal open={modalOpen} onOpenChange={setModalOpen} />
      <ImportLeadsCsvModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(newLeads) => {
          setLeads((prev) => [...newLeads, ...prev]);
        }}
      />
      <LeadDetailPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
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