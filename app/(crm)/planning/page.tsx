"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import { supabase } from "@/lib/supabase";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/crm-data";

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

type PlanningItem = {
  id: string;
  planning: string;
  fecha: string;
  hora: string;
  tipo: "Valoración" | "R.G." | "Visita";
  inmueble: string;
  propietario: string;
  telefono: string;
  equipo: string;
  planner: string;
  owner: string;
};

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

  if (value.includes("noticia") || value.includes("identificada")) return "identificada";
  if (value.includes("concertada") || value.includes("cualificada")) return "cualificada";
  if (value.includes("valorada")) return "valorada";
  if (value.includes("encargo")) return "encargo";
  if (value.includes("vendida") || value.includes("vender")) return "encargo";

  return "identificada";
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
    valor: row.tasacion?.trim() || "—",
    phone: row.telefono?.trim() || "—",
    source: row.source_name?.trim() || "Sin origen",
    phase: normalizePhase(row.fase_name),
    status: "activa",
    fechaNoticia: row.fecha || row.created_at || "",
    fechaContacto: "",
    fechaValoracion: row.fecha || row.created_at || "",
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

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPlanningLabel(dateStr: string, tipo: PlanningItem["tipo"]) {
  if (!dateStr) return `${tipo}s Próximas`;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return `${tipo}s Próximas`;

  const today = startOfDay(new Date());
  const target = startOfDay(date);

  if (target < today) return `${tipo}s Anteriores`;
  if (target.getTime() === today.getTime()) return `${tipo}s de Hoy`;

  const weekday = target.toLocaleDateString("es-ES", { weekday: "long" });
  return `${tipo}s del ${weekday}`;
}

export default function PlanningPage() {
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadPlanning() {
      setLoading(true);

      const { data, error } = await supabase
        .from("crm_leads_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase planning error:", error);
        setLoading(false);
        return;
      }

      const mapped = (data ?? []).map((row) =>
        mapCrmLeadToLead(row as CrmLeadRow)
      );

      const planningItems: PlanningItem[] = [];

      mapped.forEach((lead) => {
        if (lead.phase === "cualificada" || lead.phase === "valorada") {
          planningItems.push({
            id: `valoracion-${lead.id}`,
            planning: getPlanningLabel(
              lead.fechaValoracion || lead.fechaNoticia,
              "Valoración"
            ),
            fecha: lead.fechaValoracion || lead.fechaNoticia,
            hora: lead.hora || "",
            tipo: "Valoración",
            inmueble: lead.address,
            propietario: lead.ownerName,
            telefono: lead.phone,
            equipo: lead.planner || "—",
            planner: lead.planner || "—",
            owner: lead.owner,
          });
        }

        if (lead.phase === "cualificada" || lead.phase === "encargo") {
          planningItems.push({
            id: `rg-${lead.id}`,
            planning: getPlanningLabel(lead.fechaNoticia, "R.G."),
            fecha: lead.fechaNoticia,
            hora: lead.hora || "",
            tipo: "R.G.",
            inmueble: lead.address,
            propietario: lead.ownerName,
            telefono: lead.phone,
            equipo: lead.planner || "—",
            planner: lead.planner || "—",
            owner: lead.owner,
          });
        }

        if (lead.phase === "encargo") {
          planningItems.push({
            id: `visita-${lead.id}`,
            planning: getPlanningLabel(lead.fechaNoticia, "Visita"),
            fecha: lead.fechaNoticia,
            hora: lead.hora || "",
            tipo: "Visita",
            inmueble: lead.address,
            propietario: lead.ownerName,
            telefono: lead.phone,
            equipo: lead.planner || "—",
            planner: lead.planner || "—",
            owner: lead.owner,
          });
        }
      });

      setItems(planningItems);
      setLoading(false);
    }

    loadPlanning();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [
        item.planning,
        item.tipo,
        item.inmueble,
        item.propietario,
        item.telefono,
        item.equipo,
        item.planner,
        item.owner,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, searchTerm]);

  return (
    <>
      <Topbar title="Planning" />

      <main className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {filteredItems.length} items en planning
            </span>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en planning..."
                className="h-8 w-[260px] rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
            Cargando planning desde Supabase...
          </div>
        )}

        <div className="relative flex-1 overflow-auto">
          <table
            className="w-full border-collapse text-sm"
            style={{ minWidth: 1400 }}
          >
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b border-border bg-card/95 text-left backdrop-blur">
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Planning
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fecha
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hora
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo
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
                  Equipo
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
              {filteredItems.map((item, i) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-accent/40",
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  )}
                >
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.planning}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {fmt(item.fecha)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.hora || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                    {item.tipo}
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                    {item.inmueble}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    {item.propietario}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.telefono}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.equipo}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.planner}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.owner}
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
