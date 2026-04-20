import { LogoIcon } from "./Logo";

/**
 * Renders either a real cover image or a branded green gradient fallback.
 * Prevents unrelated stock photos from appearing on campaigns that don't
 * have metadata linked on-chain yet.
 */
export function CampaignImage({
  src,
  alt = "",
  className = "",
  iconSize = 56,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  iconSize?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(135deg, #bde4b7 0%, #7bc17a 50%, #2d6a2e 100%)",
      }}
      aria-label={alt || "GrowFi"}
    >
      <div className="opacity-80">
        <LogoIcon size={iconSize} />
      </div>
    </div>
  );
}

/**
 * Same as CampaignImage but rendered as a div with a background image —
 * useful for hero sections where we layer a gradient overlay on top.
 * Returns the style object to apply; callers render the container themselves.
 */
export function campaignHeroStyle(src: string | null | undefined) {
  if (src) {
    return { backgroundImage: `url('${src}')` };
  }
  return {
    backgroundImage:
      "linear-gradient(135deg, #bde4b7 0%, #7bc17a 50%, #2d6a2e 100%)",
  };
}
