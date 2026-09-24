import packageJson from "../package.json" with { type: "json" };
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export interface TextOutput {
  write(message: string): void;
}

const usage = `Usage: footyscores [options]

Options:
  -h, --help       Show this help message
  -v, --version    Show the CLI version
`;

export function run(
  argv: readonly string[],
  stdout: TextOutput = process.stdout,
  stderr: TextOutput = process.stderr,
): number {
  if (argv.length === 0) {
    stdout.write(usage);
    return 0;
  }

  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    stdout.write(usage);
    return 0;
  }

  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
    stdout.write(`${packageJson.version}\n`);
    return 0;
  }

  stderr.write(`Unknown option or argument: ${argv.join(" ")}\n`);
  stderr.write("Run `footyscores --help` for usage.\n");
  return 2;
}

function isEntrypoint(): boolean {
  const mainModule = process.argv[1];
  return (
    mainModule !== undefined &&
    import.meta.url === pathToFileURL(resolve(mainModule)).href
  );
}

if (isEntrypoint()) {
  process.exitCode = run(process.argv.slice(2));
}
