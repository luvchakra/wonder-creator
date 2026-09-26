import { describe, expect, it } from "vitest";
import { formatElapsed, participantLine, viewState } from "./lifecycle";

describe("viewState", () => {
  it("never shows a dissolved huddle as live", () => {
    expect(viewState({ status: "dissolved", myParticipantStatus: "joined", myPendingRequest: false })).toBe("dissolved");
    expect(viewState({ status: null, myParticipantStatus: null, myPendingRequest: true })).toBe("dissolved");
  });
  it("walks the join flow", () => {
    expect(viewState({ status: "live", myParticipantStatus: null, myPendingRequest: false })).toBe("live");
    expect(viewState({ status: "live", myParticipantStatus: null, myPendingRequest: true })).toBe("join_request_pending");
    expect(viewState({ status: "live", myParticipantStatus: "joining", myPendingRequest: false })).toBe("approved");
    expect(viewState({ status: "live", myParticipantStatus: "joined", myPendingRequest: false })).toBe("joined");
    expect(viewState({ status: "live", myParticipantStatus: "joined", myPendingRequest: false, leaving: true })).toBe("leaving");
    expect(viewState({ status: "dissolving", myParticipantStatus: "joined", myPendingRequest: false })).toBe("dissolving");
  });
});

describe("formatting", () => {
  it("formats elapsed time", () => {
    const now = new Date("2026-09-26T12:24:18Z");
    expect(formatElapsed("2026-09-26T12:00:00Z", now)).toBe("24:18");
    expect(formatElapsed("2026-09-26T10:00:00Z", now)).toBe("2:24:18");
  });
  it("builds the participant line", () => {
    expect(participantLine(["Maya Sen", "Arjun Mehta", "Sofia Rao"], 3)).toBe("Maya · Arjun · Sofia");
    expect(participantLine(["Maya Sen", "Arjun Mehta", "Sofia Rao", "Daniel"], 5)).toBe("Maya · Arjun · Sofia + 2");
  });
});
