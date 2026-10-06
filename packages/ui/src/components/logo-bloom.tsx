import { cn } from "../cn";

/**
 * The loading mark (owner, 6 Oct 2026: "instead of opening text while loading, show the app logo … as it's flower
 * shaped, show the petals opening"). The supplied symbol (`KIT.logo.symbol`) exactly: the same three petal paths, the
 * same gradients, fills and angles, and the sparkle. Nothing is redrawn; only motion is added. Each petal unfolds from
 * upright to its own angle — the middle first, then left, then right — the sparkle catches, it rests a moment open,
 * then gently folds and blooms again while the page is on its way. The open frame is the logo itself.
 *
 * Reduced motion: the open logo, still. Purely visual: one status for assistive tech, the drawing is hidden.
 */
export function LogoBloom({ size = 64, label = "Loading", className }: { size?: number; label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("wc-bloom inline-flex", className)}>
      <svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden focusable="false">
        <defs>
          <linearGradient id="wcb-mL" x1="0.1" y1="1" x2="0.3" y2="0">
            <stop offset="0" stopColor="#4F7BFF" />
            <stop offset="0.55" stopColor="#7C5CFA" />
            <stop offset="1" stopColor="#C084FC" />
          </linearGradient>
          <linearGradient id="wcb-mM" x1="0.2" y1="1" x2="0.1" y2="0">
            <stop offset="0" stopColor="#EC4899" />
            <stop offset="0.5" stopColor="#FB7185" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="wcb-mR" x1="0" y1="1" x2="0.3" y2="0">
            <stop offset="0" stopColor="#8B5CF6" />
            <stop offset="0.6" stopColor="#EC4899" />
            <stop offset="1" stopColor="#F472B6" />
          </linearGradient>
          <linearGradient id="wcb-mS" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A78BFA" />
            <stop offset="1" stopColor="#7C5CFA" />
          </linearGradient>
        </defs>
        <g transform="translate(61.44 61.44) scale(4.50560)">
          {/* Each petal sits at its base point; the inner group turns it about that point from upright to its angle. */}
          <g transform="translate(100 178)">
            <g className="wc-petal wc-petal-l">
              <path d="M0 0 C-44.0 -44.2 -34.3 -130.0 0 -130.0 C34.3 -130.0 44.0 -44.2 0 0Z" fill="url(#wcb-mL)" fillOpacity="0.92" />
            </g>
          </g>
          <g transform="translate(128 178)">
            <g className="wc-petal wc-petal-r">
              <path d="M0 0 C-40.0 -40.8 -31.2 -120.0 0 -120.0 C31.2 -120.0 40.0 -40.8 0 0Z" fill="url(#wcb-mR)" fillOpacity="0.88" />
            </g>
          </g>
          <g transform="translate(112 182)">
            <g className="wc-petal wc-petal-m">
              <path d="M0 0 C-46.0 -56.4 -35.9 -166.0 0 -166.0 C35.9 -166.0 46.0 -56.4 0 0Z" fill="url(#wcb-mM)" fillOpacity="0.9" />
            </g>
          </g>
          <g className="wc-spark">
            <path d="M166 13C168.72 27.28 168.72 27.28 183 30C168.72 32.72 168.72 32.72 166 47C163.28 32.72 163.28 32.72 149 30C163.28 27.28 163.28 27.28 166 13Z" fill="url(#wcb-mS)" />
          </g>
        </g>
      </svg>
      <style>{BLOOM_CSS}</style>
    </span>
  );
}

// The open angles are the supplied symbol's own (-36°, 32°, -6°). One 2.6s breath: unfold (staggered, eased), rest
// open, fold softly, again. Transforms only — no layout, nothing for the page to recalculate.
const BLOOM_CSS = `
.wc-bloom .wc-petal{transform-box:view-box;transform-origin:0 0;animation:2.6s cubic-bezier(.22,.8,.26,1) infinite both}
.wc-bloom .wc-petal-m{--wc-open:rotate(-6deg);animation-name:wc-bloom-m}
.wc-bloom .wc-petal-l{--wc-open:rotate(-36deg);animation-name:wc-bloom-l}
.wc-bloom .wc-petal-r{--wc-open:rotate(32deg);animation-name:wc-bloom-r}
.wc-bloom .wc-spark{transform-box:fill-box;transform-origin:50% 50%;animation:wc-bloom-s 2.6s ease-in-out infinite both}
@keyframes wc-bloom-m{0%{transform:rotate(0) scale(.35);opacity:0}8%{opacity:1}30%,78%{transform:rotate(-6deg) scale(1);opacity:1}100%{transform:rotate(0) scale(.35);opacity:0}}
@keyframes wc-bloom-l{0%,8%{transform:rotate(0) scale(.35);opacity:0}16%{opacity:1}40%,78%{transform:rotate(-36deg) scale(1);opacity:1}100%{transform:rotate(0) scale(.35);opacity:0}}
@keyframes wc-bloom-r{0%,16%{transform:rotate(0) scale(.35);opacity:0}24%{opacity:1}48%,78%{transform:rotate(32deg) scale(1);opacity:1}100%{transform:rotate(0) scale(.35);opacity:0}}
@keyframes wc-bloom-s{0%,44%{transform:scale(0) rotate(-45deg);opacity:0}58%,78%{transform:scale(1) rotate(0);opacity:1}92%,100%{transform:scale(0) rotate(45deg);opacity:0}}
@media (prefers-reduced-motion:reduce){
.wc-bloom .wc-petal,.wc-bloom .wc-spark{animation:none}
.wc-bloom .wc-petal-m{transform:rotate(-6deg)}.wc-bloom .wc-petal-l{transform:rotate(-36deg)}.wc-bloom .wc-petal-r{transform:rotate(32deg)}
}`;
