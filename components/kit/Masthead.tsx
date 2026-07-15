import Link from "next/link";
import { AccountNav } from "@/components/AccountNav";
import { LogoIcon } from "@/components/kit/LogoIcon";

export type MastheadPage = "home" | "upload" | "scout" | "assistant" | "watch";

const NAV: readonly { readonly id: MastheadPage; readonly href: string; readonly label: string }[] = [
  { id: "home", href: "/", label: "Home" },
  { id: "upload", href: "/upload", label: "Upload" },
  { id: "assistant", href: "/assistant", label: "Assistant" },
  { id: "scout", href: "/scout", label: "Scout" },
  { id: "watch", href: "/watch", label: "Watch" },
];

export function Masthead({ current }: { current: MastheadPage }) {
  return (
    <div className="masthead">
      <Link href="/" className="logo">
        <LogoIcon size={32} />
        <span className="logo-text">
          The <span>Scouting</span> Post
        </span>
      </Link>
      <nav className="mast-nav" aria-label="Primary">
        {NAV.map((item) => (
          <Link key={item.id} href={item.href} className={current === item.id ? "on" : ""}>
            {item.label}
          </Link>
        ))}
        <AccountNav />
        <a href="https://buymeacoffee.com/tfpdev" target="_blank" rel="noopener noreferrer">
          Support
        </a>
      </nav>
    </div>
  );
}
