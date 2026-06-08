export type CsvEscapeOptions = {
  quoteAll?: boolean;
};

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

function shouldNeutralizeSpreadsheetFormula(text: string) {
  const firstVisibleCharacter = text.trimStart().charAt(0);
  return FORMULA_PREFIXES.has(firstVisibleCharacter);
}

export function escapeCsvCell(value: unknown, options: CsvEscapeOptions = {}) {
  const text = String(value ?? "");
  const safeText = shouldNeutralizeSpreadsheetFormula(text) ? `'${text}` : text;
  const shouldQuote = options.quoteAll || safeText !== text || /[",\r\n\t]/.test(safeText);
  const escapedText = safeText.replace(/"/g, '""');
  return shouldQuote ? `"${escapedText}"` : escapedText;
}

export function buildCsv(rows: unknown[][], options: CsvEscapeOptions = {}) {
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell, options)).join(",")).join("\n");
}
