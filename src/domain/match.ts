export interface MatchMetadata {
  readonly code: string;
  readonly kickoff: string;
  readonly kickoffTimestamp: number;
  readonly status: string;
  readonly venueName: string;
  readonly venueCity: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
}

export function deduplicateAndSortMatches(
  matches: readonly MatchMetadata[],
): MatchMetadata[] {
  const matchesByCode = new Map<string, MatchMetadata>();

  for (const match of matches) {
    const existing = matchesByCode.get(match.code);

    if (existing === undefined) {
      matchesByCode.set(match.code, match);
      continue;
    }

    if (!sameMatch(existing, match)) {
      throw new Error(`Conflicting records found for match ${match.code}`);
    }
  }

  return [...matchesByCode.values()].sort(compareMatches);
}

function sameMatch(left: MatchMetadata, right: MatchMetadata): boolean {
  return (
    left.kickoff === right.kickoff &&
    left.status === right.status &&
    left.venueName === right.venueName &&
    left.venueCity === right.venueCity &&
    left.homeTeam === right.homeTeam &&
    left.awayTeam === right.awayTeam
  );
}

function compareMatches(left: MatchMetadata, right: MatchMetadata): number {
  if (left.kickoffTimestamp !== right.kickoffTimestamp) {
    return left.kickoffTimestamp - right.kickoffTimestamp;
  }

  return compareText(left.code, right.code);
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
