# Vendored CoreUI SCSS

A trimmed copy of [`@coreui/coreui`](https://github.com/coreui/coreui) v5.6.1 (MIT — see `LICENSE`),
vendored so we can drop the npm dependency while we replace these styles with our own. Only the files
reachable from what `App.scss` still forwards (`root`, `utilities/api`) plus their transitive
dependencies remain. The goal is to eventually replace everything here with first-party CSS under
`webui/src/` and delete this directory.

The `reboot` + `type` and the `containers` + `grid` modules are no longer here: each was compiled once
into first-party CSS — `webui/src/reboot.css` (the `coreui-reboot` cascade layer) and
`webui/src/coreui-layout.css` (the `coreui-layout` layer) — so they can be layered beneath Tailwind's
utilities and Preflight (see `tailwind.css`). Their vendored SCSS sources (and the `border-radius`,
`lists`, `grid` and `container` mixins only they used) have been deleted; edit the compiled first-party
CSS directly, or re-copy the module from upstream if you ever need the SCSS again.

**Do not hand-edit the remaining files** — they are byte-identical upstream copies, with one
exception: `_variables.scss` has been pruned to just the variables the forwarded modules read (verified
by diffing compiled `App.scss` output before/after). If a change here needs a variable that was pruned,
re-copy it from upstream.

Converting the grid to a **Tailwind-native** grid is still deferred — do not attempt it in isolation.
Bootstrap's 12-column grid doesn't map cleanly to Tailwind (flex + `w-N/12` + `gap` wraps; CSS grid
can't do `col-auto`; a faithful grid means re-implementing Bootstrap's gutter mechanism). With 600+
`Grid.Row`/`Grid.Col` call-sites, move to a Tailwind-native grid during a reskin that is already
reworking layouts, not before. For now `coreui-layout.css` keeps the CoreUI grid as-is — its
`container`/`col-*` classes are `cui-`-prefixed — just layered so Tailwind utilities win over it.
