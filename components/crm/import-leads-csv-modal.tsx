"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseCsvText } from "@/lib/csv";
import {
  IMPORT_TARGET_FIELDS,
  suggestMapping,
  type ColumnMapping,
  type ImportTargetField,
  mapCsvRowToTargets,
  validateMappedRow,
  buildLeadFromMapped,
} from "@/lib/leads-csv-import";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, FileUp, Table2 } from "lucide-react";
import type { Lead } from "@/lib/crm-data";

type Step = 1 | 2 | 3 | 4;

function stepLabel(step: Step) {
  switch (step) {
    case 1:
      return "Subir archivo";
    case 2:
      return "Parsear CSV";
    case 3:
      return "Mapear columnas";
    case 4:
      return "Previsualizar";
  }
}

export function ImportLeadsCsvModal({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (leads: Lead[]) => void;
}) {
  const [step, setStep] = React.useState<Step>(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [rawText, setRawText] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [error, setError] = React.useState<string | null>(null);

  const previewRows = React.useMemo(() => rows.slice(0, 20), [rows]);

  const mappedPreview = React.useMemo(() => {
    return previewRows.map((r) => mapCsvRowToTargets(r, mapping));
  }, [previewRows, mapping]);

  const validation = React.useMemo(() => {
    const results = rows.map((r) => {
      const mapped = mapCsvRowToTargets(r, mapping);
      const v = validateMappedRow(mapped);
      return { mapped, ...v };
    });
    const valid = results.filter((x) => x.valid).length;
    return {
      total: results.length,
      valid,
      invalid: results.length - valid,
      results,
    };
  }, [rows, mapping]);

  function resetAll() {
    setStep(1);
    setFile(null);
    setRawText("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError(null);
  }

  React.useEffect(() => {
    if (!open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleFileSelected(f: File | null) {
    setError(null);
    setFile(f);
    setRawText("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    if (!f) return;

    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Solo se permiten archivos .csv");
      return;
    }
    if (f.size === 0) {
      setError("El archivo está vacío.");
      return;
    }

    const text = await f.text(); // UTF-8 by default
    if (!text.trim()) {
      setError("El archivo está vacío.");
      return;
    }
    setRawText(text);
  }

  function parseNow() {
    try {
      setError(null);
      const parsed = parseCsvText(rawText);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(suggestMapping(parsed.headers));
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo parsear el CSV.");
    }
  }

  function setMap(target: ImportTargetField, header: string | undefined) {
    setMapping((prev) => {
      const next = { ...prev };
      if (!header) {
        delete next[target];
      } else {
        next[target] = header;
      }
      return next;
    });
  }

  function canGoPreview() {
    // Do not block preview due to incomplete mappings.
    return true;
  }

  function doImport() {
    const validMapped = validation.results.filter((r) => r.valid).map((r) => r.mapped);
    const leads = validMapped.map(buildLeadFromMapped);
    onImport(leads);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Importar CSV</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Importa leads desde un archivo CSV y asigna columnas a los campos del CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            Paso {step} de 4 · <span className="font-medium">{stepLabel(step)}</span>
          </div>
          {file && (
            <div className="text-[11px] text-muted-foreground truncate max-w-[60%]">
              Archivo: <span className="font-medium text-foreground">{file.name}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Archivo CSV</span>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
                />
              </div>
            </label>

            <div className="text-[11px] text-muted-foreground">
              Soporta delimitador por coma o punto y coma, y CSV con UTF-8.
            </div>
          </div>
        )}

        {/* Step 2 (parse) */}
        {step === 2 && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Table2 className="h-4 w-4" />
              Listo para parsear el archivo y detectar columnas.
            </div>
          </div>
        )}

        {/* Step 3 mapping */}
        {step === 3 && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs font-semibold text-foreground">Columnas detectadas</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {headers.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {h}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Filas: <span className="font-medium text-foreground">{rows.length}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs font-semibold text-foreground">Asignación de columnas</div>
              <div className="mt-3 space-y-2.5">
                {IMPORT_TARGET_FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        {f.label}
                        {f.required && <span className="text-destructive"> *</span>}
                      </div>
                      {f.key === "planner" && (
                        <div className="text-[11px] text-muted-foreground">
                          Campo legacy. Se ignorará en el modelo actual.
                        </div>
                      )}
                    </div>
                    <Select
                      value={mapping[f.key] ?? "__none__"}
                      onValueChange={(v) => setMap(f.key, v === "__none__" ? undefined : v)}
                    >
                      <SelectTrigger className="h-8 w-52 text-xs">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin asignar</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                Puedes dejar campos sin asignar. La validez de cada fila se calculará en la previsualización.
              </div>
            </div>
          </div>
        )}

        {/* Step 4 preview */}
        {step === 4 && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Total: <span className="font-medium text-foreground">{validation.total}</span> ·{" "}
                Válidas: <span className="font-medium text-foreground">{validation.valid}</span> ·{" "}
                Inválidas:{" "}
                <span className={cn("font-medium", validation.invalid ? "text-destructive" : "text-foreground")}>
                  {validation.invalid}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Previsualizando primeras {previewRows.length} filas
              </div>
            </div>

            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border bg-card/95 backdrop-blur text-left">
                    <th className="px-3 py-2 whitespace-nowrap">Estado</th>
                    {IMPORT_TARGET_FIELDS.filter((f) => f.key !== "planner").map((f) => (
                      <th key={f.key} className="px-3 py-2 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-background">
                  {mappedPreview.map((m, idx) => {
                    const v = validateMappedRow(m);
                    return (
                      <tr key={idx} className="border-b border-border">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
                              v.valid
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-destructive/30 bg-destructive/5 text-destructive"
                            )}
                          >
                            {v.valid ? "Válida" : "Inválida"}
                          </span>
                        </td>
                        {IMPORT_TARGET_FIELDS.filter((f) => f.key !== "planner").map((f) => (
                          <td key={f.key} className="px-3 py-2 whitespace-nowrap max-w-[260px] truncate">
                            {m[f.key]?.toString() || "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {validation.invalid > 0 && (
              <div className="text-[11px] text-muted-foreground">
                Hay filas inválidas por campos requeridos vacíos. Solo se importarán las filas válidas.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={step === 1}
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            >
              Atrás
            </Button>

            {step === 1 && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={!file || !rawText.trim()}
                onClick={() => setStep(2)}
              >
                <FileUp className="h-3.5 w-3.5" />
                Continuar
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={!rawText.trim()}
                onClick={parseNow}
              >
                <Table2 className="h-3.5 w-3.5" />
                Parsear CSV
              </Button>
            )}

            {step === 3 && (
              <Button
                type="button"
                size="sm"
                disabled={!canGoPreview()}
                onClick={() => setStep(4)}
              >
                Ver previsualización
              </Button>
            )}

            {step === 4 && (
              <Button
                type="button"
                size="sm"
                disabled={validation.valid === 0}
                onClick={doImport}
              >
                Importar {validation.valid} leads
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

