# Working on Companion (notes for Claude)

Base rules and conventions for this repo, so they don't have to be repeated each time.

## Git workflow

- Develop on the designated feature branch for the task. Create it from the latest default branch if it
  doesn't exist yet. Never push to a different branch without explicit permission.
- Commit with clear, descriptive messages. **Only commit and push when explicitly asked to.**
- Do not open a pull request unless explicitly asked.

## Code conventions

- **New function parameters are required, not optional.** Backwards compatibility is not a reason to make
  a parameter optional. When a new argument has a "none" case, model it explicitly (e.g. pass `null`) at
  every call site rather than leaving the parameter optional.
- Match the style, naming and comment density of the surrounding code.

## Build, test and lint

The repo is a Yarn 4 (Corepack) monorepo using project references. From the repo root:

- Typecheck a package (builds referenced projects, e.g. `shared-lib`, first):
  `tsc --build companion/tsconfig.json`
- Typecheck the tests: `tsc --build tsconfig.vitest.json`
- Run tests: `vitest run <path>` (config at repo root `vitest.config.ts`).
- Lint: `eslint <files>` (config `eslint.config.mjs`). ESLint runs Prettier; `eslint --fix` handles most
  formatting. Note: `no-unnecessary-type-assertion` can flag an `as any` that is actually needed to avoid
  "excessively deep type instantiation" from deep mocks - prefer an `any`-typed local/helper in that case.

## Feedback evaluation model

Internal feedbacks are normally evaluated eagerly and cached. Internal feedbacks that are children of an
action are instead evaluated lazily at action-execution time (so execution-context `$(this:*)` variables
can be injected). See `companion/lib/Internal/README.md` for details.
