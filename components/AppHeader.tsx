import Link from "next/link";

export function AppHeader({ current }: { current: "home" | "scout" | "assistant" }) {
  return (
    <div className="masthead">
      <Link href="/" className="logo">
        The <span>Scouting</span> Post
      </Link>
      <nav className="mast-nav">
        <Link href="/" className={current === "home" ? "on" : ""}>
          Upload
        </Link>
        <Link href="/assistant" className={current === "assistant" ? "on" : ""}>
          Assistant
        </Link>
        <Link href="/scout" className={current === "scout" ? "on" : ""}>
          Scout
        </Link>
        <a href="https://buymeacoffee.com/tfpdev" target="_blank" rel="noopener noreferrer">
          Support
        </a>
      </nav>
    </div>
  );
}
