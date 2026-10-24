/**
 * Importación del padrón desde la planilla que el club ya tiene (CSV con ; o ,).
 * Puro y testeado: parsea, normaliza y explica cada fila con problemas antes de escribir nada.
 */
export type ImportRow = {
  line: number;
  firstName: string;
  lastName: string;
  docNumber: string;
  birthDate: string; // YYYY-MM-DD
  phone: string | null;
  email: string | null;
  address: string | null;
  reprocannNumber: string | null;
  reprocannExpiresAt: string | null;
  reprocannStatus: "VIGENTE" | "VENCIDO" | "EN_TRAMITE" | "NO_APORTA";
  consumptionType: "LUDICO" | "TERAPEUTICO";
  monthlyForecastG: number | null;
  consentSignedAt: string | null;
};
export type ImportIssue = { line: number; field: string; message: string };
export type ImportResult = { rows: ImportRow[]; issues: ImportIssue[]; headers: string[] };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES: Record<string, string[]> = {
  lastName: ["apellido", "apellidos"],
  firstName: ["nombre", "nombres"],
  fullName: ["apellido y nombre", "nombre y apellido", "nombre completo", "socio"],
  docNumber: ["documento", "dni", "nro documento", "n documento", "numero documento", "doc"],
  birthDate: ["nacimiento", "fecha nacimiento", "fecha de nacimiento", "f nacimiento"],
  phone: ["telefono", "celular", "tel", "whatsapp"],
  email: ["email", "mail", "correo", "e mail"],
  address: ["domicilio", "direccion"],
  reprocannNumber: ["reprocann", "n reprocann", "nro reprocann", "numero reprocann"],
  reprocannExpiresAt: ["vence reprocann", "vencimiento reprocann", "vencimiento", "vence"],
  consumptionType: ["consumo", "tipo consumo", "tipo de consumo"],
  monthlyForecastG: ["prevision", "prevision g mes", "gramos mes", "prevision mensual"],
  consentSignedAt: ["consentimiento", "fecha consentimiento"],
};

export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/** Acepta 31/12/1990, 31-12-90, 1990-12-31. Devuelve YYYY-MM-DD o null. */
export function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (match) { y = +match[1]; m = +match[2]; d = +match[3]; }
  else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v);
    if (!match) return null;
    d = +match[1]; m = +match[2]; y = +match[3];
    if (y < 100) y += y > 30 ? 1900 : 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export function parsePadron(text: string, today: Date = new Date()): ImportResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const issues: ImportIssue[] = [];
  if (lines.length < 2) return { rows: [], headers: [], issues: [{ line: 1, field: "archivo", message: "La planilla no tiene filas de datos." }] };

  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitCsvLine(lines[0], sep);
  const index: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, names] of Object.entries(ALIASES)) if (index[field] == null && names.includes(n)) index[field] = i;
  });

  const hasNames = (index.lastName != null && index.firstName != null) || index.fullName != null;
  if (!hasNames) issues.push({ line: 1, field: "encabezado", message: "Falta la columna Apellido y Nombre (o Apellido + Nombre)." });
  if (index.docNumber == null) issues.push({ line: 1, field: "encabezado", message: "Falta la columna Documento / DNI." });
  if (index.birthDate == null) issues.push({ line: 1, field: "encabezado", message: "Falta la columna Nacimiento." });
  if (issues.length) return { rows: [], issues, headers };

  const rows: ImportRow[] = [];
  const seenDocs = new Set<string>();
  const todayKey = today.toISOString().slice(0, 10);

  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    const cells = splitCsvLine(raw, sep);
    const get = (f: string) => (index[f] == null ? "" : (cells[index[f]] ?? "").trim());
    const bad = (field: string, message: string) => issues.push({ line, field, message });

    let lastName = get("lastName");
    let firstName = get("firstName");
    if ((!lastName || !firstName) && get("fullName")) {
      const full = get("fullName");
      if (full.includes(",")) [lastName, firstName] = full.split(",").map((s) => s.trim());
      else { const parts = full.split(/\s+/); lastName = parts.shift() ?? ""; firstName = parts.join(" "); }
    }
    const docNumber = get("docNumber").replace(/[.\s-]/g, "");
    const birthDate = parseDate(get("birthDate"));
    const expires = get("reprocannExpiresAt") ? parseDate(get("reprocannExpiresAt")) : null;
    const consent = get("consentSignedAt") ? parseDate(get("consentSignedAt")) : null;
    const email = get("email") || null;
    const forecastRaw = get("monthlyForecastG").replace(",", ".");
    const forecast = forecastRaw ? Number(forecastRaw) : null;
    const consumo = norm(get("consumptionType"));

    const before = issues.length;
    if (lastName.length < 2 || firstName.length < 2) bad("nombre", "Falta apellido o nombre.");
    if (!/^\d{6,9}$/.test(docNumber)) bad("documento", `Documento inválido: "${get("docNumber")}".`);
    else if (seenDocs.has(docNumber)) bad("documento", `Documento ${docNumber} repetido en la planilla.`);
    if (!birthDate) bad("nacimiento", `Fecha de nacimiento ilegible: "${get("birthDate")}".`);
    else if (birthDate > todayKey) bad("nacimiento", "La fecha de nacimiento está en el futuro.");
    if (get("reprocannExpiresAt") && !expires) bad("vencimiento", `Vencimiento ilegible: "${get("reprocannExpiresAt")}".`);
    if (get("consentSignedAt") && !consent) bad("consentimiento", `Fecha de consentimiento ilegible: "${get("consentSignedAt")}".`);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad("email", `Email inválido: "${email}".`);
    if (forecast != null && (!Number.isFinite(forecast) || forecast < 0)) bad("previsión", "La previsión debe ser un número de gramos.");
    if (issues.length > before) return;

    seenDocs.add(docNumber);
    const reprocannNumber = get("reprocannNumber") || null;
    rows.push({
      line,
      firstName,
      lastName,
      docNumber,
      birthDate: birthDate!,
      phone: get("phone") || null,
      email,
      address: get("address") || null,
      reprocannNumber,
      reprocannExpiresAt: expires,
      reprocannStatus: !reprocannNumber ? "NO_APORTA" : !expires ? "EN_TRAMITE" : expires < todayKey ? "VENCIDO" : "VIGENTE",
      consumptionType: consumo.startsWith("terap") || consumo === "medicinal" ? "TERAPEUTICO" : "LUDICO",
      monthlyForecastG: forecast,
      consentSignedAt: consent,
    });
  });

  return { rows, issues, headers };
}
