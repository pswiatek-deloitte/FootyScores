# FootyScores Copilot Instructions

## Project mission

This repository contains a recruitment assignment for a CLI that generates one
reference API endpoint for every football match played at the Paris 2024
Olympic Games. The official competition schedule is the source of truth:

<https://stacy.olympics.com/en/paris-2024/competition-schedule>

Before making changes, read `readme.md` and `example.json`. Treat the
assignment acceptance criteria as requirements, not suggestions.

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
- `example.json` is a match-shaped JSON example rather than an explicit URL
  specification. Reconcile this distinction with the API contract in the
  implementation and explain the mapping in the documentation.

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

