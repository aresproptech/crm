"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import { supabase } from "@/lib/supabase";
import { Search, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_LABELS, type Lead } from "@/lib/crm-data";

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
  source_id: number | null;
  comercial_name: string | null;
  contact_name: string | null;
  cp: number | null;
  provincia: string | null;
  distrito: string | null;
  dominio_desc: string | null;
  hora: string | null;
  medio: string | null;
  en_venta: string | null;
  fecha_contacto: string | null;
  fecha_valoracion: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  identificar: { label: "Identificada", dot: "bg-violet-500" },
  cualificada: { label: "Cualificada", dot: "bg-emerald-500" },
  seguimiento: { label: "Cualificada", dot: "bg-emerald-500" },
  caliente: { label: "Caliente", dot: "bg-orange-500" },
  desestimada: { label: "Desestimada", dot: "bg-muted-foreground" },
};

const PHASE_BADGE_STYLES: Record<
  string,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  noticia: {
    backgroundColor: "#D4EDBC",
    color: "#288158",
    borderColor: "#B7D99C",
  },
  concertada: {
    backgroundColor: "#94EC89",
    color: "#14532D",
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

function getPhaseBadgeStyle(phase: string | null | undefined) {
  return (
    PHASE_BADGE_STYLES[phase || "noticia"] ?? {
      backgroundColor: "#F1F5F9",
      color: "#475569",
      borderColor: "#CBD5E1",
    }
  );
}

const PLANNING_CONFIG: Record<
  "previas" | "hoy" | "proximas",
  { label: string; className: string }
> = {
  previas: {
    label: "Previas",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  hoy: {
    label: "Hoy",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  proximas: {
    label: "Próximas",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

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

function normalizeBadgeKey(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function getSourceBadgeStyle(source: string | null | undefined) {
  const key = normalizeBadgeKey(source);

  return (
    SOURCE_BADGE_STYLES[key] ?? {
      backgroundColor: "#F1F5F9",
      color: "#475569",
      borderColor: "#CBD5E1",
    }
  );
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

function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
}

function getPlanningStatus(dateValue: string): "previas" | "hoy" | "proximas" {
  const normalized = normalizeDate(dateValue);
  if (!normalized) return "previas";

  const today = new Date();
  const todayValue = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
    .toISOString()
    .slice(0, 10);

  if (normalized < todayValue) return "previas";
  if (normalized > todayValue) return "proximas";

  return "hoy";
}

function normalizePhase(raw: string | null | undefined): Lead["phase"] {
  const value = (raw || "").toLowerCase().trim();

  if (value === "noticia") return "noticia";
  if (value === "concertada") return "concertada";
  if (value === "valorada") return "valorada";
  if (value === "encargo") return "encargo";
  if (value === "cualificada") return "noticia";
  if (value === "vendida" || value === "vender") return "encargo";

  return "noticia";
}

function normalizeStatus(raw: string | null | undefined): Lead["status"] {
  const value = (raw || "").toLowerCase().trim();

  if (value === "identificar" || value === "identificada") return "identificar";
  if (value === "cualificada") return "cualificada";
  if (value === "seguimiento") return "cualificada";
  if (value === "caliente") return "caliente";
  if (value === "desestimada") return "desestimada";

  return "identificar";
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
    fechaContacto: normalizeDate(row.fecha_contacto),
    fechaValoracion: normalizeDate(row.fecha_valoracion || row.fecha || row.created_at || ""),
    hora: row.hora ? row.hora.slice(0, 5) : "",
    medio: row.medio?.trim() || "—",
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

export default function ValoracionesPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadValoraciones() {
      setLoading(true);

      const { data, error } = await supabase
        .from("crm_leads_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase valoraciones error:", error);
        setLoading(false);
        return;
      }

      const mapped = (data ?? []).map((row) => mapCrmLeadToLead(row as CrmLeadRow));
      const filtered = mapped.filter(
        (lead) => lead.phase === "concertada" || lead.phase === "valorada"
      );

      setItems(filtered);
      setLoading(false);
    }

    loadValoraciones();
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
        lead.medio ?? "",
        lead.owner,
        lead.planner ?? "",
        lead.valor,
        PHASE_LABELS[lead.phase],
        (STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.identificar).label,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, searchTerm]);

  return (
    <>
      <Topbar title="Valoraciones" />

      <main className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {filteredItems.length} valoraciones en total
            </span>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar valoraciones..."
                className="h-8 w-[260px] rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
            Cargando valoraciones desde Supabase...
          </div>
        )}

        <div className="relative flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 1560 }}>
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b border-border bg-card/95 text-left backdrop-blur">
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Planning
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  F. Valoración
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hora
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Medio
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Dominio
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Origen
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Inmueble
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Propietario
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Teléfono
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fase
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Planner
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Owner
                </th>
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
                  <td className="px-3 py-2.5">
                    {(() => {
                      const planning = getPlanningStatus(lead.fechaValoracion);
                      const config = PLANNING_CONFIG[planning];

                      return (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                            config.className
                          )}
                        >
                          {config.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {fmt(lead.fechaValoracion)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
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
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {lead.planner || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                      style={getSourceBadgeStyle(lead.source)}
                    >
                      {lead.source}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                    {lead.address}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    {lead.ownerName}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {lead.phone}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                      style={getPhaseBadgeStyle(lead.phase)}
                    >
                      <Circle className="h-1.5 w-1.5 fill-current" />
                      {PHASE_LABELS[lead.phase] ?? lead.phase}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {lead.planner || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {lead.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}