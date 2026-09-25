# FootyScores reference endpoint generator

This repository contains a deterministic TypeScript CLI for generating
reference endpoints for every football match played at the Paris 2024 Olympic
Games.

The tool is intended for the engineers and automated test pipeline validating
the FootyScores API. It produces reference paths and, optionally, the expected
match data behind those paths. It is a batch generator, not an HTTP server: it
does not serve `/api/matches/...` requests itself.

## Quick start

### Prerequisites

- Node.js 22 or newer
- npm
- Network access for live schedule and detailed-result exports

### Install and check

Run these commands from the repository root:

```bash
npm ci
npm run check
```

The `check` command runs formatting verification, ESLint, TypeScript
type-checking, the offline test suite, and the production build. The build
creates `dist/cli.js`.

### Generate live endpoints

```bash
node dist/cli.js > endpoints.txt
```

Without `--input`, the CLI retrieves the official Paris 2024 football
schedule. It writes one endpoint per line to standard output. Errors are
written to standard error and cause a non-zero exit code.

At the time of the last live source check, the official feed produced 58 unique
football matches. The number is derived from the source at runtime rather than
hard-coded.

## CLI usage

Use the compiled CLI for commands with options. This avoids differences in how
npm versions forward command-line arguments.

| Command | Purpose |
| --- | --- |
| `node dist/cli.js` | Generate one live endpoint per line |
| `node dist/cli.js --format json` | Generate a JSON array of endpoint strings |
| `node dist/cli.js --details --format json` | Generate detailed match references |
| `node dist/cli.js --source <url>` | Read the schedule from another JSON URL |
| `node dist/cli.js --input <path>` | Read a local schedule JSON fixture |
| `node dist/cli.js --help` | Display command usage |
| `node dist/cli.js --version` | Display the package version |

`--input` and `--source` cannot be used together. `--details` requires
`--format json`.

### Common live exports

Generate line-oriented endpoints:

```bash
node dist/cli.js > endpoints.txt
```

Generate endpoint values as JSON:

```bash
node dist/cli.js --format json > endpoints.json
```

Keep diagnostics separate when running from a scheduled job:

```bash
node dist/cli.js > endpoints.txt 2> errors.txt
```

## Endpoint contract

Every endpoint follows this format:

```text
/api/matches/{competition}/{local-kickoff}/{home}-vs-{away}
```

Example:

```text
/api/matches/paris-2024/2024-07-24-1500/argentina-vs-morocco
```

The generator applies these rules:

- `competition` is normalized from `Paris 2024` to `paris-2024`.
- The kickoff segment preserves the source-local date and time as
  `YYYY-MM-DD-HHmm`.
- Team names are lowercased, diacritic-normalized, and converted to URL-safe
  segments.
- Matches are sorted by timezone-normalized UTC kickoff, then by stable
  Olympic match code.
- Exact duplicate records are removed by stable match code.
- Conflicting records with the same code fail instead of producing an
  ambiguous endpoint.
- Both men's and women's football are included.

The JSON output from `--format json` is an array of endpoint strings. The
default output is line-oriented so it can be passed directly to another test
or shell pipeline.

## Detailed match references

The detailed mode retrieves one official result payload per normalized match
and produces a JSON array containing the endpoint and its expected response
data:

```bash
node dist/cli.js --details --format json > references.json
```

Each item has this shape:

```json
{
  "code": "FBLMTEAM11------------GPB-000100--",
  "endpointURL": "/api/matches/paris-2024/2024-07-24-1500/argentina-vs-morocco",
  "data": {
    "competition": {},
    "venue": {},
    "kickoff": "2024-07-24T15:00:00+02:00",
    "status": "FT",
    "teams": {},
    "score": {},
    "scorers": [],
    "lineups": {}
  }
}
```

The `data` object follows the response shape in
[`task/example.json`](task/example.json), including halftime scores, scorers,
assists, formations, coaches, starting elevens, and benches. The endpoint path
and detailed response model are intentionally separate because the supplied
example describes match data rather than an explicit URL syntax.

Detailed requests use the official result feed:

