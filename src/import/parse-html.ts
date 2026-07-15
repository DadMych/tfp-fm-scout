import type { Table } from "./parse-csv.js";

export function parseHtml(text: string): Table {
  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  const table = tableMatch ? tableMatch[0] : text;
  const rows: string[][] = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(table)) !== null) {
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells: string[] = [];
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(tr[0])) !== null) cells.push(decodeHtml(stripTags(cell[1] ?? "")));
    if (cells.length) rows.push(cells);
  }
  const header = rows[0];
  if (header === undefined) return { headers: [], rows: [] };
  return { headers: header, rows: rows.slice(1) };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
