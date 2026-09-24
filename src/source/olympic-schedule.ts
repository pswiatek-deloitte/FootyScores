import { readFile } from "node:fs/promises";
import type { MatchMetadata } from "../domain/match.js";
import { deduplicateAndSortMatches } from "../domain/match.js";

export const OFFICIAL_SCHEDULE_PAGE_URL =
  "https://stacy.olympics.com/en/paris-2024/competition-schedule";

export const OFFICIAL_FOOTBALL_SCHEDULE_URL =
  "https://stacy.olympics.com/OG2024/data/SCH_StartList~comp=OG2024~disc=FBL~lang=ENG.json";

export class ScheduleDataError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScheduleDataError";
  }
}

export async function fetchSchedulePayload(
  sourceUrl = OFFICIAL_FOOTBALL_SCHEDULE_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetchImpl(sourceUrl, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new Error(`Could not fetch schedule data from ${sourceUrl}`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(
      `Schedule request failed with HTTP ${response.status} ${response.statusText}`,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Schedule response from ${sourceUrl} was not valid JSON`, {
      cause: error,
    });
  }
}

export async function readSchedulePayload(inputPath: string): Promise<unknown> {
  let content: string;

  try {
    content = await readFile(inputPath, "utf8");
  } catch (error) {
    throw new Error(`Could not read schedule input file ${inputPath}`, {
      cause: error,
    });
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(`Schedule input file ${inputPath} was not valid JSON`, {
      cause: error,
    });
  }
}

export function parseSchedulePayload(payload: unknown): MatchMetadata[] {
  const root = asRecord(payload, "schedule response");
  const schedules = root["schedules"];

  if (!Array.isArray(schedules)) {
    throw new ScheduleDataError(
      'Schedule response must contain a "schedules" array',
    );
  }

  const matches: MatchMetadata[] = [];

  for (const [index, value] of schedules.entries()) {
    const match = parseScheduleRecord(value, index);

    if (match !== null) {
      matches.push(match);
    }
  }

  const normalizedMatches = deduplicateAndSortMatches(matches);

  if (normalizedMatches.length === 0) {
    throw new ScheduleDataError(
      "Schedule response contained no football matches",
    );
  }

  return normalizedMatches;
}

function parseScheduleRecord(
  value: unknown,
  index: number,
): MatchMetadata | null {
  const record = asRecord(value, `schedule record ${index + 1}`);
  const code = requiredString(
    record["code"],
    `schedule record ${index + 1}.code`,
  );

  if (!code.startsWith("FBL")) {
    return null;
  }

  const start = record["start"];

  if (!Array.isArray(start) || start.length !== 2) {
    return null;
  }

  const kickoff = requiredString(
    record["startDate"],
    `schedule record ${index + 1}.startDate`,
  );
  const kickoffTimestamp = parseKickoff(kickoff, index);
  const home = start[0] as unknown;
  const away = start[1] as unknown;
  const homeTeam = parseTeam(home, index, "home");
  const awayTeam = parseTeam(away, index, "away");
  const location = parseLocation(record["location"], index);
  const status = asRecord(
    record["status"],
    `schedule record ${index + 1}.status`,
  );

  return {
    code,
    kickoff,
    kickoffTimestamp,
    status: requiredString(
      status["code"],
      `schedule record ${index + 1}.status.code`,
    ),
    venueName: location.name,
    venueCity: location.city,
    homeTeam,
    awayTeam,
  };
}

function parseTeam(value: unknown, index: number, side: string): string {
  const starter = asRecord(value, `schedule record ${index + 1}.${side}`);
  const participant = asRecord(
    starter["participant"],
    `schedule record ${index + 1}.${side}.participant`,
  );

  return requiredString(
    participant["name"],
    `schedule record ${index + 1}.${side}.participant.name`,
  );
}

function parseLocation(
  value: unknown,
  index: number,
): { name: string; city: string } {
  const location = asRecord(value, `schedule record ${index + 1}.location`);
  const description = requiredString(
    location["description"],
    `schedule record ${index + 1}.location.description`,
  );
  const separator = description.lastIndexOf(",");

  if (separator <= 0 || separator === description.length - 1) {
    throw new ScheduleDataError(
      `schedule record ${index + 1}.location.description must contain "venue, city"`,
    );
  }

  return {
    name: description.slice(0, separator).trim(),
    city: description.slice(separator + 1).trim(),
  };
}

function parseKickoff(value: string, index: number): number {
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    throw new ScheduleDataError(
      `schedule record ${index + 1}.startDate must include a timezone`,
    );
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new ScheduleDataError(
      `schedule record ${index + 1}.startDate is not a valid date`,
    );
  }

  return timestamp;
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ScheduleDataError(`${context} must be an object`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ScheduleDataError(`${context} must be a non-empty string`);
  }

  return value;
}
