import { beforeEach, describe, expect, it } from "vitest";
import { CEILING_CALLS, noteUserCall, resetAbuseWatch, WATCH_DISTINCT } from "./abuse-watch";

describe("noteUserCall", () => {
  beforeEach(resetAbuseWatch);

  it("lets ordinary use through", () => {
    for (let i = 0; i < 500; i++) expect(noteUserCall("u1", "/api/v1/home", 1000)).toBeNull();
  });

  it("only logs, never blocks, a creator who opens many distinct pages", () => {
    for (let i = 0; i < WATCH_DISTINCT + 50; i++) expect(noteUserCall("u2", `/api/v1/materials/${i}`, 1000)).toBeNull();
  });

  it("refuses past the hourly ceiling, with the seconds left, and starts over after the hour", () => {
    for (let i = 0; i < CEILING_CALLS; i++) noteUserCall("u3", "/api/v1/home", 0);
    expect(noteUserCall("u3", "/api/v1/home", 60_000)).toBe(3540);
    expect(noteUserCall("u3", "/api/v1/home", 3_600_001)).toBeNull();
  });

  it("counts each creator on their own", () => {
    for (let i = 0; i < CEILING_CALLS + 1; i++) noteUserCall("u4", "/x", 0);
    expect(noteUserCall("u5", "/x", 0)).toBeNull();
  });
});
