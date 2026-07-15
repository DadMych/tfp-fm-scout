/**
 * Decode export bytes (doc 03 §3): UTF-8 first, Windows-1252 when replacement chars appear.
 */

export function decodeExportText(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8;

  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return utf8;
  }
}

export function decodeExportString(text: string): string {
  if (!text.includes("\uFFFD")) return text;
  const bytes = new TextEncoder().encode(text);
  return decodeExportText(bytes);
}
