# Developer Guide

For documentation on developing modules, please see [the website](https://companion.free/for-developers/module-development/home)

To develop Companion itself (aka core Companion, i.e. this repo), [start here](https://companion.free/for-developers/)

## TL;DR

For core Companion:

```bash
yarn install
yarn dev
```

Connect to it at http://localhost:8000/

Optionally, in another terminal:

```bash
# Run front end in dev mode for auto-refresh
yarn dev:webui
```

Connect to it at http://localhost:5173/

## Environment configuration

A `.env` file in the root of the repository can be used to customise the dev environment. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

See `.env.example` for descriptions of available settings.

## Testing

Unit tests are written with [Vitest](https://vitest.dev/).

```bash
# Run all tests
yarn test --run

# Run tests in watch mode
yarn test
```

## Storybook

The webui has a [Storybook](https://storybook.js.org/) for developing and visually reviewing UI components in isolation.

```bash
yarn dev:storybook
```

Connect to it at http://localhost:6006/

## Linting and formatting

The project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for formatting. Both are enforced via a pre-commit hook (husky + lint-staged), so code will be checked automatically before each commit.

To run them manually:

```bash
# Check for lint errors
yarn lint

# Format all files
yarn format
```

`yarn lint` runs ESLint with `--concurrency auto`, which can use a lot of memory on machines with many cores. To cap the number of workers on your machine only, create a `.env.yarn` file in the root of the repository (it is gitignored, and Yarn loads it into every `yarn` script):

```bash
ESLINT_CONCURRENCY=4
```

Note that `.env` is not used for this, as Yarn does not read it.

## Type checking

TypeScript types across all packages can be checked without running the full build:

```bash
yarn check-types
```

## Docs

The documentation is built with [Docusaurus](https://docusaurus.io/) and lives in the `docs/` package. The same content is bundled into Companion and published at https://companion.free.

```bash
yarn dev:docs
```

Connect to it at http://localhost:4000/

### Screenshots

Screenshots of the Companion ui in the docs are taken automatically with [Playwright](https://playwright.dev/), in both the light and dark theme, from a real Companion seeded with the examples the page describes. Please take new screenshots this way rather than by hand, so that they can be kept up to date as the ui changes.

```bash
# Rewrite the images which have changed. Add E2E_FORCE_WEBUI_BUILD=1 after changing the ui, as an existing webui build is reused
yarn docs:screenshots

# Check that the images are up to date, without changing them
yarn playwright test -c e2e/docs-screenshots.config.ts
```

- The examples are seeded by a scenario in `companion/test/docs-scenarios/`, which builds them with the integration-test fixture. Most pages share `Studio.ts`.
- Connections and surfaces use demo modules (`companion/test/docs-scenarios/modules/`), installed from a stand-in for the module store, so no real modules or network access are needed.
- The screenshots are taken by a `*.shots.ts` file in `e2e/docs-screenshots/`, with `shoot()`, which writes `<name>.light.png` and `<name>.dark.png` next to the page.
- A page shows them as a normal image without the theme, `![…](images/my-page/name.png)`, and the site shows the one matching its theme.

The images of the What's New pages are not regenerated, as they show a feature as it was in that release.

Screenshots differ a little between machines (fonts, antialiasing), so try to minimise churn when updating a page.
