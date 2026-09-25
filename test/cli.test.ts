import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import matchFixture from "./fixtures/match.json" with { type: "json" };
import { run, type CliDependencies, type TextOutput } from "../src/cli.js";

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

  it("produces byte-identical output for repeated runs", async () => {
    const fixturePath = fileURLToPath(
      new URL("./fixtures/schedule.json", import.meta.url),
    );
    const first = createOutput();
    const second = createOutput();

    const firstExitCode = await run(
      ["--input", fixturePath],
      first.output,
      createOutput().output,
    );
    const secondExitCode = await run(
      ["--input", fixturePath],
      second.output,
      createOutput().output,
    );

    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(second.read()).toBe(first.read());
  });

  it("selects one match by its stable Olympic match code", async () => {
    const stdout = createOutput();
    const fixturePath = fileURLToPath(
      new URL("./fixtures/schedule.json", import.meta.url),
    );

    const exitCode = await run(
      [
        "--input",
        fixturePath,
        "--match-code",
        "FBLMTEAM11------------GPA-000400--",
      ],
      stdout.output,
      createOutput().output,
    );

    expect(exitCode).toBe(0);
    expect(stdout.read()).toBe(
      "/api/matches/paris-2024/2024-07-25-1600/united-states-vs-germany\n",
    );
  });

  it("fails when a selected match code is not in the schedule", async () => {
    const stderr = createOutput();
    const fixturePath = fileURLToPath(
      new URL("./fixtures/schedule.json", import.meta.url),
    );

    const exitCode = await run(
      ["--input", fixturePath, "--match-code", "FBLMUNKNOWN------------"],
      createOutput().output,
      stderr.output,
    );

    expect(exitCode).toBe(1);
    expect(stderr.read()).toContain(
      'No football match found for match code "FBLMUNKNOWN------------"',
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

  it("exports detailed match references as JSON", async () => {
    const stdout = createOutput();
    const fixturePath = fileURLToPath(
      new URL("./fixtures/detail-schedule.json", import.meta.url),
    );
    const dependencies: CliDependencies = {
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify(createOfficialDetailFixture()), {
            headers: { "content-type": "application/json" },
          }),
        ),
    };

    const exitCode = await run(
      ["--input", fixturePath, "--details", "--format", "json"],
      stdout.output,
      createOutput().output,
      dependencies,
    );

    expect(exitCode).toBe(0);
    expect(stdout.read()).toContain(
      '"endpointURL": "/api/matches/paris-2024/2024-07-24-1500/argentina-vs-morocco"',
    );
    expect(stdout.read()).toContain('"halfTime":');
    expect(stdout.read()).not.toContain('"starting":');
  });

  it("requires JSON output for detailed references", async () => {
    const stderr = createOutput();

    const exitCode = await run(
      ["--details"],
      createOutput().output,
      stderr.output,
    );

    expect(exitCode).toBe(2);
    expect(stderr.read()).toContain("--details requires --format json");
  });
});

function createOfficialDetailFixture(): unknown {
  const payload = structuredClone(matchFixture) as {
    results: {
      items: Array<{
        teamCode: string;
        participant: { name: string };
      }>;
      playByPlay: Array<{
        actions: Array<{
          competitors: Array<{ pbpc_code: string }>;
        }>;
      }>;
    };
  };
  const teams = [
    { sourceCode: "HOME", code: "FBLMTEAM11--ARG01", name: "Argentina" },
    { sourceCode: "AWAY", code: "FBLMTEAM11--MAR01", name: "Morocco" },
  ];

  payload.results.items.forEach((item, index) => {
    const team = teams[index];

    if (team === undefined) {
      throw new Error(`Fixture is missing team ${index}`);
    }

    item.teamCode = team.code;
    item.participant.name = team.name;
  });

  for (const period of payload.results.playByPlay) {
    for (const action of period.actions) {
      for (const competitor of action.competitors) {
        const team = teams.find(
          (candidate) => candidate.sourceCode === competitor.pbpc_code,
        );

        if (team === undefined) {
          throw new Error(
            `Fixture contains unknown team code ${competitor.pbpc_code}`,
          );
        }

        competitor.pbpc_code = team.code;
      }
    }
  }

  return payload;
}
