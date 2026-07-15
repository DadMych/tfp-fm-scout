"use client";

import { useParams } from "next/navigation";
import { Masthead } from "@/components/kit/Masthead";
import { Dossier } from "@/components/Dossier";
import type { DatasetKind } from "@/lib/store";

export default function DossierPage() {
  const params = useParams<{ kind: string; id: string }>();
  const kind: DatasetKind = params.kind === "squad" ? "squad" : "shortlist";
  const id = String(params.id ?? "");

  return (
    <div className="wrap">
      <Masthead current="scout" />
      <Dossier kind={kind} id={id} />
    </div>
  );
}
