import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import packageJson from "../package.json" with { type: "json" };
import { generateEndpoint } from "./endpoint.js";
import {
  OFFICIAL_FOOTBALL_SCHEDULE_URL,
  fetchSchedulePayload,
  parseSchedulePayload,
  readSchedulePayload,
} from "./source/olympic-schedule.js";

export interface TextOutput {
  write(message: string): void;
}

const usage = `Usage: footyscores [options]

Options:
  --input <path>   Read schedule JSON from a local file instead of the official source
  --source <url>   Override the official schedule JSON URL
  --format <type>  Output "lines" (default) or "json"
  -h, --help       Show this help message
  -v, --version    Show the CLI version
`;

interface CliOptions {
  readonly inputPath: string | undefined;
  readonly sourceUrl: string;
  readonly format: "lines" | "json";
}

type ParsedCommand =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | { readonly kind: "run"; readonly options: CliOptions };

class CliUsageError extends Error {}

export async function run(
  argv: readonly string[],
  stdout: TextOutput = process.stdout,
  stderr: TextOutput = process.stderr,
): Promise<number> {
  try {
    const command = parseArguments(argv);

    if (command.kind === "help") {
      stdout.write(usage);
      return 0;
    }

    if (command.kind === "version") {
      stdout.write(`${packageJson.version}\n`);
      return 0;
    }

    const payload =
      command.options.inputPath === undefined
        ? await fetchSchedulePayload(command.options.sourceUrl)
        : await readSchedulePayload(command.options.inputPath);
    const matches = parseSchedulePayload(payload);
    const endpoints = matches.map((match) => generateEndpoint(match));

    if (command.options.format === "json") {
      stdout.write(`${JSON.stringify(endpoints, null, 2)}\n`);
    } else {
      stdout.write(`${endpoints.join("\n")}\n`);
    }

    return 0;
  } catch (error) {
    stderr.write(`Error: ${errorMessage(error)}\n`);
    return error instanceof CliUsageError ? 2 : 1;
  }
}

function parseArguments(argv: readonly string[]): ParsedCommand {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    return { kind: "help" };
  }

  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
    return { kind: "version" };
  }

  let inputPath: string | undefined;
  let sourceUrl = OFFICIAL_FOOTBALL_SCHEDULE_URL;
  let sourceWasProvided = false;
  let format: CliOptions["format"] = "lines";

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--input") {
      inputPath = requiredArgument(argv, index, "--input");
      index += 1;
    } else if (argument === "--source") {
      sourceUrl = requiredArgument(argv, index, "--source");
      sourceWasProvided = true;
      index += 1;
    } else if (argument === "--format") {
      const value = requiredArgument(argv, index, "--format");

      if (value !== "lines" && value !== "json") {
        throw new CliUsageError(`Unsupported output format "${value}"`);
      }

      format = value;
      index += 1;
    } else {
      throw new CliUsageError(
        `Unknown option or argument: ${argument ?? "(missing argument)"}`,
      );
    }
  }

  if (inputPath !== undefined && sourceWasProvided) {
    throw new CliUsageError("--input and --source cannot be used together");
  }

  return {
    kind: "run",
    options: {
      inputPath,
      sourceUrl,
      format,
    },
  };
}

function requiredArgument(
  argv: readonly string[],
  index: number,
  option: string,
): string {
  const value = argv[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new CliUsageError(`${option} requires a value`);
  }

  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isEntrypoint(): boolean {
  const mainModule = process.argv[1];
  return (
    mainModule !== undefined &&
    import.meta.url === pathToFileURL(resolve(mainModule)).href
  );
}

if (isEntrypoint()) {
  void run(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
