"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import { supabase } from "@/lib/supabase";
import { Search, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_COLORS, PHASE_LABELS, type Lead } from "@/lib/crm-data";

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
  fase_name: string | null;
  source_name: string | null;
  comercial_name: string | null;
  contact_name: string | null;
  cp: number | null;
  provincia: string | null;
  distrito: string | null;
  dominio_desc: string | null;
};

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

  if (value === "noticia") return "noticia";
  if (value === "concertada") return "concertada";
  if (value === "valorada") return "valorada";
  if (value === "cualificada") return "cualificada";
  if (value === "encargo") return "encargo";
  if (value === "vendida" || value === "vender") return "vender";

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
    fechaNoticia: row.fecha || row.created_at || "",
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

export default function EncargosPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadEncargos() {
      setLoading(true);

      const { data, error } = await supabase
        .from("crm_leads_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase encargos error:", error);
        setLoading(false);
        return;
      }

      const mapped = (data ?? []).map((row) => mapCrmLeadToLead(row as CrmLeadRow));
      const filtered = mapped.filter(
        (lead) => lead.phase === "encargo" || lead.phase === "vender"
      );

      setItems(filtered);
      setLoading(false);
    }

    loadEncargos();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;

    return items.filter((lead) =>
      [
        lead.ownerName,
        lead.address,
        lead.phone,
        lead.source,
        lead.owner,
        lead.valor,
        PHASE_LABELS[lead.phase],
        STATUS_CONFIG[lead.status].label,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, searchTerm]);

  return (
    <>
      <Topbar title="Encargos" />

      <main className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {filteredItems.length} encargos en total
            </span>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar encargos..."
                className="h-8 w-[260px] rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
            Cargando encargos desde Supabase...
          </div>
        )}

        <div className="relative flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 1200 }}>
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b border-border bg-card/95 text-left backdrop-blur">
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Propietario</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Domicilio</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teléfono</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Origen</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valor</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fase</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Owner</th>
              </tr>
            </thead>

            <tbody className="bg-background">
              {filteredItems.map((lead, i) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-accent/40",
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  )}
                >
                  <td className="px-3 py-2.5 font-medium text-foreground">{lead.ownerName}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-muted-foreground">{lead.address}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{lead.phone}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {lead.source}
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
                  <td className="px-3 py-2.5 text-xs font-medium text-foreground">{lead.valor}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(lead.fechaNoticia)}</td>
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
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{lead.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}