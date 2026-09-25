import type {
  Lineup,
  MatchData,
  MatchReference,
  Player,
  Scorer,
} from "../domain/footy-score.js";
import type { MatchMetadata } from "../domain/match.js";
import { generateEndpoint } from "../endpoint.js";
import { fetchJson } from "./http.js";
import {
  SourceDataError,
  asRecord,
  optionalString,
  requiredArray,
  requiredInteger,
  requiredString,
} from "./validation.js";

const MATCH_DETAILS_BASE_URL =
  "https://stacy.olympics.com/OG2024/data/RES_ByRSC_H2H~comp=OG2024~disc=FBL~rscResult=";
const MATCH_DETAILS_SUFFIX = "~lang=ENG.json";
const UNKNOWN_SOURCE_VALUE = "Unknown";

export function buildMatchDetailsUrl(matchCode: string): string {
  return `${MATCH_DETAILS_BASE_URL}${encodeURIComponent(matchCode)}${MATCH_DETAILS_SUFFIX}`;
}

export async function fetchMatchPayload(
  matchCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return fetchJson(buildMatchDetailsUrl(matchCode), fetchImpl);
}

export async function fetchMatchReferences(
  matches: readonly MatchMetadata[],
  fetchImpl: typeof fetch = fetch,
  maxConcurrency = 4,
): Promise<MatchReference[]> {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new RangeError("maxConcurrency must be a positive integer");
  }

  const references = matches.map((): MatchReference | undefined => undefined);
  let nextIndex = 0;
  const workerCount = Math.min(maxConcurrency, matches.length);

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= matches.length) {
        return;
      }

      const match = matches[index];

      if (match === undefined) {
        throw new SourceDataError(
          `Match metadata is missing at index ${index}`,
        );
      }

      const payload = await fetchMatchPayload(match.code, fetchImpl);
      references[index] = {
        code: match.code,
        endpointURL: generateEndpoint(match),
        data: parseMatchPayload(payload, match),
      };
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return references.map((reference, index) => {
    if (reference === undefined) {
      throw new SourceDataError(`Match reference is missing at index ${index}`);
    }

    return reference;
  });
}

export function parseMatchPayload(
  payload: unknown,
  metadata: MatchMetadata,
): MatchData {
  const root = asRecord(payload, "match response");
  const results = asRecord(root["results"], "match response.results");
  const eventUnit = asRecord(
    results["eventUnit"],
    "match response.results.eventUnit",
  );
  const periods = requiredArray(
    results["periods"],
    "match response.results.periods",
  );
  const fullTime = findPeriod(periods, "TOT");
  const halfTime = findPeriod(periods, "H1");
  const items = requiredArray(
    results["items"],
    "match response.results.items",
  ).map((value, index) =>
    asRecord(value, `match response.results.items[${index}]`),
  );
  const homeItem = findTeamItem(items, metadata.homeTeam, "home");
  const awayItem = findTeamItem(items, metadata.awayTeam, "away");

  return {
    competition: {
      name: "Paris 2024",
      season: "2024",
      round: requiredString(
        eventUnit["description"],
        "match response.results.eventUnit.description",
      ),
    },
    venue: {
      name: metadata.venueName,
      city: metadata.venueCity,
    },
    kickoff: metadata.kickoff,
    status: parseStatus(metadata.status),
    teams: {
      home: metadata.homeTeam,
      away: metadata.awayTeam,
    },
    score: {
      home: readPeriodScore(fullTime, "home"),
      away: readPeriodScore(fullTime, "away"),
      halfTime: {
        home: readPeriodScore(halfTime, "home"),
        away: readPeriodScore(halfTime, "away"),
      },
    },
    scorers: parseScorers(results, items),
    lineups: {
      home: parseLineup(homeItem, "home"),
      away: parseLineup(awayItem, "away"),
    },
  };
}

function findPeriod(
  periods: readonly unknown[],
  code: string,
): Record<string, unknown> {
  for (const [index, value] of periods.entries()) {
    const period = asRecord(value, `match response.results.periods[${index}]`);

    if (period["p_code"] === code) {
      return period;
    }
  }

  throw new SourceDataError(
    `match response.results.periods is missing the ${code} period`,
  );
}

