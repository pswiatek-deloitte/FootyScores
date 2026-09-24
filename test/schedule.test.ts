import { describe, expect, it } from "vitest";
import fixture from "./fixtures/schedule.json" with { type: "json" };
import { generateEndpoint } from "../src/endpoint.js";
import { parseSchedulePayload } from "../src/source/olympic-schedule.js";

describe("Olympic schedule normalization", () => {
  it("filters non-football records, skips placeholders, deduplicates, and sorts", () => {
    const matches = parseSchedulePayload(fixture);

    expect(matches).toHaveLength(2);
    expect(matches.map((match) => match.code)).toEqual([
      "FBLWTEAM11------------GPC-000100--",
      "FBLMTEAM11------------GPA-000400--",
    ]);
    expect(matches.map((match) => generateEndpoint(match))).toEqual([
      "/api/matches/paris-2024/2024-07-25-1700/spain-vs-japan",
      "/api/matches/paris-2024/2024-07-25-1600/united-states-vs-germany",
    ]);
  });

  it("requires timezone-aware kickoff values", () => {
    const malformed = {
      schedules: [
        {
          code: "FBLMTEAM11------------GPA-000100--",
          startDate: "2024-07-25T17:00:00",
          start: [
            { participant: { name: "France" } },
            { participant: { name: "Brazil" } },
          ],
          location: { description: "Paris Stadium, Paris" },
          status: { code: "FINISHED" },
        },
      ],
    };

    expect(() => parseSchedulePayload(malformed)).toThrowError(
      /must include a timezone/,
    );
  });

  it("rejects conflicting duplicate records", () => {
    const conflicting = {
      schedules: [
        {
          code: "FBLMTEAM11------------GPA-000100--",
          startDate: "2024-07-25T17:00:00+02:00",
          start: [
            { participant: { name: "France" } },
            { participant: { name: "Brazil" } },
          ],
          location: { description: "Paris Stadium, Paris" },
          status: { code: "FINISHED" },
        },
        {
          code: "FBLMTEAM11------------GPA-000100--",
          startDate: "2024-07-25T18:00:00+02:00",
          start: [
            { participant: { name: "France" } },
            { participant: { name: "Brazil" } },
          ],
          location: { description: "Paris Stadium, Paris" },
          status: { code: "FINISHED" },
        },
      ],
    };

    expect(() => parseSchedulePayload(conflicting)).toThrowError(
      /Conflicting records/,
    );
  });
});
