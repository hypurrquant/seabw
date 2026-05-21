import { describe, expect, it } from "vitest";
import type { Answers } from "@/domains/survey/lib";
import { decodeAnswers, encodeAnswers } from "../answers-url";

const SAMPLE: Answers = {
  horizon: 3,
  allocation: 2,
  experienceProducts: ["swap", "lp"],
  experienceYears: 2,
  returnAttitude: 3,
  lossTolerance: 2,
  literacy: 3,
  derivativeExp: 1,
  ageBucket: "under65",
  firstTimeDefiPilot: true,
};

describe("answers-url", () => {
  it("round-trips valid answers", () => {
    const encoded = encodeAnswers(SAMPLE);
    expect(decodeAnswers(encoded)).toEqual(SAMPLE);
  });

  it("encodes to URL-safe characters only", () => {
    const encoded = encodeAnswers(SAMPLE);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns null on empty string", () => {
    expect(decodeAnswers("")).toBeNull();
  });

  it("returns null on malformed base64", () => {
    expect(decodeAnswers("!!!not-base64$$")).toBeNull();
  });

  it("returns null on valid base64 but schema mismatch", () => {
    const garbage = encodeAnswers({
      horizon: 99,
    } as unknown as Answers);
    expect(decodeAnswers(garbage)).toBeNull();
  });
});