function readPeriodScore(
  period: Record<string, unknown>,
  side: "home" | "away",
): number {
  const periodCode = requiredString(
    period["p_code"],
    "match response.results.periods[].p_code",
  );
  const result = asRecord(
    period[side],
    `match response.results.periods.${periodCode}.${side}`,
  );

  return requiredInteger(
    result["score"],
    `match response.results.periods.${periodCode}.${side}.score`,
  );
}

function findTeamItem(
  items: readonly Record<string, unknown>[],
  teamName: string,
  side: string,
): Record<string, unknown> {
  const match = items.find((item) => {
    const participant = asRecord(
      item["participant"],
      `match response.results.items.${side}.participant`,
    );

    return participant["name"] === teamName;
  });

  if (match === undefined) {
    throw new SourceDataError(
      `match response.results.items is missing the ${side} team ${teamName}`,
    );
  }

  return match;
}

function parseLineup(item: Record<string, unknown>, side: string): Lineup {
  const participant = asRecord(
    item["participant"],
    `match response.results.items.${side}.participant`,
  );
  const team = requiredString(
    participant["name"],
    `match response.results.items.${side}.participant.name`,
  );
  const entries = requiredArray(
    item["eventUnitEntries"],
    `match response.results.items.${side}.eventUnitEntries`,
  );
  const formation = requiredEntryValue(
    entries,
    "FORMATION",
    `match response.results.items.${side}.eventUnitEntries`,
  );
  const coach = parseCoach(item["teamCoaches"], side);
  const athletes = requiredArray(
    item["teamAthletes"],
    `match response.results.items.${side}.teamAthletes`,
  );
  const players = athletes.map((value, index) =>
    parsePlayer(value, `${side}.teamAthletes[${index}]`),
  );

  return {
    team,
    formation,
    coach,
    startingXI: players.filter((player) => player.starting).map(toPublicPlayer),
    bench: players.filter((player) => !player.starting).map(toPublicPlayer),
  };
}

interface ParsedPlayer extends Player {
  readonly starting: boolean;
}

function toPublicPlayer({ name, number, position }: ParsedPlayer): Player {
  return { name, number, position };
}

function parsePlayer(value: unknown, context: string): ParsedPlayer {
  const record = asRecord(value, `match response.results.items.${context}`);
  const athlete = asRecord(
    record["athlete"],
    `match response.results.items.${context}.athlete`,
  );
  const entries = requiredArray(
    record["eventUnitEntries"],
    `match response.results.items.${context}.eventUnitEntries`,
  );
  const givenName = optionalString(athlete["givenName"]);
  const familyName = optionalString(athlete["familyName"]);
  const name =
    [givenName, familyName]
      .filter((part): part is string => part !== undefined)
      .join(" ") ||
    requiredString(
      athlete["name"],
      `match response.results.items.${context}.athlete.name`,
    );

  return {
    name,
    number: requiredInteger(
      record["bib"],
      `match response.results.items.${context}.bib`,
    ),
    position: mapPosition(
      findOptionalEntryValue(entries, "POSITION") ?? "Unknown",
    ),
    starting: findOptionalEntryValue(entries, "STARTER") === "Y",
  };
}

function parseCoach(value: unknown, side: string): string {
  if (!Array.isArray(value) || value.length === 0) {
    return UNKNOWN_SOURCE_VALUE;
  }

  const coaches = value.map((coach, index) =>
    asRecord(
      coach,
      `match response.results.items.${side}.teamCoaches[${index}]`,
    ),
  );
  const headCoach =
    coaches.find((coach) => {
      const functionData = asRecord(
        coach["function"],
        `match response.results.items.${side}.teamCoaches.function`,
      );

      return functionData["functionCode"] === "COACH";
    }) ?? coaches.find((coach) => coach["coach"] !== undefined);

  if (headCoach === undefined) {
    return UNKNOWN_SOURCE_VALUE;
  }

  const coach = asRecord(
    headCoach["coach"],
    `match response.results.items.${side}.teamCoaches.coach`,
  );
  const givenName = optionalString(coach["givenName"]);
  const familyName = optionalString(coach["familyName"]);

  if (givenName !== undefined && familyName !== undefined) {
    return `${givenName} ${familyName}`;
  }

  const sourceName = optionalString(coach["name"]);

  if (sourceName !== undefined) {
    return sourceName;
  }

  if (familyName !== undefined) {
    return familyName;
  }

  throw new SourceDataError(
    `match response.results.items.${side}.teamCoaches.coach is missing a name`,
  );
}

