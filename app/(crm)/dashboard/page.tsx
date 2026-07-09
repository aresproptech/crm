"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { canViewAllLeads, useUser } from "@/lib/hooks/useUser";
import { PHASE_LABELS } from "@/lib/crm-data";

type PeriodOption = "last7" | "currentMonth" | "custom";
type DashboardTab = "general" | "commercials";
type CommercialDomainFilter = "all" | "chamartin" | "proptech";

type DateRange = {
  start: Date;
  end: Date;
};

type FunnelItem = {
  phase: "identificada" | "cualificada" | "valorada" | "encargo";
  label: string;
  value: number;
};

type PipelineItem = {
  label: string;
  value: number;
  tone: "brand" | "blue" | "purple" | "green" | "slate";
};

type FunnelMetricItem = PipelineItem & {
  today: number;
  average: number;
  projected: number;
  gap: number;
};

type ForecastMetricRow = {
  label: string;
  average: number;
  realized: number;
  projected: number;
  gap: number;
};

type RatioMetricRow = {
  label: string;
  actual: string;
  estimated: string;
  gap: string;
};

type StatusBreakdownRow = {
  name: string;
  activa: number;
  caliente: number;
  total: number;
};

type MetricItem = {
  label: string;
  value: number | string;
  detail: string;
  tone: "brand" | "green" | "amber" | "red" | "blue" | "slate";
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
  commercialName: string;
  domain: string;
};

type ActivityKind =
  | "noticias"
  | "concertaciones"
  | "valoraciones"
  | "encargos"
  | "visitas"
  | "rg";

type DailyActivityRow = Record<ActivityKind, number> & {
  commercial: string;
  total: number;
};

type OpportunityContactRow = {
  id: number;
  opportunity_id: number | null;
  fecha: string | null;
  memo: string | null;
  created_at: string | null;
};

type OpportunityOrderRow = {
  id: number;
  opportunity_id: number | null;
  created_at: string | null;
};

type VisitActivityRow = {
  id: number;
  opportunity_id: number | null;
  fecha_visita: string | null;
  created_at: string | null;
};

type CommercialPerformance = {
  name: string;
  total: number;
  activa: number;
  caliente: number;
  desestimada: number;
  identificada: number;
  cualificada: number;
  valorada: number;
  encargo: number;
  conversion: number;
};

const PHASE_ORDER: FunnelItem["phase"][] = [
  "identificada",
  "cualificada",
  "valorada",
  "encargo",
];

const COMMERCIAL_DOMAIN_OPTIONS: Array<{
  value: CommercialDomainFilter;
  label: string;
}> = [
  { value: "all", label: "ALL" },
  { value: "chamartin", label: "Chamartín" },
  { value: "proptech", label: "Proptech" },
];

const ACTIVITY_COLUMNS: Array<{ key: ActivityKind; label: string }> = [
  { key: "noticias", label: "Noticias" },
  { key: "concertaciones", label: "Concertaciones" },
  { key: "valoraciones", label: "Valoraciones" },
  { key: "encargos", label: "Encargos" },
  { key: "visitas", label: "Visitas" },
  { key: "rg", label: "R.G." },
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

function normalizeDomainKey(value: string | undefined | null) {
  return normalizePersonKey(value).replace(/\s+/g, "-");
}

function matchesDomainFilter(domain: string, filter: CommercialDomainFilter) {
  if (filter === "all") return true;
  return normalizeDomainKey(domain) === filter;
}

function normalizePersonKey(value: string | undefined | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dateKey(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function relativeDateKey(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return dateKey(date.toISOString());
}

function formatLongDateKey(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function heatmapClass(value: number) {
  if (value <= 0) return "bg-transparent text-slate-500";
  if (value <= 2) return "bg-emerald-50 text-emerald-800";
  if (value <= 5) return "bg-emerald-100 text-emerald-900";
  return "bg-emerald-500 text-white";
}

function calcConversion(from: number, to: number) {
  if (from === 0) return 0;
  return Math.round((to / from) * 100);
}

function ratioLabel(from: number, to: number) {
  if (to === 0) return "—";
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 1,
  }).format(from / to);
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits,
  }).format(value);
}

