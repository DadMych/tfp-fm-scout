/** TFP monogram for the masthead (matches app/icon.svg, doc 18). */
export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className="logo-icon"
      aria-hidden
    >
      <rect width="32" height="32" fill="var(--paper)" />
      <text
        x="3"
        y="22"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="13"
        fontWeight="700"
        fill="var(--ink)"
      >
        TFP
      </text>
      <circle cx="27" cy="23" r="2.5" fill="var(--red)" />
    </svg>
  );
}
