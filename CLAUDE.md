# Working on Companion (core repo)

Notes for agents/contributors working on this repository, so the conventions don't have to be
repeated each time. See `DEVELOPER.md` for the human-facing setup guide; this file captures the
day-to-day workflow, conventions and gotchas in one place.

## Git workflow

- Develop on the designated feature branch for the task. Create it from the latest default branch
  if it doesn't exist yet. **Never push to a different branch without explicit permission.**
- Commit with clear, descriptive messages. **Only commit and push when explicitly asked to.**
- **Do not open a pull request unless explicitly asked.**

## Commands

This is a Yarn 4 (Berry, via Corepack) monorepo using TypeScript project references — always use
`yarn`, never `npm`.

```bash
yarn install          # install dependencies (Corepack provides yarn 4)
yarn test             # run all tests (vitest, watch mode)
yarn test --run       # run all tests once
yarn vitest run       # run all tests once (CI-style); add a path/pattern to scope
yarn vitest run --project companion <path>   # scope to one project + path
yarn check-types      # type-check everything (tsc --build across all packages)
yarn lint             # eslint (prettier runs inside eslint)
yarn format           # prettier --write .
```

Vitest projects are `companion`, `webui`, `shared-lib`, and `config-tool` (config at the repo root
`vitest.config.ts`). Scope with `--project <name>` and/or a path to keep runs fast.

Finer-grained invocations when you don't want the whole suite:

- Typecheck one package (builds its referenced projects, e.g. `shared-lib`, first):
  `tsc --build companion/tsconfig.json`
- Typecheck the tests: `tsc --build tsconfig.vitest.json`
- Run a single test file: `yarn vitest run <path>`
- Lint specific files: `eslint <files>` (config `eslint.config.mjs`); `eslint --fix` handles most
  formatting.

Before finishing a change, make sure `yarn check-types`, `yarn lint`, and `yarn vitest run` all
pass. A husky + lint-staged **pre-commit hook** runs `eslint` and `tsc --build` on staged files, so a
commit will fail if types or lint don't pass — expect that and fix it rather than bypassing the hook.

## Repository layout

- `companion/` — the backend (Node). Feedback/style/graphics logic lives here:
  `lib/Controls/Entities/` (entity pools & instances), `lib/Graphics/` (element conversion,
  rendering), `lib/Variables/` (expression evaluation), `lib/Internal/` (internal actions/feedbacks),
  `lib/Data/` (SQLite-backed stores). Tests live in `companion/test/**` mirroring `lib/`.
- `webui/` — the frontend (React + Vite). Tests are co-located in `__tests__/` dirs (jsdom).
- `shared-lib/` — `@companion-app/shared`: types/models & pure logic shared by backend and frontend
  (`lib/Model/`, `lib/Expressions.ts`, …). Tests in co-located `__tests__/` dirs.
- `config-tool/`, `launcher/`, `launcher-ui/`, `docs/` — supporting packages.

## Code conventions

- **New function parameters are required, not optional.** Backwards compatibility is NOT a good
  enough reason to make a parameter optional. When adding a parameter, thread it through all call
  sites rather than defaulting it. When a new argument has a "none" case, model it explicitly (e.g.
  pass `null`) at every call site rather than leaving the parameter optional.
- Match the style, naming and comment density of the surrounding code.
- When changing behaviour, improve unit-test coverage for it; do not rely on manual testing alone.

### Formatting (enforced by Prettier, via ESLint)

- Tabs, no semicolons, single quotes, printWidth 120.
- Imports are auto-sorted (`@ianvs/prettier-plugin-sort-imports`); let `yarn format` /
  `eslint --fix` handle ordering.
- Prefer `import type { … }` for type-only imports (enforced by lint).
- Gotcha: `@typescript-eslint/no-unnecessary-type-assertion` can flag an `as any` that is actually
  needed to avoid "excessively deep type instantiation" from deep mocks — prefer an `any`-typed
  local/helper in that case.

### Styling (`webui`, Tailwind CSS v4)

- **Order of preference for styling an element:**
  1. **A custom/semantic class** in the component's own CSS, where it makes sense — anything reusable,
     stateful, or more than a couple of one-off utilities reads better as a named class (e.g.
     `.connections-list-container`) than a long utility soup.
  2. **Simple Tailwind utilities** for genuinely one-off layout/spacing/visibility (`flex`, `gap-2`,
     `mb-2`, `hidden`, `min-w-0`, …). Use logical utilities for left/right (`ms`/`me`, `ps`/`pe`),
     matching the surrounding code.
  3. **Inline `style` props only for values that are truly dynamic from React** — computed from state
     or props at runtime (`style={{ minHeight: viewportMinHeight }}`, `style={{ width: glyphWidth }}`).
     A static value in a `style` prop should be a class instead.
