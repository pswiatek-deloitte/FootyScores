---
name: olympic-football-endpoints
description: Build or review a deterministic CLI that converts the official Paris 2024 Olympic competition schedule into one reference API endpoint per football match. Use when implementing schedule ingestion, parsing, filtering, normalization, deduplication, endpoint generation, or related tests and documentation.
compatibility: Network access is needed only when refreshing the official schedule; automated tests must run offline with checked-in fixtures.
---

# Olympic football endpoint generation

Use this skill for implementation or review work related to the FootyScores
recruitment assignment.

## Required workflow

1. Read `task/readme.md` and `task/example.json`, then inspect the repository's runtime,
   dependency, test, and CI configuration before changing code.
2. Write down the input shape, canonical match identity, output shape, sorting
   rule, and assumptions. Stop and resolve ambiguity rather than guessing.
3. Keep the following pipeline stages independently testable:
   - fetch or load the official schedule;
   - parse the source response;
   - normalize a match into an internal model;
   - select football matches;
   - deduplicate and sort;
   - render the endpoint in the required format;
   - optionally fetch and map the official detailed result into the
     `task/example.json` response shape.
4. Test each stage with offline fixtures before testing the complete CLI.
5. Update the README with the exact install, run, test, deployment, and data
   refresh commands.

## Source handling

- Use the official schedule URL as the source of truth:
  `https://stacy.olympics.com/en/paris-2024/competition-schedule`
- Isolate network access behind a source adapter so parsing and tests do not
  require the network.
- Fail clearly on HTTP errors, malformed responses, missing required fields, or
  an empty result when football matches are expected.
- Never silently replace the official source with search results, guessed
  fixtures, or stale data.
- Do not make tests depend on the current date, request timing, or live website
  availability.

## Match selection and normalization

- Identify football using the source's structured sport or discipline data
  whenever available. Treat men's and women's football as separate competitions
  when the source distinguishes them.
- Preserve the source's stable event or match identifier. If no stable
  identifier exists, define and test a documented composite identity.
- Parse timezone-aware kickoff values and normalize them before comparing or
  sorting.
- Validate the fields required by the endpoint contract. Report the record and
  field that failed validation.
- Deduplicate before output. A duplicate must not be hidden by rendering two
  equivalent URLs.

## Deterministic endpoint output

- Use `/api/matches/{competition}/{local-kickoff}/{home}-vs-{away}`. For this
  assignment, the competition segment is `paris-2024`, the kickoff segment is
  the source-local `YYYY-MM-DD-HHmm`, and team names are lowercase,
  diacritic-free URL segments.
- Keep the endpoint format separate from the richer JSON match response shown
  in `task/example.json`; the JSON sample documents match data, while the generated
  output is the API path used to retrieve that data.
- For detailed references, emit a stable match code, `endpointURL`, and
  `data` object. Use the official `RES_ByRSC_H2H` feed and bounded concurrency.
- Document source limitations in the output contract. In this assignment,
  non-penalty goal types fall back to `open_play`, own goals are assigned to
  the opposing scoring team, shootout events use minute `120`, and missing
  coaches use an explicit `Unknown` fallback after checking stand-in coaches.
- Make serialization stable: fixed field ordering where relevant, consistent
  escaping, and no timestamps or random values generated at runtime.
- Sort by normalized UTC kickoff, then canonical match identity and documented
  tie-breakers.
- Emit exactly one endpoint per line when the CLI is acting as a line-oriented
  reference generator. Send progress and diagnostics to standard error.
- Ensure repeated runs with the same fixture produce byte-for-byte identical
  output.

## Minimum verification

Cover at least:

- a valid football match;
- a non-football event that must be excluded;
- men's and women's football when present in the fixture;
- duplicate source records;
- equal kickoff times;
- time-zone conversion across a date boundary;
- missing identifiers or kickoff values;
- malformed source data;
- a network or input failure with a non-zero CLI exit code;
- stable output from two runs over the same fixture.

Do not claim complete schedule coverage from a unit test alone. Add a
repeatable fixture-based smoke check that reports the number of accepted,
excluded, duplicate, and invalid records.
