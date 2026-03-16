import {
  type Lead,
  type LeadPhase,
  type LeadStatus,
  PHASE_LABELS,
  PHASE_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/crm-data";

export type ImportTargetField =
  | "ownerName"
  | "address"
  | "distrito"
  | "cp"
  | "phone"
  | "valor"
  | "source"
  | "phase"
  | "status"
  | "fechaNoticia"
  | "fechaContacto"
  | "fechaValoracion"
  | "hora"
  | "planner" // legacy / ignored in Lead model
  | "owner";

export const IMPORT_TARGET_FIELDS: { key: ImportTargetField; label: string; required?: boolean }[] =
  [
    { key: "ownerName", label: "Propietario", required: true },
    { key: "phone", label: "Teléfono", required: true },
    { key: "address", label: "Domicilio", required: true },
    { key: "distrito", label: "Distrito" },
    { key: "cp", label: "CP" },
    { key: "valor", label: "Valor" },
    { key: "source", label: "Origen" },
    { key: "phase", label: "Fase" },
    { key: "status", label: "Estado" },
    { key: "fechaNoticia", label: "Fecha noticia" },
    { key: "fechaContacto", label: "Fecha contacto" },
    { key: "fechaValoracion", label: "Fecha valoración" },
    { key: "hora", label: "Hora" },
    { key: "planner", label: "Planner (ignorado)" },
    { key: "owner", label: "Owner" },
  ];

export type ColumnMapping = Partial<Record<ImportTargetField, string>>; // target -> csv header

function norm(s: string) {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const KOMMO_SUGGESTIONS: Array<{ csv: string; target: ImportTargetField }> = [
  { csv: "Nombre completo", target: "ownerName" },
  { csv: "Teléfono celular", target: "phone" },
  { csv: "Domicilio", target: "address" },
  { csv: "Código Postal", target: "cp" },
  { csv: "Presupuesto €", target: "valor" },
  { csv: "Origen", target: "source" },
  { csv: "Estatus del lead", target: "status" },
  { csv: "Embudo de ventas", target: "phase" },
  { csv: "Fecha de Creación", target: "fechaNoticia" },
  { csv: "Respons. usuario", target: "owner" },
  { csv: "Ubicación", target: "distrito" },
];

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const headerNorm = new Map(headers.map((h) => [norm(h), h]));

  for (const s of KOMMO_SUGGESTIONS) {
    const match = headerNorm.get(norm(s.csv));
    if (match) mapping[s.target] = match;
  }

  // Light heuristics for common Spanish variants
  const heuristics: Array<{ re: RegExp; target: ImportTargetField }> = [
    { re: /\b(propietario|nombre)\b/i, target: "ownerName" },
    { re: /\b(telefono|m(o|ó)vil|celular)\b/i, target: "phone" },
    { re: /\b(domicilio|direccion|dirección)\b/i, target: "address" },
    { re: /\b(cp|codigo postal|c(o|ó)digo postal)\b/i, target: "cp" },
    { re: /\b(valor|presupuesto|importe)\b/i, target: "valor" },
    { re: /\b(origen|fuente)\b/i, target: "source" },
    { re: /\b(fase|embudo|pipeline)\b/i, target: "phase" },
    { re: /\b(estado|estatus)\b/i, target: "status" },
    { re: /\b(fecha.*noticia|fecha.*creaci(o|ó)n|created)\b/i, target: "fechaNoticia" },
    { re: /\b(fecha.*contacto)\b/i, target: "fechaContacto" },
    { re: /\b(fecha.*valoraci(o|ó)n)\b/i, target: "fechaValoracion" },
    { re: /\b(hora)\b/i, target: "hora" },
    { re: /\b(owner|responsable|agente)\b/i, target: "owner" },
  ];

  for (const h of headers) {
    const n = norm(h);
    for (const { re, target } of heuristics) {
      if (mapping[target]) continue;
      if (re.test(n)) mapping[target] = h;
    }
  }

  return mapping;
}

function normalizePhase(value: string): LeadPhase {
  const v = norm(value);
  const direct = PHASE_OPTIONS.find((o) => norm(o.value) === v)?.value;
  if (direct) return direct;
  const byLabel = Object.entries(PHASE_LABELS).find(([, label]) => norm(label) === v);
  if (byLabel) return byLabel[0] as LeadPhase;
  return "noticia";
}

function normalizeStatus(value: string): LeadStatus {
  const v = norm(value);
  const direct = STATUS_OPTIONS.find((o) => norm(o.value) === v)?.value;
  if (direct) return direct as LeadStatus;
  const byLabel = STATUS_OPTIONS.find((o) => norm(o.label) === v)?.value;
  if (byLabel) return byLabel as LeadStatus;
  return "seguimiento";
}

function normalizeSource(value: string): string {
  const v = norm(value);
  const match = SOURCE_OPTIONS.find((o) => norm(o) === v);
  return match ?? (value?.trim() ? value.trim() : "Otro");
}

export type RowValidationResult = {
  valid: boolean;
  missingRequired: ImportTargetField[];
};

export function validateMappedRow(
  mapped: Partial<Record<ImportTargetField, string>>
): RowValidationResult {
  const missing: ImportTargetField[] = [];
  for (const f of IMPORT_TARGET_FIELDS) {
    if (!f.required) continue;
    const v = mapped[f.key];
    if (!v || !v.trim()) missing.push(f.key);
  }
  return { valid: missing.length === 0, missingRequired: missing };
}

export function mapCsvRowToTargets(
  row: Record<string, string>,
  mapping: ColumnMapping
): Partial<Record<ImportTargetField, string>> {
  const out: Partial<Record<ImportTargetField, string>> = {};
  for (const key of Object.keys(mapping) as ImportTargetField[]) {
    const header = mapping[key];
    if (!header) continue;
    out[key] = (row[header] ?? "").trim();
  }
  return out;
}

export function buildLeadFromMapped(
  mapped: Partial<Record<ImportTargetField, string>>
): Lead {
  const now = new Date().toISOString().slice(0, 10);
  const owner = mapped.owner?.trim() || "-";

  const address = mapped.address?.trim() || "";
  const distrito = mapped.distrito?.trim() || "";
  const cp = mapped.cp?.trim() || "";

  const fechaNoticia = mapped.fechaNoticia?.trim() || now;
  const fechaContacto = mapped.fechaContacto?.trim() || "";
  const fechaValoracion = mapped.fechaValoracion?.trim() || "";

  const phase = mapped.phase ? normalizePhase(mapped.phase) : "noticia";
  const status = mapped.status ? normalizeStatus(mapped.status) : "seguimiento";
  const source = mapped.source ? normalizeSource(mapped.source) : "Otro";

  return {
    id: crypto.randomUUID(),
    ownerName: mapped.ownerName?.trim() || "",
    address,
    distrito,
    municipio: "",
    provincia: "",
    cp,
    valor: mapped.valor?.trim() || "",
    phone: mapped.phone?.trim() || "",
    source,
    phase,
    status,
    fechaNoticia,
    fechaContacto,
    fechaValoracion,
    hora: mapped.hora?.trim() || "",
    owner,
    createdAt: fechaNoticia || now,
    assignedUser: owner,
    propertyAddress: address,
    notes: mapped.notes?.trim() || "",
    observaciones: [],
  };
}

