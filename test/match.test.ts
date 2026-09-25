import { describe, expect, it } from "vitest";
import fixture from "./fixtures/match.json" with { type: "json" };
import {
  buildMatchDetailsUrl,
  fetchMatchReferences,
  parseMatchPayload,
} from "../src/source/olympic-match.js";
import type { MatchMetadata } from "../src/domain/match.js";

const metadata: MatchMetadata = {
  code: "FBLMTEST------------QFNL000100--",
  kickoff: "2024-08-02T20:00:00+02:00",
  kickoffTimestamp: Date.parse("2024-08-02T18:00:00Z"),
  status: "FINISHED",
  venueName: "Test Stadium",
  venueCity: "Paris",
  homeTeam: "Home FC",
  awayTeam: "Away FC",
};

describe("Olympic match normalization", () => {
  it("maps scores, scorers, coaches, and lineups to the reference schema", () => {
    const match = parseMatchPayload(fixture, metadata);

    expect(match).toMatchObject({
      competition: {
        name: "Paris 2024",
        season: "2024",
        round: "Men's Quarterfinal",
      },
      venue: {
        name: "Test Stadium",
        city: "Paris",
      },
      kickoff: "2024-08-02T20:00:00+02:00",
      status: "FT",
      teams: {
        home: "Home FC",
        away: "Away FC",
      },
      score: {
        home: 2,
        away: 1,
        halfTime: {
          home: 1,
          away: 0,
        },
      },
      scorers: [
        {
          team: "Home FC",
          player: "Home Striker",
          minute: 18,
          assist: "Home Creator",
          type: "open_play",
        },
        {
          team: "Away FC",
          player: "Away Striker",
          minute: 77,
          type: "penalty",
        },
        {
          team: "Home FC",
          player: "Home Striker",
          minute: 93,
          type: "open_play",
        },
      ],
    });

    expect(match.lineups.home).toMatchObject({
      team: "Home FC",
      formation: "4-3-3",
      coach: "Home Coach",
      startingXI: [
        { name: "Home Keeper", number: 1, position: "GK" },
        { name: "Home Creator", number: 8, position: "CM" },
      ],
      bench: [
        { name: "Home Striker", number: 9, position: "ST" },
        { name: "Home Substitute", number: 12, position: "ST" },
      ],
    });
    expect(match.lineups.home.startingXI[0]).not.toHaveProperty("starting");
  });

  it("normalizes shootout goals to a stable minute", () => {
    const shootoutFixture = structuredClone(fixture) as {
      results: {
        playByPlay: Array<{ actions: Array<Record<string, unknown>> }>;
      };
    };
    const action = shootoutFixture.results.playByPlay[0]?.actions[0];

    if (action === undefined) {
      throw new Error("Fixture is missing its first goal action");
    }

    action["pbpa_period"] = "PSO";
    action["pbpa_When"] = "1";

    expect(
      parseMatchPayload(shootoutFixture, metadata).scorers[0]?.minute,
    ).toBe(120);
  });

  it("rejects match payloads without the required total period", () => {
    expect(() =>
      parseMatchPayload({ results: { eventUnit: {}, periods: [] } }, metadata),
    ).toThrowError(/missing the TOT period/);
  });

  it("loads detail references with bounded concurrency and stable order", async () => {
    const matches = [
      metadata,
      { ...metadata, code: "FBLMTEST------------QFNL000200--" },
    ];
    let activeRequests = 0;
    let maximumActiveRequests = 0;

    const fetchImpl: typeof fetch = async () => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeRequests -= 1;

      return new Response(JSON.stringify(fixture), {
        headers: { "content-type": "application/json" },
      });
    };

    const references = await fetchMatchReferences(matches, fetchImpl, 1);

    expect(maximumActiveRequests).toBe(1);
    expect(references.map((reference) => reference.code)).toEqual(
      matches.map((match) => match.code),
    );
    expect(references[0]?.endpointURL).toBe(
      "/api/matches/paris-2024/2024-08-02-2000/home-fc-vs-away-fc",
    );
  });

  it("builds the official detail URL from a match code", () => {
    expect(buildMatchDetailsUrl(metadata.code)).toContain(
      encodeURIComponent(metadata.code),
    );
  });
});
