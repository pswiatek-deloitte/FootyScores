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

describe("CLI scaffold", () => {
  it("prints usage when no arguments are provided", () => {
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = run([], stdout.output, stderr.output);

    expect(exitCode).toBe(0);
    expect(stdout.read()).toContain("Usage: footyscores");
    expect(stderr.read()).toBe("");
  });

  it("prints the package version", () => {
    const stdout = createOutput();

    const exitCode = run(["--version"], stdout.output);

    expect(exitCode).toBe(0);
    expect(stdout.read()).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it("rejects unsupported arguments with a non-zero exit code", () => {
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = run(["--unknown"], stdout.output, stderr.output);

    expect(exitCode).toBe(2);
    expect(stdout.read()).toBe("");
    expect(stderr.read()).toContain("Unknown option or argument: --unknown");
  });
});
