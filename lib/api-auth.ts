import { auth, isHostedAuthConfigured } from "@/auth";
import { NextResponse } from "next/server";

export async function requireUserId(): Promise<string | NextResponse> {
  if (!isHostedAuthConfigured()) {
    return NextResponse.json({ error: "Hosted mode is not configured." }, { status: 503 });
  }
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return id;
}

export function isUserId(result: string | NextResponse): result is string {
  return typeof result === "string";
}
