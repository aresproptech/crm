export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: "," | ";";
};

function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function detectDelimiter(headerLine: string): "," | ";" {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const semi = (headerLine.match(/;/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

// Minimal RFC4180-ish parser with quoted fields support.
function parseLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // Escaped quote inside a quoted field: ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((v) => v.trim());
}

export function parseCsvText(text: string): ParsedCsv {
  const raw = normalizeNewlines(text).trim();
  if (!raw) {
    throw new Error("El archivo CSV está vacío.");
  }

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("El CSV debe tener cabecera y al menos una fila.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map((h) => h.replace(/^\uFEFF/, "")); // strip BOM

  const uniqueHeaders = headers.map((h, idx) => (h ? h : `Columna ${idx + 1}`));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    for (let c = 0; c < uniqueHeaders.length; c++) {
      row[uniqueHeaders[c]] = values[c] ?? "";
    }
    rows.push(row);
  }

  return { headers: uniqueHeaders, rows, delimiter };
}

