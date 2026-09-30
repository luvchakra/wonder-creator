import { describe, expect, it } from "vitest";
import { TEMPLATE_IDS, TEMPLATE_INFO, TEMPLATE_SETTINGS, mergeTemplateSettings, resolveTemplateId, settingsFor, validateSettings, visibleSections } from "./creator-page-templates";

describe("Creator Page templates", () => {
  it("has five named templates, each with its own settings; an unknown id falls back safely", () => {
    expect(TEMPLATE_IDS).toHaveLength(5);
    for (const id of TEMPLATE_IDS) {
      expect(TEMPLATE_INFO[id].name).toBeTruthy();
      expect(TEMPLATE_SETTINGS[id].length).toBeGreaterThan(0);
    }
    expect(resolveTemplateId("cinematic_dark")).toBe("cinematic_dark");
    expect(resolveTemplateId("Cinematic Dark")).toBe("soft_gradient");
    expect(resolveTemplateId(undefined)).toBe("soft_gradient");
  });

  it("fills defaults, keeps valid stored values and drops anything the template doesn't offer", () => {
    expect(settingsFor("cinematic_dark", {})).toEqual({ accentMode: "warm", heroContrast: "soft", mediaDensity: "large" });
    expect(settingsFor("cinematic_dark", { cinematic_dark: { accentMode: "cool", heroContrast: "neon", colour: "#f00" } })).toEqual({ accentMode: "cool", heroContrast: "soft", mediaDensity: "large" });
    expect(settingsFor("creative_collage", null)).toEqual({ collageIntensity: "light", handwritingAccent: true, paperTexture: true });
  });

  it("accepts only the offered choices — no free-form colours, fonts or positions", () => {
    expect(validateSettings("soft_gradient", { gradientPreset: "peach" })).toEqual({ gradientPreset: "peach" });
    expect(() => validateSettings("soft_gradient", { gradientPreset: "#ff00ff" })).toThrow();
    expect(() => validateSettings("soft_gradient", { fontSize: "40px" })).toThrow();
    expect(() => validateSettings("creative_collage", { paperTexture: "yes" })).toThrow();
  });

  it("keeps each template's settings apart, so switching away and back restores them", () => {
    let all = mergeTemplateSettings({}, "cinematic_dark", { accentMode: "cool" });
    all = mergeTemplateSettings(all, "minimal_editorial", { paperTone: "neutral" });
    expect(settingsFor("cinematic_dark", all).accentMode).toBe("cool");
    expect(settingsFor("minimal_editorial", all).paperTone).toBe("neutral");
  });

  it("shows sections in the creator's order, only when switched on and not empty", () => {
    const content = { featured: 1, creations: 3, dejavu: 0, moments: 2, conversations: 0, about: 1, open_to: 0, links: 1 };
    const sections = [
      { section: "moments" as const, enabled: true },
      { section: "dejavu" as const, enabled: true },
      { section: "featured" as const, enabled: true },
      { section: "creations" as const, enabled: false },
      { section: "about" as const, enabled: true },
      { section: "open_to" as const, enabled: true },
      { section: "moments" as const, enabled: true },
    ];
    expect(visibleSections(sections, content)).toEqual(["moments", "featured", "about"]);
  });
});
