import { LogoBloom } from "@wonder/ui";

/**
 * While a page is on its way: the logo, its petals opening (owner, 6 Oct 2026), centred a little above the middle of the
 * canvas. Nothing else, and no text: the header and Palette stay where they are around it.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[55dvh] items-center justify-center">
      <LogoBloom size={72} />
    </div>
  );
}
