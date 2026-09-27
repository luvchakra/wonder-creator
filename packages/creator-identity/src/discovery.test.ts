import { describe, expect, it } from "vitest";
import { discoverySchema, explainCandidate, parseTerms, stemTerm, type CandidateSignals } from "./discovery";

const none: CandidateSignals = { matchedTerms: [], interestMatch: false, locationMatch: false, sharedCrews: 0, metInHuddles: 0, workedTogether: 0, iFollow: false, followsMe: false, publishedPieces: 0, inProject: null };

describe("collaborator discovery", () => {
  it("stems role words so they find disciplines", () => {
    expect(stemTerm("Cinematographers")).toBe("cinematograph");
    expect(stemTerm("editor")).toBe("edit");
    expect(stemTerm("musicians")).toBe("music");
    expect(stemTerm("sound designer")).toBe("sound design");
    expect(stemTerm("art")).toBe("art");
    expect(discoverySchema.parse({ terms: ["Writers", "writer"] }).terms).toEqual(["writ"]);
    expect(parseTerms("cinematographer, Sound design; ,x")).toEqual(["cinematographer", "sound design"]);
  });

  it("explains results only from facts, with no score", () => {
    const reasons = explainCandidate(
      { disciplines: ["Cinematography"], skills: ["Colour grading"], interests: ["Monsoon light"], location: "Goa", availability: "open" },
      { ...none, matchedTerms: ["cinematograph"], interestMatch: true, locationMatch: true, workedTogether: 2, metInHuddles: 1, iFollow: true, followsMe: true },
      { interest: "monsoon", location: "goa" },
    );
    expect(reasons).toEqual([
      "Lists Cinematography as a discipline",
      "Interested in Monsoon light",
      "Based in Goa",
      "You've worked together on 2 pieces",
      "You've met in 1 Huddle",
      "You follow each other",
      "Open to collaborate",
    ]);
    expect(reasons.join(" ")).not.toMatch(/score|rank|popular|followers/i);
  });
});
