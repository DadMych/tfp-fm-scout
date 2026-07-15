export type DetectedFormat = "csv" | "html";

export function detectFormat(text: string): DetectedFormat {
  return /<table/i.test(text.slice(0, 4096)) ? "html" : "csv";
}
