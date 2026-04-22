type LogoProps = {
  className?: string;
  variant?: "dark" | "light";
};

export function LandingLogo({ className = "", variant = "dark" }: LogoProps) {
  const ink = variant === "dark" ? "#000000" : "#ffffff";
  return (
    <span
      className={`font-display text-3xl leading-none inline-flex items-baseline ${className}`}
      style={{ color: ink, fontFamily: "var(--font-header)", fontWeight: 700 }}
    >
      GrowFi
      <sup
        className="ml-0.5 text-[0.45em] align-super"
        aria-hidden="true"
        style={{
          color:
            variant === "dark" ? "#4a4a4a" : "rgba(255,255,255,0.75)",
        }}
      >
        ®
      </sup>
    </span>
  );
}
