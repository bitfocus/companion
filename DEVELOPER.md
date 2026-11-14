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

Some screenshots in the docs are taken automatically, in both the light and dark theme, from a real Companion seeded with the examples the page describes. To update them after changing the ui:

```bash
yarn docs:screenshots
```

This builds the webui if it hasn't been built, and only rewrites the images that have changed. Without `--update-snapshots` (`yarn playwright test -c e2e/docs-screenshots.config.ts`) it checks that they are still up to date instead.

- The examples are seeded by a scenario in `companion/test/docs-scenarios/`, which builds them with the integration-test fixture.
- The screenshots are taken by a `*.shots.ts` file in `e2e/docs-screenshots/`, with `shoot()`, which writes `<name>.light.png` and `<name>.dark.png` next to the page.
- A page shows them as a normal image without the theme, `![…](images/my-page/name.png)`, and the site shows the one matching its theme.

Screenshots differ a little between machines (fonts, antialiasing), so take them all on the same one.
