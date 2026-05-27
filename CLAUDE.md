# CLAUDE.md

## Overview

`gh-clear-artifacts` is a TypeScript GitHub Action that deletes workflow
artifacts from a repository, optionally scoped by branch, artifact name (glob),
and age, with a dry-run mode. It is meant to replace inline
`actions/github-script` artifact-cleanup steps.

## Commands

- `npm run build` - bundle `src/index.ts` into `dist/index.js` with `@vercel/ncc`.
- `npm test` - run the Jest unit tests.
- `npm run lint` - run ESLint.
- `npm run all` - build, lint, and test (run this before committing).

## Critical: the committed bundle

The action runs from `dist/index.js` (see `runs.main` in `action.yml`), which is
a generated `ncc` bundle that is committed to the repo. After any change under
`src/` you MUST run `npm run build` and commit the updated `dist/`. CI fails if
`dist/` is out of date with the source.

## Architecture

- `src/filters.ts` - pure functions (`resolveBranch`, `matchesBranch`,
  `matchesName`, `isOlderThan`, `selectArtifacts`). No Octokit or `@actions/core`
  imports, so they are unit-tested directly in `__tests__/filters.test.ts`. Put
  selection/matching logic here.
- `src/main.ts` - `run()`: reads inputs, talks to Octokit, deletes, sets outputs,
  writes the job summary. Side-effecting I/O only; delegate decisions to
  `filters.ts`.
- `src/index.ts` - entrypoint that calls `run()`.

## API gotchas (already handled, keep handled)

- `listArtifactsForRepo` has no branch query parameter. Branch scoping is done
  client-side via `artifact.workflow_run.head_branch`.
- Always paginate (`octokit.paginate`). The naive `per_page: 100` single call
  silently drops artifacts past the first 100.
- `deleteArtifact` returns 204. Individual deletes can fail (already expired or
  removed); log a warning and continue rather than failing the whole run.
- `core.summary.write()` throws when `GITHUB_STEP_SUMMARY` is unset, so it is
  guarded for non-Actions environments.

## Inputs / outputs

Defined in `action.yml`. Branch semantics: empty/`all` = all branches,
`current` = triggering branch, otherwise an exact `head_branch` match.

## Releasing

1. `npm run all` and commit `src` + `dist` together.
2. Tag a semver release, e.g. `git tag v1.0.0`.
3. Move the major alias so consumers tracking `@v1` get it:
   `git tag -f v1 && git push origin v1.0.0 && git push -f origin v1`.

## Conventions

- Markdown: no bold text, no em-dashes (per global guidelines).
- The R/Python guidelines in the global config do not apply to this TypeScript
  project.