function getInclusiveDayCount(start: Date, end: Date) {
  return Math.max(getDatesInRange({ start, end }).length, 1);
}

function getToneClass(tone: PipelineItem["tone"]) {
  return {
    brand: "bg-[#006699]",
    blue: "bg-blue-500",
    purple: "bg-violet-500",
    green: "bg-emerald-500",
    slate: "bg-slate-500",
  }[tone];
}

function ExecutiveFunnel({ items }: { items: FunnelMetricItem[] }) {
  const widths = ["100%", "88%", "76%", "64%", "52%"];

  return (
    <Card className="border-white/10 bg-white/95 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Embudo ejecutivo</CardTitle>
        <p className="text-xs text-slate-500">
          Hoy, acumulado y proyección del periodo seleccionado.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.label}
              className="mx-auto overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm"
              style={{ width: widths[index] ?? "52%" }}
            >
              <div
                className={cn(
                  "px-4 py-2 text-center text-sm font-semibold text-white",
                  getToneClass(item.tone)
                )}
              >
                {item.label}
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 px-4 py-4 text-center">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Hoy</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-fuchsia-700">
                    {item.today}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Realizado
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
                    {item.value}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Proyectado
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-[#006699]">
                    {item.projected}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastPanel({
  rows,
  ratios,
}: {
  rows: ForecastMetricRow[];
  ratios: RatioMetricRow[];
}) {
  return (
    <Card className="border-white/10 bg-white/95 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Promedio, realizado y proyectado</CardTitle>
        <p className="text-xs text-slate-500">
          QTD corresponde al acumulado del periodo y EAC a la proyección.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-semibold text-slate-950">{row.label}</h3>
                <div
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
                    row.gap >= 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  )}
                >
                  Gap {row.gap >= 0 ? "+" : ""}
                  {formatNumber(row.gap)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Promedio
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                    {formatNumber(row.average, 1)}
                  </div>
                  <div className="text-xs text-slate-500">AVG</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Realizado
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                    {formatNumber(row.realized)}
                  </div>
                  <div className="text-xs text-slate-500">QTD</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Proyectado
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                    {formatNumber(row.projected)}
                  </div>
                  <div className="text-xs text-slate-500">EAC</div>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-950">Ratios</div>
            <div className="space-y-2">
              {ratios.map((ratio) => (
                <div
                  key={ratio.label}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm"
                >
                  <div className="font-medium text-slate-900">{ratio.label}</div>
                  <div className="text-right tabular-nums text-slate-700">
                    {ratio.actual}
                  </div>
                  <div className="text-right tabular-nums text-slate-500">
                    {ratio.estimated}
                  </div>
                  <div className="text-right tabular-nums text-slate-700">{ratio.gap}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBreakdownTable({
  title,
  label,
  rows,
}: {
  title: string;
  label: string;
  rows: StatusBreakdownRow[];
}) {
  const totals = rows.reduce(
    (acc, row) => ({
      activa: acc.activa + row.activa,
      caliente: acc.caliente + row.caliente,
      total: acc.total + row.total,
    }),
    { activa: 0, caliente: 0, total: 0 }
  );

  return (
    <Card className="border-white/10 bg-white/95 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Sin datos en este periodo.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{label}</th>
                  <th className="bg-red-600 px-3 py-3 text-right font-semibold text-white">
                    Activa
                  </th>
                  <th className="bg-emerald-600 px-3 py-3 text-right font-semibold text-white">
                    Caliente
                  </th>
                  <th className="bg-slate-900 px-4 py-3 text-right font-semibold text-white">
                    Suma total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.name}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-red-700">
                      {row.activa}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700">
                      {row.caliente}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.activa}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.caliente}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{totals.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({ item }: { item: MetricItem }) {
  const toneClass = {
    brand: "border-t-[#006699]",
    green: "border-t-emerald-500",
    amber: "border-t-amber-400",
    red: "border-t-red-400",
    blue: "border-t-blue-400",
    slate: "border-t-slate-400",
  }[item.tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 border-t-4 bg-white px-4 py-3 shadow-xl",
        toneClass
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {item.label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
        {item.value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
    </div>
  );
}

function DailyActivityTable({
  title,
  date,
  rows,
}: {
  title: string;
  date: string;
  rows: DailyActivityRow[];
}) {
  const totals = ACTIVITY_COLUMNS.reduce(
    (acc, column) => {
      acc[column.key] = rows.reduce((sum, row) => sum + row[column.key], 0);
      return acc;
    },
    {} as Record<ActivityKind, number>
  );
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <Card className="border-white/10 bg-white/95 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs capitalize text-slate-500">{formatLongDateKey(date)}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Sin actividad registrada.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Comercial</th>
                  {ACTIVITY_COLUMNS.map((column) => (
                    <th key={column.key} className="px-3 py-3 text-right font-semibold">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.commercial} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.commercial}
                    </td>
                    {ACTIVITY_COLUMNS.map((column) => (
                      <td key={column.key} className="px-3 py-2 text-right">
                        <span
                          className={cn(
                            "inline-flex min-w-10 justify-center rounded-md px-2 py-1 tabular-nums",
                            heatmapClass(row[column.key])
                          )}
                        >
                          {row[column.key]}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  {ACTIVITY_COLUMNS.map((column) => (
                    <td key={column.key} className="px-3 py-3 text-right tabular-nums">
                      {totals[column.key]}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums">{grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { userWithRole, loading: userLoading } = useUser();
  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>("general");
  const [period, setPeriod] = useState<PeriodOption>("last7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [commercialDomainFilter, setCommercialDomainFilter] =
    useState<CommercialDomainFilter>("all");
  const [crmLeads, setCrmLeads] = useState<CrmLeadRow[]>([]);
  const [contacts, setContacts] = useState<OpportunityContactRow[]>([]);
  const [orders, setOrders] = useState<OpportunityOrderRow[]>([]);
  const [visits, setVisits] = useState<VisitActivityRow[]>([]);
  const [crmLeadsLoading, setCrmLeadsLoading] = useState(true);

  useEffect(() => {
    async function fetchCrmLeads() {
      if (userLoading) return;

      if (!userWithRole?.crmUser) {
        setCrmLeads([]);
        setCrmLeadsLoading(false);
        return;
      }

      setCrmLeadsLoading(true);

      let query = supabase
        .from("crm_leads_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (!canViewAllLeads(userWithRole.crmUser)) {
        query = query.eq("comercial_name", userWithRole.crmUser.name);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase crm leads error:", error);
        setCrmLeadsLoading(false);
        return;
      }

      setCrmLeads(data ?? []);
      setCrmLeadsLoading(false);
    }

    fetchCrmLeads();
  }, [userLoading, userWithRole]);

  useEffect(() => {
    async function fetchActivityData() {
      if (userLoading || !userWithRole?.crmUser) return;

      const [contactsResponse, ordersResponse, visitsResponse] = await Promise.all([
        supabase
          .from("opportunity_contacts")
          .select("id, opportunity_id, fecha, memo, created_at"),
        supabase.from("opportunity_orders").select("id, opportunity_id, created_at"),
        supabase.from("visitas").select("id, opportunity_id, fecha_visita, created_at"),
      ]);

      if (contactsResponse.error) {
        console.error("Supabase contacts activity error:", contactsResponse.error);
      } else {
        setContacts((contactsResponse.data ?? []) as OpportunityContactRow[]);
      }

      if (ordersResponse.error) {
        console.error("Supabase orders activity error:", ordersResponse.error);
      } else {
        setOrders((ordersResponse.data ?? []) as OpportunityOrderRow[]);
      }

      if (visitsResponse.error) {
        console.error("Supabase visits activity error:", visitsResponse.error);
      } else {
        setVisits((visitsResponse.data ?? []) as VisitActivityRow[]);
      }
    }

    fetchActivityData();
  }, [userLoading, userWithRole]);

  const currentRange = useMemo(() => {
    const today = new Date();
    const defaultRange = createLast7DaysRange(today);

    if (period === "last7") return defaultRange;
    if (period === "currentMonth") return createCurrentMonthRange(today);
    return createCustomRange(customFrom, customTo, defaultRange);
  }, [period, customFrom, customTo]);

  const allLeads = useMemo<DashboardLead[]>(() => {
    const normalized: DashboardLead[] = [];

    for (const lead of crmLeads) {
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

      normalized.push({
        id: String(lead.id),
        createdAt: lead.created_at,
        phase: normalizedPhase,
        status: normalizedStatus,
        source: lead.source_name || "Sin origen",
        commercialName: lead.comercial_name?.trim() || "Sin comercial",
        domain: lead.dominio_desc?.trim() || "Sin dominio",
      });
    }

    return normalized;
  }, [crmLeads]);

  const currentLeads = useMemo<DashboardLead[]>(() => {
    return allLeads.filter((lead) => {
      const created = lead.createdAt ? new Date(lead.createdAt) : null;
      if (!created || isNaN(created.getTime())) return false;
      return isWithinRange(created, currentRange);
    });
  }, [allLeads, currentRange]);

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

  const pipelineData = useMemo<PipelineItem[]>(() => {
    const identificada = funnelData.find((x) => x.phase === "identificada")?.value ?? 0;
    const cualificada = funnelData.find((x) => x.phase === "cualificada")?.value ?? 0;
    const valorada = funnelData.find((x) => x.phase === "valorada")?.value ?? 0;
    const encargo = funnelData.find((x) => x.phase === "encargo")?.value ?? 0;

    return [
      { label: "Identificadas", value: identificada, tone: "brand" },
      { label: "Cualificadas", value: cualificada, tone: "blue" },
      { label: "Valoradas", value: valorada, tone: "purple" },
      { label: "Encargos", value: encargo, tone: "green" },
      { label: "Ventas", value: 0, tone: "slate" },
    ];
  }, [funnelData]);

  const projectionStats = useMemo(() => {
    const today = new Date();
    const projectionEnd =
      period === "currentMonth"
        ? endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0))
        : currentRange.end;
    const elapsedEnd =
      today < currentRange.start
        ? currentRange.start
        : today > currentRange.end
          ? currentRange.end
          : today;

    return {
      elapsedDays: getInclusiveDayCount(currentRange.start, elapsedEnd),
      projectionDays: getInclusiveDayCount(currentRange.start, projectionEnd),
    };
  }, [currentRange, period]);

  const funnelMetrics = useMemo<FunnelMetricItem[]>(() => {
    const today = relativeDateKey(0);

    return pipelineData.map((item) => {
      const phase = PHASE_ORDER.find(
        (phaseName) => PHASE_LABELS[phaseName] === item.label
      );
      const todayCount = phase
        ? allLeads.filter(
            (lead) => lead.phase === phase && dateKey(lead.createdAt) === today
          ).length
        : 0;
      const average = item.value / projectionStats.elapsedDays;
      const projected = Math.round(average * projectionStats.projectionDays);

      return {
        ...item,
        today: todayCount,
        average,
        projected,
        gap: projected - item.value,
      };
    });
  }, [allLeads, pipelineData, projectionStats]);

  const forecastRows = useMemo<ForecastMetricRow[]>(() => {
    return funnelMetrics
      .filter((item) =>
        ["Cualificadas", "Valoradas", "Encargos"].includes(item.label)
      )
      .map((item) => ({
        label: item.label,
        average: item.average,
        realized: item.value,
        projected: item.projected,
        gap: item.gap,
      }));
  }, [funnelMetrics]);

  const ratioRows = useMemo<RatioMetricRow[]>(() => {
    const identificada = funnelData.find((x) => x.phase === "identificada")?.value ?? 0;
    const cualificada = funnelData.find((x) => x.phase === "cualificada")?.value ?? 0;
    const valorada = funnelData.find((x) => x.phase === "valorada")?.value ?? 0;
    const encargo = funnelData.find((x) => x.phase === "encargo")?.value ?? 0;
    const projectedIdentificada =
      funnelMetrics.find((item) => item.label === "Identificadas")?.projected ?? 0;
    const projectedValorada =
      funnelMetrics.find((item) => item.label === "Valoradas")?.projected ?? 0;
    const projectedEncargo =
      funnelMetrics.find((item) => item.label === "Encargos")?.projected ?? 0;

    return [
      {
        label: "Noticias / Valoradas",
        actual: ratioLabel(identificada, valorada),
        estimated: ratioLabel(projectedIdentificada, projectedValorada),
        gap:
          valorada > 0 && projectedValorada > 0
            ? formatNumber(
                identificada / valorada - projectedIdentificada / projectedValorada,
                1
              )
            : "—",
      },
      {
        label: "Valoradas / Encargos",
        actual: ratioLabel(valorada, encargo),
        estimated: ratioLabel(projectedValorada, projectedEncargo),
        gap:
          encargo > 0 && projectedEncargo > 0
            ? formatNumber(valorada / encargo - projectedValorada / projectedEncargo, 1)
            : "—",
      },
      {
        label: "Identificada → Encargo",
        actual: `${calcConversion(identificada, encargo)}%`,
        estimated: `${calcConversion(projectedIdentificada, projectedEncargo)}%`,
        gap: `${calcConversion(identificada, encargo) - calcConversion(projectedIdentificada, projectedEncargo)}%`,
      },
    ];
  }, [funnelData, funnelMetrics]);

  const currentRole = String(userWithRole?.crmUser.rol || "").trim().toLowerCase();
  const canViewTeamDashboard = Boolean(
    userWithRole?.crmUser &&
      (canViewAllLeads(userWithRole.crmUser) || currentRole !== "comercial")
  );
  const excludedManagerKey = canViewTeamDashboard
    ? normalizePersonKey(userWithRole?.crmUser.name)
    : "";

  useEffect(() => {
    if (!canViewTeamDashboard && activeDashboardTab === "commercials") {
      setActiveDashboardTab("general");
    }
  }, [activeDashboardTab, canViewTeamDashboard]);

  const commercialStatusRows = useMemo<StatusBreakdownRow[]>(() => {
    const map = new Map<string, StatusBreakdownRow>();

    for (const lead of currentLeads) {
      const name = lead.commercialName.trim();
      const key = normalizePersonKey(name);

      if (!key || key === "sin comercial") continue;
      if (canViewTeamDashboard && key === excludedManagerKey) continue;

      const row = map.get(key) ?? { name, activa: 0, caliente: 0, total: 0 };
      if (lead.status === "activa") row.activa += 1;
      if (lead.status === "caliente") row.caliente += 1;
      row.total += 1;
      map.set(key, row);
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [canViewTeamDashboard, currentLeads, excludedManagerKey]);
  const sourceStatusRows = useMemo<StatusBreakdownRow[]>(() => {
    const map = new Map<string, StatusBreakdownRow>();

    for (const lead of currentLeads) {
      const name = normalizeSource(lead.source);
      const row = map.get(name) ?? { name, activa: 0, caliente: 0, total: 0 };
      if (lead.status === "activa") row.activa += 1;
      if (lead.status === "caliente") row.caliente += 1;
      row.total += 1;
      map.set(name, row);
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [currentLeads]);
  const commercialLeads = useMemo(() => {
    return currentLeads.filter((lead) =>
      matchesDomainFilter(lead.domain, commercialDomainFilter)
    );
  }, [commercialDomainFilter, currentLeads]);
  const commercialPerformance = useMemo<CommercialPerformance[]>(() => {
    if (!canViewTeamDashboard) return [];

    const map = new Map<string, CommercialPerformance>();

    for (const lead of commercialLeads) {
      const name = lead.commercialName.trim();
      const key = normalizePersonKey(name);

      if (!key || key === "sin comercial" || key === excludedManagerKey) continue;

      const row =
        map.get(key) ??
        {
          name,
          total: 0,
          activa: 0,
          caliente: 0,
          desestimada: 0,
          identificada: 0,
          cualificada: 0,
          valorada: 0,
          encargo: 0,
          conversion: 0,
        };

      row.total += 1;
      row[lead.status] += 1;
      row[lead.phase] += 1;
      row.conversion = calcConversion(row.total, row.encargo);
      map.set(key, row);
    }

    return [...map.values()].sort((a, b) => {
      if (b.encargo !== a.encargo) return b.encargo - a.encargo;
      if (b.valorada !== a.valorada) return b.valorada - a.valorada;
      return b.total - a.total;
    });
  }, [canViewTeamDashboard, commercialLeads, excludedManagerKey]);
  const leadById = useMemo(() => {
    const map = new Map<string, DashboardLead>();
    allLeads.forEach((lead) => map.set(lead.id, lead));
    return map;
  }, [allLeads]);
  const buildDailyActivityRows = useMemo(() => {
    return (targetDate: string): DailyActivityRow[] => {
      const rows = new Map<string, DailyActivityRow>();

      function ensureRow(lead: DashboardLead) {
        const name = lead.commercialName.trim();
        const key = normalizePersonKey(name);

        if (!key || key === "sin comercial" || key === excludedManagerKey) return null;
        if (!matchesDomainFilter(lead.domain, commercialDomainFilter)) return null;

        const existing = rows.get(key);
        if (existing) return existing;

        const row: DailyActivityRow = {
          commercial: name,
          noticias: 0,
          concertaciones: 0,
          valoraciones: 0,
          encargos: 0,
          visitas: 0,
          rg: 0,
          total: 0,
        };
        rows.set(key, row);
        return row;
      }

      function add(lead: DashboardLead | undefined, kind: ActivityKind) {
        if (!lead) return;
        const row = ensureRow(lead);
        if (!row) return;

        row[kind] += 1;
        row.total += 1;
      }

      allLeads.forEach((lead) => {
        if (dateKey(lead.createdAt) !== targetDate) return;
        if (lead.phase === "identificada") add(lead, "noticias");
        if (lead.phase === "cualificada") add(lead, "concertaciones");
      });

      contacts.forEach((contact) => {
        const memo = contact.memo?.trim() || "";
        const lead = leadById.get(String(contact.opportunity_id));
        const eventDate = dateKey(contact.fecha || contact.created_at);

        if (eventDate !== targetDate) return;
        if (memo.startsWith("[VALORACION]")) add(lead, "valoraciones");
        if (memo.startsWith("[R.G.]")) add(lead, "rg");
      });

      orders.forEach((order) => {
        const lead = leadById.get(String(order.opportunity_id));
        if (dateKey(order.created_at) === targetDate) add(lead, "encargos");
      });

      visits.forEach((visit) => {
        const lead = leadById.get(String(visit.opportunity_id));
        if (dateKey(visit.fecha_visita || visit.created_at) === targetDate) {
          add(lead, "visitas");
        }
      });

      return [...rows.values()].sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.commercial.localeCompare(b.commercial, "es");
      });
    };
  }, [
    commercialDomainFilter,
    allLeads,
    contacts,
    excludedManagerKey,
    leadById,
    orders,
    visits,
  ]);
  const todayActivityDate = relativeDateKey(0);
  const yesterdayActivityDate = relativeDateKey(-1);
  const todayActivityRows = buildDailyActivityRows(todayActivityDate);
  const yesterdayActivityRows = buildDailyActivityRows(yesterdayActivityDate);
  const todayActivityTotal = todayActivityRows.reduce((sum, row) => sum + row.total, 0);
  const yesterdayActivityTotal = yesterdayActivityRows.reduce(
    (sum, row) => sum + row.total,
    0
  );
  const topActivityCommercial =
    todayActivityRows.length > 0 ? todayActivityRows[0].commercial : "—";
  const activityDelta =
    yesterdayActivityTotal > 0
      ? Math.round(((todayActivityTotal - yesterdayActivityTotal) / yesterdayActivityTotal) * 100)
      : todayActivityTotal > 0
        ? 100
        : 0;
  const dashboardScope =
    userWithRole?.crmUser && !canViewAllLeads(userWithRole.crmUser)
      ? userWithRole.crmUser.name
      : "Equipo completo";
  const activeDashboardTitle =
    activeDashboardTab === "commercials" ? "Comerciales" : "Métricas generales";

  return (
    <>
      <Topbar title="Dashboard" />

      <main className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#006699]">
        <div className="flex shrink-0 flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="text-white">
            <h1 className="text-2xl font-semibold">{activeDashboardTitle}</h1>
            <p className="mt-1 text-sm text-white/75">
              {activeDashboardTab === "commercials"
                ? "Comparativa por comercial del periodo seleccionado"
                : `${dashboardScope} · rendimiento del periodo seleccionado`}
            </p>
            <div className="mt-4 inline-flex rounded-xl bg-white/15 p-1 text-sm font-semibold shadow-sm">
              <button
                type="button"
                onClick={() => setActiveDashboardTab("general")}
                className={cn(
                  "rounded-lg px-4 py-2 transition-colors",
                  activeDashboardTab === "general"
                    ? "bg-white text-[#006699]"
                    : "text-white/80 hover:text-white"
                )}
              >
                Métricas generales
              </button>
              {canViewTeamDashboard && (
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab("commercials")}
                  className={cn(
                    "rounded-lg px-4 py-2 transition-colors",
                    activeDashboardTab === "commercials"
                      ? "bg-white text-[#006699]"
                      : "text-white/80 hover:text-white"
                  )}
                >
                  Comerciales
                </button>
              )}
            </div>
          </div>

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

          {activeDashboardTab === "general" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(460px,0.9fr)_minmax(520px,1.1fr)]">
                <ExecutiveFunnel items={funnelMetrics} />
                <ForecastPanel rows={forecastRows} ratios={ratioRows} />
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <StatusBreakdownTable
                  title="ALL Planners - Assigned"
                  label="Planner"
                  rows={commercialStatusRows}
                />
                <StatusBreakdownTable
                  title="ALL Orígenes"
                  label="Origen"
                  rows={sourceStatusRows}
                />
              </div>
            </div>
          )}

          {activeDashboardTab === "commercials" && canViewTeamDashboard && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-xl bg-white/95 p-3 shadow-xl lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Dominio
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Filtra la actividad y el rendimiento por pilar.
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                  {COMMERCIAL_DOMAIN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCommercialDomainFilter(option.value)}
                      className={cn(
                        "rounded-lg px-4 py-2 transition-colors",
                        commercialDomainFilter === option.value
                          ? "bg-[#006699] text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MetricCard
                  item={{
                    label: "Actividad hoy",
                    value: todayActivityTotal,
                    detail: "acciones comerciales",
                    tone: "brand",
                  }}
                />
                <MetricCard
                  item={{
                    label: "Top comercial",
                    value: topActivityCommercial,
                    detail: "por actividad de hoy",
                    tone: "green",
                  }}
                />
                <MetricCard
                  item={{
                    label: "Variación vs ayer",
                    value: `${activityDelta}%`,
                    detail: `${yesterdayActivityTotal} acciones ayer`,
                    tone: activityDelta >= 0 ? "blue" : "red",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
                <DailyActivityTable
                  title="Cómo estamos hoy"
                  date={todayActivityDate}
                  rows={todayActivityRows}
                />
                <DailyActivityTable
                  title="Cómo estuvimos ayer"
                  date={yesterdayActivityDate}
                  rows={yesterdayActivityRows}
                />
              </div>

              <Card className="border-white/10 bg-white/95 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Rendimiento por comercial</CardTitle>
                  <p className="text-xs text-slate-500">
                    Comparativa del periodo seleccionado. No incluye usuarios de coordinación.
                  </p>
                </CardHeader>
                <CardContent>
                  {commercialPerformance.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      Sin métricas de comerciales en este periodo.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Comercial</th>
                            <th className="px-3 py-3 text-right font-semibold">Leads</th>
                            <th className="px-3 py-3 text-right font-semibold">Activos</th>
                            <th className="px-3 py-3 text-right font-semibold">Calientes</th>
                            <th className="px-3 py-3 text-right font-semibold">Valorados</th>
                            <th className="px-3 py-3 text-right font-semibold">Encargos</th>
                            <th className="px-3 py-3 text-right font-semibold">
                              Desestimados
                            </th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Conversión
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {commercialPerformance.map((row) => (
                            <tr key={row.name} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {row.name}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                                {row.total}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums text-emerald-700">
                                {row.activa}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                                {row.caliente}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums text-blue-700">
                                {row.valorada}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">
                                {row.encargo}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums text-red-700">
                                {row.desestimada}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                                {row.conversion}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
