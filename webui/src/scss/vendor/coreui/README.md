# Vendored CoreUI SCSS

This directory is a **copy** of the parts of [`@coreui/coreui`](https://github.com/coreui/coreui)
(v5.6.1, MIT licensed — see `LICENSE`) whose SCSS we still consume.

It was extracted so we can drop the `@coreui/coreui` npm dependency while we
progressively replace these styles with our own. Only the files reachable from
the entry points we `@use`/`@forward` (and their transitive dependencies) were
copied; the internal relative imports are unchanged.

This is **not** the full CoreUI SCSS: sub-modules that produced no CSS the app
actually uses have been pruned (see below). App.scss `@forward`s only the reduced
set below; every vendored file is a byte-identical upstream copy — **do not
hand-edit those.** The eventual aim is to replace every rule here with
first-party CSS/SCSS under `webui/src/` and then delete this directory.

Entry points still forwarded from App.scss (plus `variables`, used by
`scss/_variables.scss`):
- `root`, `reboot`, `type`, `containers`, `grid`, `utilities/api`
- everything else reachable is a transitive dependency of those (`maps`,
  `functions/*`, `mixins/*`, `vendor/rfs`)

Pruned as entirely unused (no matching class rendered anywhere in the webui):
- Forms: the whole `forms` module is gone — `.form-control` was replaced by our
  own `form-input` (Components/form.css) and `.form-text` was adopted there too;
  `chip-input`, `form-select`, `form-range`, `floating-labels`, `input-group`,
  `validation`, `form-check` and `labels` were never used.
- Helpers: the whole `helpers` module is gone. `.text-truncate` and
  `.visually-hidden` were replaced by Tailwind's `.truncate` / `.sr-only`, and
  `.clearfix` moved to Components/App.css; `color-bg`, `colored-links`,
  `focus-ring`, `icon-link`, `ratio`, `position`, `stacks`, `stretched-link` and
  `vr` were never used.
- The now-orphaned `mixins/_forms.scss` and `mixins/_focus-ring.scss` (only used
  by the pruned modules) were removed too — as were `mixins/_transition.scss`,
  `mixins/_box-shadow.scss`, `mixins/_gradients.scss` and
  `functions/_escape-svg.scss` once their only consumers (form-control, nav,
  buttons) had been converted to plain CSS.

The compiled CSS shrank by ~28 KB with these removals. Structural forwards
(`grid`, `utilities/api`, …) still generate far more classes than the app uses,
but those are Bootstrap-style config-driven and were left intact.

`grid` and `containers` are **deliberately deferred** — do NOT convert them in
isolation. Bootstrap's 12-column grid cannot be expressed cleanly in Tailwind:
flex + `w-N/12` + `gap` wraps (percentage widths + gap exceed 100%); CSS grid +
`gap` fixes that but can't reproduce `col-auto` content-width columns; and a
faithful flex grid needs Bootstrap's `--gutter` variable + column padding, i.e.
re-implementing Bootstrap rather than using Tailwind utilities. With 600+
`Grid.Row`/`Grid.Col` call-sites, the right time to move to a Tailwind-native
grid is during a reskin that is already reworking layouts — porting each layout
to the new grid should be a requirement of that work. `containers` goes with it
(container max-widths key off the grid breakpoints).

The **sidebar** is no longer vendored here: CoreUI's `_sidebar`, `sidebar/*`
partials were consolidated into our own `webui/src/scss/_sidebar.scss` (which
already carried heavy customisations), with the ~90 sidebar configuration
variables inlined. That file still `@use`s a few generic vendored mixins
(`breakpoints`, `transition`) and `variables`/`variables-dark`.
