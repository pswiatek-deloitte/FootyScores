import { resolve } from "node:path";
import type { MatchMetadata } from "./domain/match.js";
import { deduplicateAndSortMatches } from "./domain/match.js";
import { generateEndpoint } from "./endpoint.js";
import { asRecord } from "./source/validation.js";
import {
  parseSchedulePayload,
  readSchedulePayload,
} from "./source/olympic-schedule.js";

const fixturePath = resolve(process.cwd(), "test", "fixtures", "schedule.json");

interface SmokeSummary {
  readonly inputRecords: number;
  readonly acceptedMatches: number;
  readonly excludedRecords: number;
  readonly duplicateRecords: number;
  readonly invalidRecords: number;
  readonly uniqueEndpoints: number;
}

async function main(): Promise<void> {
  const payload = await readSchedulePayload(fixturePath);
  const root = asRecord(payload, "smoke fixture");
  const schedules = root["schedules"];

  if (!Array.isArray(schedules)) {
    throw new Error('Smoke fixture must contain a "schedules" array');
  }

  const validCodes = new Set<string>();
  const validMatches: MatchMetadata[] = [];
  let excludedRecords = 0;
  let duplicateRecords = 0;
  let invalidRecords = 0;

  for (const [index, value] of schedules.entries()) {
    if (!isRecord(value)) {
      invalidRecords += 1;
      continue;
    }

    const code = value["code"];

    if (typeof code !== "string" || code.trim().length === 0) {
      invalidRecords += 1;
      continue;
    }

    if (!code.startsWith("FBL")) {
      excludedRecords += 1;
      continue;
    }

    const start = value["start"];

    if (!Array.isArray(start) || start.length !== 2) {
      excludedRecords += 1;
      continue;
    }

    try {
      const [match] = parseSchedulePayload({ schedules: [value] });

      if (match === undefined) {
        invalidRecords += 1;
        continue;
      }

      validMatches.push(match);
    } catch (error) {
      invalidRecords += 1;
      const detail = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Invalid smoke record ${index + 1}: ${detail}\n`);
      continue;
    }

    if (validCodes.has(code)) {
      duplicateRecords += 1;
    } else {
      validCodes.add(code);
    }
  }

  const matches =
    invalidRecords === 0
      ? parseSchedulePayload(payload)
      : deduplicateAndSortMatches(validMatches);
  const summary: SmokeSummary = {
    inputRecords: schedules.length,
    acceptedMatches: matches.length,
    excludedRecords,
    duplicateRecords,
    invalidRecords,
    uniqueEndpoints: new Set(matches.map((match) => generateEndpoint(match)))
      .size,
  };

  process.stdout.write(
    [
      `Fixture smoke check: ${fixturePath}`,
      `Input records: ${summary.inputRecords}`,
      `Accepted football matches: ${summary.acceptedMatches}`,
      `Excluded records: ${summary.excludedRecords}`,
      `Exact duplicate records: ${summary.duplicateRecords}`,
      `Invalid records: ${summary.invalidRecords}`,
      `Unique endpoints: ${summary.uniqueEndpoints}`,
    ].join("\n") + "\n",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
