const RESERVED_FIELD_NAMES = new Set([
  "medio",
  "hora",
  "resultado",
  "dominio",
  "planner",
  "owner",
  "fecha",
]);

function normalizeFieldName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type OpportunityContactMetadata = Record<string, unknown>;

export function readOpportunityContactMetadata(
  value: unknown
): OpportunityContactMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as OpportunityContactMetadata;
}

export function opportunityContactMetadataText(
  value: unknown,
  key: string
) {
  const metadata = readOpportunityContactMetadata(value);
  const field = metadata[key];
  return typeof field === "string" ? field.trim() : "";
}

export function matchesOpportunityContactEvent(
  eventType: string | null | undefined,
  memo: string | null | undefined,
  expectedType: string,
  legacyPrefix: string
) {
  if (eventType === expectedType) return true;
  if (eventType && eventType !== "legacy") return false;
  return (memo || "").trim().startsWith(legacyPrefix);
}

export function parseOpportunityContactMemo(
  memo: string | null | undefined,
  prefix: "[VALORACION]" | "[R.G.]",
  metadataValue?: unknown
) {
  const metadata = readOpportunityContactMetadata(metadataValue);
  const text = (memo || "").trim();
  let body = text.startsWith(prefix) ? text.slice(prefix.length).trim() : text;
  let author = "";

  const authorMatch = body.match(/^([^:]+):\s*([\s\S]*)$/);
  if (authorMatch) {
    const possibleAuthor = authorMatch[1].trim();
    if (!RESERVED_FIELD_NAMES.has(normalizeFieldName(possibleAuthor))) {
      author = possibleAuthor;
      body = authorMatch[2].trim();
    }
  }

  const [summaryLine, ...memoLines] = body.split("\n");
  const fields = summaryLine.split("|").reduce<Record<string, string>>((acc, part) => {
    const separatorIndex = part.indexOf(":");
    if (separatorIndex === -1) return acc;

    const key = normalizeFieldName(part.slice(0, separatorIndex));
    const value = part.slice(separatorIndex + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});

  for (const key of RESERVED_FIELD_NAMES) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      fields[normalizeFieldName(key)] = value.trim();
    }
  }

  const metadataAuthor =
    typeof metadata.actor_name === "string" ? metadata.actor_name.trim() : "";
  const metadataMemo =
    typeof metadata.notes === "string"
      ? metadata.notes.trim()
      : typeof metadata.text === "string"
        ? metadata.text.trim()
        : "";

  return {
    author: metadataAuthor || author,
    fields,
    memo: metadataMemo || memoLines.join("\n").trim(),
  };
}
