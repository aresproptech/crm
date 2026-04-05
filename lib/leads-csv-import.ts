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
    { key: "ownerName", label: "Propietario" },
    { key: "phone", label: "Teléfono" },
    { key: "address", label: "Domicilio" },
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

// Default mapping for common exports (e.g. Kommo).
// Note: we intentionally do NOT auto-assign estado, owner, fechaContacto, fechaValoracion, hora, planner.
export const DEFAULT_MAPPING: Partial<Record<ImportTargetField, string>> = {
  ownerName: "Nombre completo",
  address: "Domicilio",
  cp: "Código Postal",
  valor: "Presupuesto €",
  source: "Origen",
  phase: "Embudo de ventas",
  fechaNoticia: "Fecha de Creación",
};

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

  // 1) Apply DEFAULT_MAPPING when the CSV contains those columns.
  for (const [target, desiredHeader] of Object.entries(DEFAULT_MAPPING) as Array<
    [ImportTargetField, string]
  >) {
    const match = headerNorm.get(norm(desiredHeader));
    if (match) mapping[target] = match;
  }

  // Phone fallback: oficina -> celular -> teléfono
  const phoneCandidates = ["Teléfono oficina", "Teléfono celular", "Teléfono"];
  for (const candidate of phoneCandidates) {
    const match = headerNorm.get(norm(candidate));
    if (match) {
      mapping.phone = match;
      break;
    }
  }

  for (const s of KOMMO_SUGGESTIONS) {
    // Do not override defaults / intentional non-auto fields.
    if (mapping[s.target]) continue;
    if (
      s.target === "status" ||
      s.target === "owner" ||
      s.target === "fechaContacto" ||
      s.target === "fechaValoracion" ||
      s.target === "hora" ||
      s.target === "planner"
    ) {
      continue;
    }
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
      if (
        target === "status" ||
        target === "owner" ||
        target === "fechaContacto" ||
        target === "fechaValoracion" ||
        target === "hora" ||
        target === "planner"
      ) {
        continue;
      }
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
  if (
    v === "identificar" ||
    v === "identificada" ||
    v === "identificado" ||
    v === "identificacion" ||
    v === "identificación"
  ) {
    return "identificar";
  }
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
  const hasName = Boolean(mapped.ownerName && mapped.ownerName.trim());
  const hasPhone = Boolean(mapped.phone && mapped.phone.trim());
  const valid = hasName || hasPhone;
  const missing: ImportTargetField[] = [];
  if (!hasName) missing.push("ownerName");
  if (!hasPhone) missing.push("phone");
  return { valid, missingRequired: valid ? [] : missing };
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
  const currentUser = "Ana Martínez";
  const owner = mapped.owner?.trim() || currentUser;

  const address = mapped.address?.trim() || "";
  const distrito = mapped.distrito?.trim() || "";
  const cp = mapped.cp?.trim() || "";

  const fechaNoticia = mapped.fechaNoticia?.trim() || now;
  const fechaContacto = mapped.fechaContacto?.trim() || "";
  const fechaValoracion = mapped.fechaValoracion?.trim() || "";

  const phase = mapped.phase ? normalizePhase(mapped.phase) : "noticia";
  // If address is missing, force status to "Identificar" even if Estado isn't mapped.
  const status =
    !address
      ? "identificar"
      : mapped.status
        ? normalizeStatus(mapped.status)
        : "seguimiento";
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
    notes: "",
    observaciones: [],
  };
}

