import { describe, expect, it } from "vitest";
import type { PublicCard, PublicCreatorPage } from "../../lib/public-pages";
import { momentFaceOf, pageModel, workForm } from "./model";

const card = (o: Partial<PublicCard>): PublicCard => ({ slug: "s", featured: false, title: "T", creationType: "poem", typeLabel: "Poem", experience: "read", descriptor: "", coverUrl: null, durationSeconds: null, itemCount: null, publishedAt: "2026-09-30T00:00:00Z", href: "/p/a/s", ...o });
const page = (o: Partial<PublicCreatorPage>): PublicCreatorPage => ({
  creator: { id: "c", handle: "a", name: "A", bio: null, location: null, avatarUrl: null, roles: [] },
  isPublished: true,
  templateId: "soft_gradient",
  templateSettings: {},
  headline: null,
  intro: null,
  sections: ["featured", "creations", "dejavu", "moments", "conversations", "about", "open_to", "links"].map((section) => ({ section, enabled: true })),
  links: [],
  works: [],
  dejavus: [],
  moments: [],
  conversations: [],
  openTo: [],
  ...o,
});

describe("mixed work renders in its own form", () => {
  it("text stays typography; sound, film, carousels and pictures keep theirs", () => {
    expect(workForm({ experience: "read", coverUrl: null, excerpt: "lines" })).toBe("text");
    expect(workForm({ experience: "read", coverUrl: "/c", excerpt: "lines" })).toBe("text");
    expect(workForm({ experience: "listen", coverUrl: null })).toBe("audio");
    expect(workForm({ experience: "watch", coverUrl: "/p" })).toBe("video");
    expect(workForm({ experience: "swipe", coverUrl: "/s" })).toBe("carousel");
    expect(workForm({ experience: "view", coverUrl: "/v" })).toBe("image");
    // A visual work with no picture gets a quiet typed placeholder — never someone else's photograph.
    expect(workForm({ experience: "view", coverUrl: null })).toBe("placeholder");
  });

  it("moments show as what they are", () => {
    expect(momentFaceOf({ body: "x", imageUrl: "/i" })).toBe("photo");
    expect(momentFaceOf({ body: "“Same sky, different chapter.”", imageUrl: null })).toBe("quote");
    expect(momentFaceOf({ body: "https://brainpickings.org", imageUrl: null })).toBe("link");
    expect(momentFaceOf({ body: "Something I wrote today", imageUrl: null })).toBe("note");
  });
});

describe("the page model", () => {
  it("a sparse page collapses to what exists — no empty headings, no zero counts", () => {
    const m = pageModel(page({ works: [card({ title: "Only one" })], creator: { ...page({}).creator, bio: "Writer." } }));
    expect(m.sections).toEqual(["featured", "about"]);
    expect(m.featured?.title).toBe("Only one");
    expect(m.counts).toEqual([{ label: "Creation", n: 1 }]);
  });

  it("empty DejaVus are hidden; links live in About", () => {
    const m = pageModel(
      page({
        dejavus: [
          { id: "1", name: "moon", description: null, count: 0, coverUrl: null },
          { id: "2", name: "railways", description: null, count: 3, coverUrl: null },
        ],
        links: [{ label: "Site", url: "https://kunal.me" }],
      }),
    );
    expect(m.dejavus.map((d) => d.name)).toEqual(["railways"]);
    expect(m.sections).toEqual(["dejavu", "about"]);
  });

  it("the featured work is the one the creator starred, and isn't repeated under Creations", () => {
    const m = pageModel(page({ works: [card({ slug: "a", title: "A" }), card({ slug: "b", title: "B", featured: true })] }));
    expect(m.featured?.slug).toBe("b");
    expect(m.creations.map((w) => w.slug)).toEqual(["a"]);
  });
});
