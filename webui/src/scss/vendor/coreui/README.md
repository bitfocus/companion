# Vendored CoreUI SCSS

This directory is a **copy** of the parts of [`@coreui/coreui`](https://github.com/coreui/coreui)
(v5.6.1, MIT licensed — see `LICENSE`) whose SCSS we still consume.

It was extracted so we can drop the `@coreui/coreui` npm dependency while we
progressively replace these styles with our own. Only the files reachable from
the entry points we `@use`/`@forward` (and their transitive dependencies) were
copied; the internal relative imports are unchanged.

This is **not** the full CoreUI SCSS: sub-modules that produced no CSS the app
actually uses have been pruned (see below). Because of that pruning, the two
aggregators `_forms.scss` and `_helpers.scss` are the only files that diverge
from upstream — they now `@forward` a reduced list. Everything else is a
byte-identical upstream copy; **do not hand-edit those.** The eventual aim is to
replace every rule here with first-party SCSS under `webui/src/scss/` and then
delete this directory.

Entry points currently referenced from our SCSS:
- `variables`, `variables-dark`, `root`, `reboot`, `type`, `containers`,
  `forms`, `grid`, `tables`, `transitions`, `close`, `header`,
  `helpers`, `utilities/api`
- `forms/form-control`
- `mixins/ltr-rtl`, `mixins/breakpoints`, `mixins/transition`

Pruned as entirely unused (no matching class rendered anywhere in the webui):
- Forms: `chip-input`, `form-select`, `form-range`, `floating-labels`,
  `input-group`, `validation` — Companion ships its own form components, so
  only `form-control`, `form-check`, `labels` and `form-text` are kept.
- Helpers: `color-bg`, `colored-links`, `focus-ring`, `icon-link`, `ratio`,
  `position`, `stacks`, `stretched-link`, `vr`, `text-truncation` — only
  `clearfix` and `visually-hidden` are kept. (`.text-truncate` was replaced by
  Tailwind's `.truncate` utility in the markup.)
- The now-orphaned `mixins/_forms.scss` and `mixins/_focus-ring.scss` (only used
  by the pruned modules) were removed too.

The compiled CSS shrank by ~28 KB with these removals. Structural forwards
(`grid`, `utilities/api`, …) still generate far more classes than the app uses,
but those are Bootstrap-style config-driven and were left intact.

The **sidebar** is no longer vendored here: CoreUI's `_sidebar`, `sidebar/*`
partials were consolidated into our own `webui/src/scss/_sidebar.scss` (which
already carried heavy customisations), with the ~90 sidebar configuration
variables inlined. That file still `@use`s a few generic vendored mixins
(`breakpoints`, `transition`) and `variables`/`variables-dark`.
