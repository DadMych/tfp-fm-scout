import { Masthead, type MastheadPage } from "@/components/kit/Masthead";

/** @deprecated Use Masthead from components/kit/Masthead */
export function AppHeader({ current }: { current: "home" | "scout" | "assistant" | "upload" | "watch" }) {
  return <Masthead current={current as MastheadPage} />;
}
