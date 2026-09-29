import { describe, expect, it } from "vitest";
import { huddleContext } from "./conversations";
import { helpQuery } from "./feed";
import { catchUpLine, helpHeadline, INTENT_FITS, OPEN_TO } from "./shared";

describe("Community wording", () => {
  it("help requests read as people, not tickets", () => {
    expect(helpHeadline("looking_for", "Priya Nair")).toBe("Priya is looking for");
    expect(helpHeadline("critique", "Arjun")).toBe("Arjun would like feedback");
    expect(helpHeadline("ask", "Maya")).toBe("Maya could use some help");
  });
  it("catch-up says what's new, and nothing when nothing is", () => {
    expect(catchUpLine({ newReplies: 8, newParticipants: 3 })).toBe("8 new replies · 3 new participants");
    expect(catchUpLine({ newReplies: 1, newParticipants: 0 })).toBe("1 new reply");
    expect(catchUpLine({ newReplies: 0, newParticipants: 0 })).toBeNull();
  });
  it("every intent that asks something maps to an explicit Open to…", () => {
    for (const fit of Object.values(INTENT_FITS)) expect(OPEN_TO).toContain(fit);
  });
});

describe("matching a request to your own Materials", () => {
  it("uses a few distinctive words, any of them", () => {
    expect(helpQuery("An image that feels like “waiting for someone who isn't coming”")).toBe("image:* | feels:* | waiting:* | coming:*");
    expect(helpQuery("is it ok?")).toBeNull();
  });
});

describe("a Huddle about a conversation", () => {
  it("starts from the title and what the starter can read — never removed or deleted replies", () => {
    const ctx = huddleContext({ title: "How much text belongs on a carousel?", body: "Slide three keeps getting overloaded." }, [
      { body: "One breath per slide.", deleted: false, removed: false },
      { body: "", deleted: true, removed: false },
      { body: "Let the image carry it.", deleted: false, removed: false },
    ]);
    expect(ctx.topic).toBe("How much text belongs on a carousel?");
    expect(ctx.description).toBe("Slide three keeps getting overloaded.\n“One breath per slide.”\n“Let the image carry it.”");
    expect(ctx.description.length).toBeLessThanOrEqual(500);
  });
});
