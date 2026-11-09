# @companion-app/launcher-ui

The windows of the desktop launcher, as two Vite pages:

- `launcher.html` — the main launcher window (status, interface/port, launch buttons).
- `index.html` — the advanced settings window.

Both are React + Vite + Tailwind, sharing the components in `src/components/ui/` (based on
[shadcn/ui](https://ui.shadcn.com/)) and the theme in `src/tailwind.css`.

In development the launcher loads them from the Vite dev server (`yarn workspace @companion-app/launcher-ui dev`,
port 5177); packaged builds load them from the `settings-ui` resources folder.

## Vendored shadcn CSS

The shadcn components rely on a set of Tailwind custom variants and utilities
(`data-open`, `data-closed`, `no-scrollbar`, `scroll-fade`, `shimmer`, …) that
shadcn normally ships via `@import 'shadcn/tailwind.css'`. Pulling the whole
`shadcn` CLI package into `devDependencies` just for that one CSS file dragged in
a large, dated dependency tree, so instead the file is **vendored** into
[`src/shadcn-tailwind.css`](src/shadcn-tailwind.css) and imported locally from
`src/tailwind.css`.

`src/shadcn-tailwind.css` is a generated, verbatim copy — do not edit it by hand.
When you adopt/regenerate shadcn components or bump the version, refresh it with:

```bash
yarn workspace @companion-app/launcher-ui vendor:shadcn-css [version]
```

With no argument it resolves the latest release on the pinned major line
(`MAJOR` in [`scripts/vendor-shadcn-css.mjs`](scripts/vendor-shadcn-css.mjs)) from
the npm registry; pass an explicit version to pin a specific one. Bump `MAJOR`
when adopting a new shadcn major after regenerating the components for it.
