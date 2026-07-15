import type { AttrValue } from "@/src/domain/attr-value.js";

export function parseAttrDisplay(v: AttrValue | undefined): {
  text: string;
  masked: boolean;
  ranged: boolean;
} {
  if (v == null) return { text: "?", masked: true, ranged: false };
  if (v.min === v.max) return { text: String(v.min), masked: false, ranged: false };
  return { text: `${v.min}–${v.max}`, masked: false, ranged: true };
}

export function AttrValueCell({ v }: { v: AttrValue | undefined }) {
  const d = parseAttrDisplay(v);
  const cls = ["aval", "num", d.masked ? "masked" : "", d.ranged ? "ranged" : ""]
    .filter(Boolean)
    .join(" ");
  return <td className={cls}>{d.text}</td>;
}