function parseScorers(
  results: Record<string, unknown>,
  items: readonly Record<string, unknown>[],
): Scorer[] {
  const playerNames = createPlayerNames(items);
  const teamNames = createTeamNames(items);
  const playByPlay = requiredArray(
    results["playByPlay"],
    "match response.results.playByPlay",
  );
  const actions: Record<string, unknown>[] = [];

  for (const [index, value] of playByPlay.entries()) {
    const period = asRecord(
      value,
      `match response.results.playByPlay[${index}]`,
    );
    const periodActions = requiredArray(
      period["actions"],
      `match response.results.playByPlay[${index}].actions`,
    );

    for (const [actionIndex, action] of periodActions.entries()) {
      actions.push(
        asRecord(
          action,
          `match response.results.playByPlay[${index}].actions[${actionIndex}]`,
        ),
      );
    }
  }

  return actions
    .filter((action) => action["pbpa_Result"] === "GOAL")
    .sort(compareActions)
    .map((action, index) => parseGoal(action, index, playerNames, teamNames));
}

function createPlayerNames(
  items: readonly Record<string, unknown>[],
): Map<string, string> {
  const names = new Map<string, string>();

  for (const [index, item] of items.entries()) {
    const athletes = requiredArray(
      item["teamAthletes"],
      `match response.results.items[${index}].teamAthletes`,
    );

    for (const [athleteIndex, value] of athletes.entries()) {
      const athleteRecord = asRecord(
        value,
        `match response.results.items[${index}].teamAthletes[${athleteIndex}]`,
      );
      const athlete = asRecord(
        athleteRecord["athlete"],
        `match response.results.items[${index}].teamAthletes[${athleteIndex}].athlete`,
      );
      const code = requiredString(
        athlete["code"],
        `match response.results.items[${index}].teamAthletes[${athleteIndex}].athlete.code`,
      );
      const givenName = optionalString(athlete["givenName"]);
      const familyName = optionalString(athlete["familyName"]);
      const name =
        [givenName, familyName]
          .filter((part): part is string => part !== undefined)
          .join(" ") ||
        optionalString(athlete["TVName"]) ||
        requiredString(
          athlete["name"],
          `match response.results.items[${index}].teamAthletes[${athleteIndex}].athlete.name`,
        );

      names.set(code, name);
    }
  }

  return names;
}

function createTeamNames(
  items: readonly Record<string, unknown>[],
): Map<string, string> {
  const names = new Map<string, string>();

  for (const [index, item] of items.entries()) {
    const code = requiredString(
      item["teamCode"],
      `match response.results.items[${index}].teamCode`,
    );
    const participant = asRecord(
      item["participant"],
      `match response.results.items[${index}].participant`,
    );
    const name = requiredString(
      participant["name"],
      `match response.results.items[${index}].participant.name`,
    );

    names.set(code, name);
  }

  return names;
}

function parseGoal(
  action: Record<string, unknown>,
  index: number,
  playerNames: ReadonlyMap<string, string>,
  teamNames: ReadonlyMap<string, string>,
): Scorer {
  const context = `match response.results.goal[${index}]`;
  const competitors = requiredArray(
    action["competitors"],
    `${context}.competitors`,
  );
  const competitor = asRecord(competitors[0], `${context}.competitors[0]`);
  const teamCode = requiredString(
    competitor["pbpc_code"],
    `${context}.competitors[0].pbpc_code`,
  );
  const actionType = optionalString(action["pbpa_Action"])?.toUpperCase();
  const ownGoal = actionType === "OG";
  const team = ownGoal
    ? findOpposingTeamName(teamCode, teamNames, context)
    : findTeamName(teamCode, teamNames, context);
  const athletes = requiredArray(
    competitor["athletes"],
    `${context}.competitors[0].athletes`,
  );
  const scorer = findAthleteByRole(athletes, "SCR", context);
  const creditedAthlete =
    scorer ??
    (ownGoal
      ? asRecord(athletes[0], `${context}.competitors[0].athletes[0]`)
      : undefined);

  if (creditedAthlete === undefined) {
    throw new SourceDataError(
      `${context}.competitors[0].athletes is missing a scorer`,
    );
  }
  const scorerCode = requiredString(
    creditedAthlete["pbpat_code"],
    `${context}.scorer.pbpat_code`,
  );
  const player = playerNames.get(scorerCode) ?? UNKNOWN_SOURCE_VALUE;
  const assist = ownGoal
    ? undefined
    : findAthleteByRole(athletes, "ASSIST", context);
  const minute =
    action["pbpa_period"] === "PSO"
      ? 120
      : parseMinute(
          requiredString(action["pbpa_When"], `${context}.pbpa_When`),
          context,
        );
  const assistCode =
    assist === undefined ? undefined : optionalString(assist["pbpat_code"]);
  const assistName =
    assistCode === undefined ? undefined : playerNames.get(assistCode);
  const type =
    actionType === "PEN" || actionType === "PENALTY" ? "penalty" : "open_play";

  if (assistName !== undefined) {
    return { team, player, minute, assist: assistName, type };
  }

  return { team, player, minute, type };
}