- **No arbitrary values.** The codebase uses none — do not introduce `w-[30px]` / `bg-[#abc]`. If a
  static value has no clean utility (off-scale px, `em`/`vh`, a one-off colour), give it a custom class
  or a theme token rather than reaching for `[…]` or leaving it inline.
- **Colours and fonts come from theme tokens** in `webui/src/tailwind.css` (`@theme` `--color-*`,
  `--font-sans`/`--font-mono`). Reference those (or the generated `bg-*`/`text-*` utilities); don't
  hardcode hex. Add a new `--color-*` token there when one is genuinely missing.
- **Layout grid.** Use the `Grid` components (`webui/src/Components/Grid.tsx`), not grid classes in
  markup: `Grid.Container`, `Grid.Row` (a 12-column CSS grid; `columns={n}` for a different count) and
  `Grid.Col` (`xs`…`xxl`, each a span or `{ span, offset }`); `Form` and `Collapse.Panel` take a `row`
  prop to act as the row themselves. A column with no span fills the row. The gutter is a real `gap` —
  override it with `gap-2`/`sm:gap-2`/`gap-x-0`, not a gutter class. `.row`/`.page-container` live in
  `webui/src/layout-grid.css`; the `col-span-*`/`col-start-*` utilities `Grid.Col` emits are built by
  interpolation, so `tailwind.css` safelists them with `@source inline(...)`.
- **Page layout.** A page that is a list plus what it opens uses `SplitPanels`
  (`webui/src/Layout/SplitPanels.tsx`), not the 12-column grid: `SplitPanels.Root` takes
  `showing="primary" | "secondary" | null` for which panel wins when there is only room for one, and
  `.Primary`/`.Secondary` are the panels. The split is half-and-half above `xl` and one panel below.
- **Cascade layers** (low → high): `base < layout-grid < app-base < components < features <
utilities` (declared in `tailwind.css`). App CSS is assigned to a layer by path at build time
  (`postcss-wrap-layer.mjs`): `src/Components/**` → `components`, a fixed set (`common.css`, `nav.css`,
  `layout.css`, …) → `app-base`, everything else → `features`. Layer order beats specificity, so a
  lower-layer rule can never override a class defined in a higher layer — put a component override in
  that component's own CSS (the `components` layer), not in an `app-base` file like `common.css`.

## Testing notes

- Framework is **Vitest** (not Jest). Prefer pure/unit tests where possible; heavy UI components
  (e.g. anything rendering the Monaco expression editor) are awkward in jsdom, so extract testable
  logic into plain functions and test those.
- Backend pool/entity tests use the shared harness in
  `companion/test/Controls/Entities/EntityListPoolTestHelpers.ts` (mocked collaborators + real class
  under test). The pool schedules debounced timers, so those tests use `vi.useFakeTimers()`.

## Environment & tooling

- The Node version is pinned in `.node-version` (also enforced by `package.json` `engines`). The data
  layer relies on it: `node:sqlite` (used by `lib/Data/`) is only a stable builtin on that Node
  version, so use it rather than an older Node.
- Corepack provides Yarn 4 — run `corepack enable` if `yarn` isn't already the Berry release. Do not
  fall back to the global Yarn 1.
- `yarn install` is enough to start developing — you do **not** need to run `yarn build:ts` first.
  Tests, lint, `dev` and the production build all resolve `@companion-app/shared` (and the other
  workspace packages) to their raw TS sources via the `companion:source` export condition, so there
  is no separate `dist` to keep in sync. `yarn check-types` is `tsc --build` and still emits `dist` as
  a by-product of type-checking the project references, but you never invoke `build:ts` as a
  prerequisite. Run `yarn build:ts` only to produce the distributable `dist` output (packaging, and
  the plain-JS `launcher` which loads `@companion-app/shared` from `dist` at runtime).

### Claude Code on the web

A `SessionStart` hook (`.claude/hooks/session-start.sh`) provisions the container for remote sessions:
it installs the `.node-version` Node if the base image is older, activates Yarn 4 via Corepack, then
runs `yarn install` (no `build:ts` — see above). It only runs in the remote environment (guarded by
`$CLAUDE_CODE_REMOTE`).