```text
https://stacy.olympics.com/OG2024/data/RES_ByRSC_H2H~comp=OG2024~disc=FBL~rscResult={MATCH_CODE}~lang=ENG.json
```

Requests are limited to four concurrent detail fetches and references retain
the deterministic schedule order.

### Source-data fallbacks

The official result feed does not always provide every field needed by the
example response. The mapper uses explicit documented fallbacks:

- Unclassifiable non-penalty goals use `open_play`.
- `PEN` and `PENALTY` events use `penalty`.
- Own goals credit the recorded player but assign the goal to the opposing
  team.
- Shootout events use minute `120`.
- A missing head coach uses an available stand-in or other coach; if none is
  available, the value is `Unknown`.
- Olympic position subcodes are mapped to common labels such as `GK`, `RB`,
  `CB`, `LB`, `CM`, `LW`, and `ST`.

## Reproducible offline usage

Automated tests use checked-in sanitized fixtures and do not depend on the
live Olympic website.

Generate endpoints from the schedule fixture:

```bash
node dist/cli.js --input test/fixtures/schedule.json
node dist/cli.js --input test/fixtures/schedule.json --format json
```

The fixture contains men's and women's football, a non-football record, a
placeholder, an exact duplicate, and timezone variations.

Run the repeatable fixture smoke check:

```bash
npm run --silent smoke
```

It reports the number of input records, accepted matches, excluded records,
exact duplicates, invalid records, and unique endpoints. The checked-in
fixture currently reports 5 input records, 2 accepted matches, 2 excluded
records, 1 duplicate, 0 invalid records, and 2 unique endpoints.

The detailed CLI still retrieves result data from the official result feed even
when `--input` supplies a local schedule. The detailed mapper itself is tested
offline with `test/fixtures/match.json`.

## Testing and quality commands

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` is the recommended pre-submission command. Tests cover source
parsing, football filtering, duplicate handling, timezone ordering, endpoint
rendering, detailed score and lineup mapping, bounded concurrency, malformed
input, and CLI failures.

## Official data sources

- Competition schedule page:
  <https://stacy.olympics.com/en/paris-2024/competition-schedule>
- Football schedule feed:
  <https://stacy.olympics.com/OG2024/data/SCH_StartList~comp=OG2024~disc=FBL~lang=ENG.json>
- Detailed result feed:
  `https://stacy.olympics.com/OG2024/data/RES_ByRSC_H2H~comp=OG2024~disc=FBL~rscResult={MATCH_CODE}~lang=ENG.json`

The schedule feed is the source of truth for match identity, teams, kickoff,
venue, and status. The result feed is used only for the optional detailed
response mapping.

## Deployment

This is a batch CLI, so deployment requires Node.js and the compiled output
rather than a web server.

Build the release artifact in CI or a build environment:

```bash
npm ci
npm run build
```

The runtime artifact must contain:

- `dist/`
- `package.json`
- `package-lock.json`

Install only production dependencies in the runtime environment:

```bash
npm ci --omit=dev
node dist/cli.js > endpoints.txt
```

For a detailed export:

```bash
node dist/cli.js --details --format json > references.json
```

No credentials or server-side configuration are required. Keep standard output
for generated references and standard error for diagnostics so scheduled jobs
can handle them independently.

## Project structure

```text
src/
  cli.ts                         CLI parsing and orchestration
  endpoint.ts                    Endpoint rendering
  domain/match.ts                Match identity, deduplication, ordering
  domain/footy-score.ts          Detailed response types
  source/http.ts                 JSON transport and HTTP errors
  source/validation.ts           Source-payload validation
  source/olympic-schedule.ts     Official schedule adapter
  source/olympic-match.ts        Official detailed-result adapter
  smoke.ts                       Offline fixture smoke check
test/
  fixtures/                     Sanitized offline source payloads
  *.test.ts                      Unit and CLI tests
task/
  readme.md                     Frozen assignment brief
  example.json                  Frozen response-shape example
```

The `task/` directory is read-only source material for the assignment. Put
implementation documentation in this root README and new runtime fixtures in
`test/fixtures/`.