function findAthleteByRole(
  athletes: readonly unknown[],
  role: string,
  context: string,
): Record<string, unknown> | undefined {
  for (const [index, value] of athletes.entries()) {
    const athlete = asRecord(value, `${context}.athletes[${index}]`);

    if (athlete["pbpat_role"] === role) {
      return athlete;
    }
  }

  return undefined;
}

function findTeamName(
  competitorCode: string,
  teamNames: ReadonlyMap<string, string>,
  context: string,
): string {
  for (const [teamCode, teamName] of teamNames.entries()) {
    if (competitorCode === teamCode || competitorCode.includes(teamCode)) {
      return teamName;
    }
  }

  throw new SourceDataError(
    `${context}.competitors[0].pbpc_code does not identify a known team`,
  );
}

function findOpposingTeamName(
  competitorCode: string,
  teamNames: ReadonlyMap<string, string>,
  context: string,
): string {
  const ownTeam = findTeamName(competitorCode, teamNames, context);

  for (const teamName of teamNames.values()) {
    if (teamName !== ownTeam) {
      return teamName;
    }
  }

  throw new SourceDataError(
    `${context}.competitors[0].pbpc_code does not identify an opposing team`,
  );
}

function parseMinute(value: string, context: string): number {
  const minuteValues = [...value.matchAll(/\d+/g)].map((match) =>
    Number(match[0]),
  );

  if (minuteValues.length === 0) {
    throw new SourceDataError(`${context} must contain a minute`);
  }

  return minuteValues.reduce((total, minute) => total + minute, 0);
}

function compareActions(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number {
  return Number(left["pbpa_order"] ?? 0) - Number(right["pbpa_order"] ?? 0);
}

function requiredEntryValue(
  entries: readonly unknown[],
  code: string,
  context: string,
): string {
  const value = findOptionalEntryValue(entries, code);

  if (value === undefined) {
    throw new SourceDataError(`${context} is missing ${code}`);
  }

  return value;
}

function findOptionalEntryValue(
  entries: readonly unknown[],
  code: string,
): string | undefined {
  let value: string | undefined;

  for (const entry of entries) {
    const record = asRecord(entry, `event unit entry ${code}`);

    if (record["eue_code"] === code) {
      value = optionalString(record["eue_value"]) ?? value;
    }
  }

  return value;
}

function mapPosition(position: string): string {
  const positions: Record<string, string> = {
    GK: "GK",
    DF: "CB",
    MF: "CM",
    FW: "ST",
    D01: "RB",
    D02: "CB",
    D03: "CB",
    D04: "CB",
    D05: "CB",
    D06: "LB",
    D07: "RB",
    F02: "CM",
    F04: "ST",
    F06: "LW",
    M14: "CM",
    M21: "CM",
    M23: "CM",
    M25: "CM",
    M27: "CM",
    M33: "CM",
    M35: "CM",
  };

  if (positions[position] !== undefined) {
    return positions[position];
  }

  if (/^D\d{2}$/.test(position)) {
    return "CB";
  }

  if (/^F\d{2}$/.test(position)) {
    return "ST";
  }

  if (/^M\d{2}$/.test(position)) {
    return "CM";
  }

  return position;
}

function parseStatus(status: string): string {
  return status.toUpperCase() === "FINISHED" ? "FT" : status;
}
