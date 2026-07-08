"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { PHASE_LABELS } from "@/lib/crm-data";

type PeriodOption = "last7" | "currentMonth" | "custom";

type DateRange = {
  start: Date;
  end: Date;
};

type FunnelItem = {
  phase: "identificada" | "cualificada" | "valorada" | "encargo";
  label: string;
  value: number;
};

type SourceItem = {
  name: string;
  value: number;
};

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

type DashboardLead = {
  id: string;
  createdAt: string | null;
  phase: FunnelItem["phase"];
  status: "activa" | "caliente" | "desestimada";
  source: string;
};

const PHASE_ORDER: FunnelItem["phase"][] = [
  "identificada",
  "cualificada",
  "valorada",
  "encargo",
];

const SOURCE_COLORS = [
  "#d8c7ef",
  "#facc15",
  "#006699",
  "#a21caf",
  "#dc2626",
  "#14b8a6",
  "#84cc16",
  "#f97316",
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function createLast7DaysRange(today = new Date()): DateRange {
  const end = endOfDay(today);
  const start = startOfDay(new Date(today));
  start.setDate(start.getDate() - 6);
  return { start, end };
}

function createCurrentMonthRange(today = new Date()): DateRange {
  const start = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const end = endOfDay(today);
  return { start, end };
}

function createCustomRange(
  from: string,
  to: string,
  fallback: DateRange
): DateRange {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (!fromDate || isNaN(fromDate.getTime()) || !toDate || isNaN(toDate.getTime())) {
    return fallback;
  }

  if (fromDate > toDate) {
    return fallback;
  }

  return { start: startOfDay(fromDate), end: endOfDay(toDate) };
}

function isWithinRange(date: Date, range: DateRange): boolean {
  const time = date.getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function getDatesInRange(range: DateRange) {
  const dates: Date[] = [];
  const cursor = startOfDay(range.start);

  while (cursor <= range.end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function normalizeSource(source: string | undefined | null) {
  return String(source || "Sin origen").trim() || "Sin origen";
}

function calcConversion(from: number, to: number) {
  if (from === 0) return 0;
  return Math.round((to / from) * 100);
}

function FunnelBar({
  label,
  value,
  maxValue,
  colorClass,
}: {
  label: string;
  value: number;
  maxValue: number;
  colorClass: string;
}) {
  const width = maxValue > 0 ? Math.max(18, (value / maxValue) * 100) : 18;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-10 w-full rounded-xl bg-muted/50 px-2 py-1">
        <div
          className={cn(
            "flex h-full items-center rounded-lg px-3 text-sm font-semibold text-white transition-all",
            colorClass
          )}
          style={{ width: `${width}%` }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodOption>("last7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [crmLeads, setCrmLeads] = useState<CrmLeadRow[]>([]);
  const [crmLeadsLoading, setCrmLeadsLoading] = useState(true);

  useEffect(() => {
    async function fetchCrmLeads() {
      setCrmLeadsLoading(true);

      const { data, error } = await supabase
        .from("crm_leads_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase crm leads error:", error);
        setCrmLeadsLoading(false);
        return;
      }

      console.log("Supabase crm leads:", data);
      setCrmLeads(data ?? []);
      setCrmLeadsLoading(false);
    }

    fetchCrmLeads();
  }, []);

  const currentRange = useMemo(() => {
    const today = new Date();
    const defaultRange = createLast7DaysRange(today);

    if (period === "last7") return defaultRange;
    if (period === "currentMonth") return createCurrentMonthRange(today);
    return createCustomRange(customFrom, customTo, defaultRange);
  }, [period, customFrom, customTo]);

  const currentLeads = useMemo<DashboardLead[]>(() => {
    const current: DashboardLead[] = [];

    for (const lead of crmLeads) {
      const created = lead.created_at ? new Date(lead.created_at) : null;

      if (!created || isNaN(created.getTime())) continue;
      if (!isWithinRange(created, currentRange)) continue;

      const normalizedPhase = (() => {
        const raw = (lead.fase_name || "").toLowerCase().trim();

        if (raw === "noticia" || raw === "identificada") return "identificada";
        if (raw === "concertada" || raw === "cualificada") return "cualificada";
        if (raw === "valorada") return "valorada";
        if (raw === "encargo") return "encargo";
        return "identificada";
      })();

      const normalizedStatus = (() => {
        const raw = (lead.estado || "").toLowerCase().trim();

        if (
          !raw ||
          raw === "activa" ||
          raw === "activo" ||
          raw === "seguimiento" ||
          raw === "cualificada"
        ) return "activa";
        if (raw === "caliente") return "caliente";
        if (raw === "desestimada") return "desestimada";
        if (raw === "identificar" || raw === "identificada") return "activa";
        return "activa";
      })();

      current.push({
        id: String(lead.id),
        createdAt: lead.created_at,
        phase: normalizedPhase,
        status: normalizedStatus,
        source: lead.source_name || "Sin origen",
      });
    }

    return current;
  }, [crmLeads, currentRange]);

  const funnelData = useMemo<FunnelItem[]>(() => {
    const phaseLabels: Record<FunnelItem["phase"], string> = {
      identificada: PHASE_LABELS.identificada,
      cualificada: PHASE_LABELS.cualificada,
      valorada: PHASE_LABELS.valorada,
      encargo: PHASE_LABELS.encargo,
    };

    return PHASE_ORDER.map((phase) => ({
      phase,
      label: phaseLabels[phase],
      value: currentLeads.filter((l) => l.phase === phase).length,
    }));
  }, [currentLeads]);

  const maxFunnelValue = useMemo(
    () => Math.max(...funnelData.map((item) => item.value), 0),
    [funnelData]
  );

  const conversionData = useMemo(() => {
    const identificada = funnelData.find((x) => x.phase === "identificada")?.value ?? 0;
    const cualificada = funnelData.find((x) => x.phase === "cualificada")?.value ?? 0;
    const valorada = funnelData.find((x) => x.phase === "valorada")?.value ?? 0;
    const encargo = funnelData.find((x) => x.phase === "encargo")?.value ?? 0;

    return [
      {
        label: "Identificada → Cualificada",
        value: `${calcConversion(identificada, cualificada)}%`,
        detail: `${cualificada} de ${identificada}`,
      },
      {
        label: "Cualificada → Valorada",
        value: `${calcConversion(cualificada, valorada)}%`,
        detail: `${valorada} de ${cualificada}`,
      },
      {
        label: "Valorada → Encargo",
        value: `${calcConversion(valorada, encargo)}%`,
        detail: `${encargo} de ${valorada}`,
      },
      {
        label: "Identificada → Encargo",
        value: `${calcConversion(identificada, encargo)}%`,
        detail: "Conversión total",
      },
    ];
  }, [funnelData]);

  const dailySeries = useMemo(() => {
    const dates = getDatesInRange(currentRange);

    return dates.map((date) => {
      const label = formatDayLabel(date);
      const dayStart = startOfDay(date).getTime();
      const dayEnd = endOfDay(date).getTime();

      const dayLeads = currentLeads.filter((lead) => {
        const created = lead.createdAt ? new Date(lead.createdAt).getTime() : NaN;
        return created >= dayStart && created <= dayEnd;
      });

      return {
        date: label,
        ingresados: dayLeads.length,
        desestimados: dayLeads.filter((l) => l.status === "desestimada").length,
        activos: dayLeads.filter((l) => l.status === "activa").length,
      };
    });
  }, [currentLeads, currentRange]);

  const sourceSeries = useMemo<SourceItem[]>(() => {
    const map = new Map<string, number>();

    for (const lead of currentLeads) {
      const source = normalizeSource(lead.source);
      map.set(source, (map.get(source) ?? 0) + 1);
    }

    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [currentLeads]);

  const sourceTrendSeries = useMemo(() => {
    const topSources = sourceSeries.slice(0, 5).map((s) => s.name);
    const dates = getDatesInRange(currentRange);

    const cumulative = new Map<string, number>();
    topSources.forEach((source) => cumulative.set(source, 0));

    return dates.map((date) => {
      const label = formatDayLabel(date);
      const dayStart = startOfDay(date).getTime();
      const dayEnd = endOfDay(date).getTime();

      const dayLeads = currentLeads.filter((lead) => {
        const created = lead.createdAt ? new Date(lead.createdAt).getTime() : NaN;
        return created >= dayStart && created <= dayEnd;
      });

      const row: Record<string, string | number> = { date: label };

      for (const source of topSources) {
        const dayCount = dayLeads.filter(
          (lead) => normalizeSource(lead.source) === source
        ).length;

        const next = (cumulative.get(source) ?? 0) + dayCount;
        cumulative.set(source, next);
        row[source] = next;
      }

      return row;
    });
  }, [sourceSeries, currentLeads, currentRange]);

  const sourceCards = sourceSeries.slice(0, 5);

  return (
    <>
      <Topbar title="Dashboard" />

      <main className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#006699]">
        <div className="flex shrink-0 justify-end px-6 py-4">
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <div className="grid grid-cols-3 items-stretch gap-1 rounded-xl bg-white p-1 text-[11px] shadow-sm sm:inline-flex sm:items-center">
              <button
                type="button"
                onClick={() => setPeriod("last7")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-center font-semibold transition-colors",
                  period === "last7"
                    ? "bg-[#006699] text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                onClick={() => setPeriod("currentMonth")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-center font-semibold transition-colors",
                  period === "currentMonth"
                    ? "bg-[#006699] text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Mes actual
              </button>
              <button
                type="button"
                onClick={() => setPeriod("custom")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-center font-semibold transition-colors",
                  period === "custom"
                    ? "bg-[#006699] text-white"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Rango personalizado
              </button>
            </div>

            {period === "custom" && (
              <div className="flex flex-col gap-2 text-[11px] text-white/90 sm:flex-row sm:items-center">
                <label className="flex items-center gap-1.5">
                  <span>Desde</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-md border border-white/20 bg-white px-2 text-slate-900 shadow-sm outline-none sm:flex-none"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span>Hasta</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-md border border-white/20 bg-white px-2 text-slate-900 shadow-sm outline-none sm:flex-none"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {crmLeadsLoading && (
            <div className="mb-4 rounded-xl bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-xl">
              Cargando leads reales desde Supabase...
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_0.9fr]">
            <Card className="border-white/10 bg-white/95 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Embudo de fases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {funnelData.map((item) => (
                  <FunnelBar
                    key={item.phase}
                    label={item.label}
                    value={item.value}
                    maxValue={maxFunnelValue}
                    colorClass={
                      item.phase === "identificada"
                        ? "bg-slate-500"
                        : item.phase === "cualificada"
                          ? "bg-[#60a5fa]"
                          : item.phase === "valorada"
                            ? "bg-[#a78bfa]"
                            : "bg-[#10b981]"
                    }
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/95 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conversión por fase</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {conversionData.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-700">
                        {item.label}
                      </span>
                      <span className="text-lg font-semibold tabular-nums text-slate-900">
                        {item.value}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[240px_1fr]">
            <div className="space-y-4">
              <div className="rounded-xl bg-white px-4 py-3 text-center shadow-lg">
                <div className="text-sm text-slate-500">Leads ingresados</div>
                <div className="text-4xl font-semibold text-slate-900">
                  {currentLeads.length}
                </div>
              </div>

              <div className="rounded-xl bg-[#ef7b7b] px-4 py-3 text-center text-white shadow-lg">
                <div className="text-sm text-white/90">Desestimados</div>
                <div className="text-4xl font-semibold">
                  {currentLeads.filter((l) => l.status === "desestimada").length}
                </div>
              </div>

              <div className="rounded-xl bg-[#7ecf7a] px-4 py-3 text-center text-white shadow-lg">
                <div className="text-sm text-white/90">Activos</div>
                <div className="text-4xl font-semibold">
                  {currentLeads.filter((l) => l.status === "activa").length}
                </div>
              </div>
            </div>

            <Card className="border-white/10 bg-[#e8edf1] shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Ingresados / Desestimados / Activos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dailySeries}
                      margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#cbd5e1" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="ingresados"
                        stroke="#16a34a"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="desestimados"
                        stroke="#dc2626"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="activos"
                        stroke="#d4a15f"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
            <div className="grid grid-cols-2 gap-4">
              {sourceCards.map((item, index) => (
                <div
                  key={item.name}
                  className="rounded-xl px-4 py-4 text-center text-white shadow-lg"
                  style={{
                    backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length],
                  }}
                >
                  <div className="text-sm text-white/90">{item.name}</div>
                  <div className="text-4xl font-semibold">{item.value}</div>
                </div>
              ))}
            </div>

            <Card className="border-white/10 bg-[#e8edf1] shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribución por origen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceSeries}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={110}
                        innerRadius={55}
                        paddingAngle={2}
                        label={({ percent }) =>
                          percent && percent > 0
                            ? `${(percent * 100).toFixed(1)}%`
                            : ""
                        }
                      >
                        {sourceSeries.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={SOURCE_COLORS[index % SOURCE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-5">
            <Card className="border-white/10 bg-[#006699] shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">
                  Evolución por origen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={sourceTrendSeries}
                      margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="rgba(255,255,255,0.18)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#ffffff" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#ffffff" }}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ color: "#fff" }} />
                      {sourceCards.map((item, index) => (
                        <Line
                          key={item.name}
                          type="monotone"
                          dataKey={item.name}
                          stroke={SOURCE_COLORS[index % SOURCE_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
