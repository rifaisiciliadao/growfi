const BACKDROP_IMAGE = "/investors-olive-hero.jpg";

export function LandingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -10 }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[600px] bg-cover bg-center md:h-[625px] lg:h-[650px]"
        style={{ backgroundImage: `url(${BACKDROP_IMAGE})` }}
      />
      <div className="absolute inset-x-0 top-0 h-[600px] bg-[linear-gradient(180deg,rgba(252,253,248,0.22)_0%,rgba(252,253,248,0.34)_34%,rgba(244,247,242,0.72)_78%,rgba(244,247,242,1)_100%)] md:h-[625px] lg:h-[650px]" />
      <div className="absolute inset-x-0 top-0 h-[600px] bg-[linear-gradient(90deg,rgba(244,247,242,0.2)_0%,rgba(255,255,255,0.62)_42%,rgba(244,247,242,0.08)_100%)] md:h-[625px] lg:h-[650px]" />
      <div className="landing-grain absolute inset-0 opacity-[0.075]" />
      <div className="absolute inset-x-0 top-[495px] h-40 bg-gradient-to-b from-transparent via-surface/74 to-surface md:top-[520px] lg:top-[545px]" />
    </div>
  );
}
