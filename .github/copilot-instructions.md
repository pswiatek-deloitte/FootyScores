# FootyScores Copilot Instructions

## Project mission

This repository contains a recruitment assignment for a CLI that generates one
reference API endpoint for every football match played at the Paris 2024
Olympic Games. The official competition schedule is the source of truth:

<https://stacy.olympics.com/en/paris-2024/competition-schedule>

Before making changes, read `task/readme.md` and `task/example.json`. Treat
the assignment acceptance criteria as requirements, not suggestions.

## Frozen task materials

- Treat every file under `task/` as an immutable source-of-truth artifact.
- Read `task/readme.md` and `task/example.json` to understand the assignment,
  but never edit, rename, delete, reformat, or regenerate files under `task/`
  unless the user explicitly requests that specific change.
- Put implementation documentation in the root `readme.md`, and put tests and
  sanitized runtime fixtures in `test/`.

## Runtime and repository layout

- The implementation uses TypeScript in ESM mode on Node.js 22 or newer, with
  npm as the package manager.
- Production code belongs in `src/`; tests belong in `test/`; compiled output
  is generated in `dist/` and must not be edited by hand.
- Run `npm ci` after cloning, then use `npm run check` before submitting a
  change. The check includes formatting, linting, type-checking, tests, and a
  production build.
- Keep the CLI entry point small. Put schedule acquisition, parsing,
  normalization, filtering, endpoint rendering, and detailed result mapping in
  independently testable modules.

## Working rules

- Inspect the repository and existing conventions before proposing a design.
- Make the smallest coherent change that satisfies the requirement.
- Keep source acquisition, parsing, domain normalization, filtering, and
  endpoint rendering as separate responsibilities.
- Prefer explicit types, validation, and actionable errors over silent
  fallbacks or broad exception handling.
- Do not invent match data, endpoint paths, identifiers, scores, or dates.
- Do not put credentials, API keys, or machine-specific paths in the
  repository.
- If the assignment or sample is ambiguous, document the assumption and its
  effect on the output. Do not silently choose a format that cannot be
  justified from the source or API contract.

## Data and output contract

- Use the official Olympic schedule as the authoritative input and make its
  URL configurable where practical.
- Process football matches only. Do not rely on a fragile display-name
  substring check without testing the source's sport and discipline fields.
- Include both men's and women's football when the schedule identifies them as
  football, and document the choice.
- Preserve a stable match identity and reject records that cannot be uniquely
  identified.
- Normalize time zones before sorting. Output order must be deterministic:
  kickoff in UTC, then a stable match identifier and any other documented
  tie-breakers.
- Deduplicate by the canonical match identity before rendering endpoints.
- Keep diagnostics off standard output when standard output is the endpoint
  stream. Use a non-zero exit code for invalid input or incomplete output.
- The current endpoint convention is
  `/api/matches/{competition}/{local-kickoff}/{home}-vs-{away}`. The
  competition is `Paris 2024`, the kickoff is the source-local
  `YYYY-MM-DD-HHmm`, and names are normalized to lowercase URL segments.
- `task/example.json` is a match-shaped JSON example rather than an explicit
  URL specification. Keep endpoint generation separate from the richer match
  response model and explain the mapping in the documentation. Detailed
  exports must include the stable match code, endpoint URL, and mapped `data`
  object.
- Use the official `RES_ByRSC_H2H` result feed for detailed match data. Keep
  detail requests behind the source adapter and limit concurrent requests.
- When the result feed lacks a field, use an explicit documented fallback
  rather than silently inventing a value. Current documented fallbacks include
  `open_play` for unclassifiable non-penalty goals, minute `120` for shootout
  events, and `Unknown` for an unavailable coach.

## Testing and reproducibility

- Unit-test source parsing, football filtering, time normalization,
  identity/deduplication, ordering, endpoint rendering, and malformed-input
  errors.
- Use checked-in, sanitized fixtures for tests; tests must not depend on a
  live Olympic website or the current date.
- Add an integration or smoke test for the CLI that verifies one endpoint per
  line, stable ordering, no duplicates, and a useful failure mode.
- When refreshing real schedule data, record the source URL and retrieval
  context without making generated output depend on network timing.
- Run the repository's available formatting, linting, type-checking, and test
  commands after implementation. Update the command documentation when a new
  command is introduced.

## Documentation expectations

Keep `readme.md` current with installation, CLI usage, source provenance,
output examples, deterministic ordering, assumptions, testing, and deployment
instructions. Explain meaningful trade-offs so another engineer can defend
the implementation without relying on the AI conversation.
