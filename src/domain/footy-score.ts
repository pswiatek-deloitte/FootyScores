export interface MatchReference {
  readonly code: string;
  readonly endpointURL: string;
  readonly data: MatchData;
}

export interface MatchData {
  readonly competition: Competition;
  readonly venue: Venue;
  readonly kickoff: string;
  readonly status: string;
  readonly teams: Teams;
  readonly score: Score;
  readonly scorers: readonly Scorer[];
  readonly lineups: Lineups;
}

export interface Competition {
  readonly name: string;
  readonly season: string;
  readonly round: string;
}

export interface Venue {
  readonly name: string;
  readonly city: string;
}

export interface Teams {
  readonly home: string;
  readonly away: string;
}

export interface Score {
  readonly home: number;
  readonly away: number;
  readonly halfTime: HalfTimeScore;
}

export interface HalfTimeScore {
  readonly home: number;
  readonly away: number;
}

export interface Scorer {
  readonly team: string;
  readonly player: string;
  readonly minute: number;
  readonly assist?: string;
  readonly type: "open_play" | "header" | "penalty";
}

export interface Lineups {
  readonly home: Lineup;
  readonly away: Lineup;
}

export interface Lineup {
  readonly team: string;
  readonly formation: string;
  readonly coach: string;
  readonly startingXI: readonly Player[];
  readonly bench: readonly Player[];
}

export interface Player {
  readonly name: string;
  readonly number: number;
  readonly position: string;
}
