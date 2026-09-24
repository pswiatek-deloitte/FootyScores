import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { run, type TextOutput } from "../src/cli.js";

function createOutput(): { output: TextOutput; read: () => string } {
  let content = "";
  const output: TextOutput = {
    write(message: string): void {
      content += message;
    },
  };

  return {
    output,
    read: () => content,
  };
}

describe("CLI", () => {
  it("prints usage when help is requested", async () => {
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = await run(["--help"], stdout.output, stderr.output);

    expect(exitCode).toBe(0);
    expect(stdout.read()).toContain("Usage: footyscores");
    expect(stderr.read()).toBe("");
  });

  it("prints the package version", async () => {
    const stdout = createOutput();

    const exitCode = await run(["--version"], stdout.output);

    expect(exitCode).toBe(0);
    expect(stdout.read()).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it("generates endpoints from an offline schedule file", async () => {
    const stdout = createOutput();
    const fixturePath = fileURLToPath(
      new URL("./fixtures/schedule.json", import.meta.url),
    );

    const exitCode = await run(
      ["--input", fixturePath],
      stdout.output,
      createOutput().output,
    );

    expect(exitCode).toBe(0);
    expect(stdout.read()).toBe(
      "/api/matches/paris-2024/2024-07-25-1700/spain-vs-japan\n" +
        "/api/matches/paris-2024/2024-07-25-1600/united-states-vs-germany\n",
    );
  });

  it("rejects unsupported arguments with a non-zero exit code", async () => {
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = await run(["--unknown"], stdout.output, stderr.output);

    expect(exitCode).toBe(2);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain("Unknown option or argument: --unknown");
  });
});
