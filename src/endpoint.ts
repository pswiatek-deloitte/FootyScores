import type { MatchMetadata } from "./domain/match.js";

export const DEFAULT_COMPETITION_NAME = "Paris 2024";

export function generateEndpoint(
  match: MatchMetadata,
  competitionName = DEFAULT_COMPETITION_NAME,
): string {
  const kickoff = formatEndpointKickoff(match.kickoff);
  const competition = normalizeSegment(competitionName);
  const homeTeam = normalizeSegment(match.homeTeam);
  const awayTeam = normalizeSegment(match.awayTeam);

  return `/api/matches/${competition}/${kickoff}/${homeTeam}-vs-${awayTeam}`;
}

function formatEndpointKickoff(kickoff: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(kickoff);

  if (match === null) {
    throw new Error(`Cannot format kickoff value: ${kickoff}`);
  }

  const [, date, hour, minute] = match;

  if (date === undefined || hour === undefined || minute === undefined) {
    throw new Error(`Cannot format kickoff value: ${kickoff}`);
  }

  return `${date}-${hour}${minute}`;
}

function normalizeSegment(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    throw new Error(`Cannot create an endpoint segment from "${value}"`);
  }

  return normalized;
}
