/**
 * The small steps into the ecosystem (owner, 8 Oct 2026: "encourage the user to start small and get into the ecosystem
 * of creation, connect and collaborate with others"; docs/ui-redesign/start-small.md). Where a creator is on that way,
 * read only from what they have actually done — never a score, a level or a checklist, nothing to complete:
 *
 *   capture      nothing caught or made yet           → a line is enough to begin
 *   make         something caught, nothing made       → turn it into a Creation
 *   connect      made something, in no community yet → find the people who make what you make
 *   collaborate  in a community, no Creative Room     → make something with someone
 *   null         all of it done                       → Home shows only what's happening
 *
 * Home asks for one step at a time, the first one not yet taken. A step that has no place on Home of its own (connect
 * is the Communities section, capture is Quick Capture) adds nothing more to the page.
 */
export type JourneyStep = "capture" | "make" | "connect" | "collaborate";

export interface JourneyFacts {
  /** Has caught or brought in anything (a note, a voice note, a picture, any Material). */
  caught: boolean;
  /** Has a Creation (not archived). */
  made: boolean;
  /** Belongs to a Community — or Communities aren't available, so there's nothing to ask. */
  connected: boolean;
  /** Has a Creative Room (their own, or one they were invited to). */
  together: boolean;
}

export function journeyStep(f: JourneyFacts): JourneyStep | null {
  if (!f.made) return f.caught ? "make" : "capture";
  if (!f.connected) return "connect";
  if (!f.together) return "collaborate";
  return null;
}

/** The one quiet line under the greeting while the first steps are still ahead (only when nothing else needs attention). */
export function journeyLine(step: JourneyStep | null): string | null {
  if (step === "capture") return "Begin with one small thing — a line is enough.";
  if (step === "make") return "Turn something you caught into a Creation.";
  return null;
}
