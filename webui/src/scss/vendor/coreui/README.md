# Vendored CoreUI SCSS

A trimmed copy of [`@coreui/coreui`](https://github.com/coreui/coreui) v5.6.1 (MIT — see `LICENSE`),
vendored so we can drop the npm dependency while we replace these styles with our own. Only the files
reachable from what `App.scss` forwards (`root`, `containers`, `grid`, `utilities/api`) plus their
transitive dependencies were copied. The goal is to eventually replace everything here with
first-party CSS under `webui/src/` and delete this directory.

The `reboot` and `type` modules are no longer forwarded from `App.scss`: they were compiled once into
the first-party `webui/src/reboot.css` (imported into the `coreui-reboot` cascade layer — see
`tailwind.css`) so the reset can be layered beneath Tailwind's utilities and Preflight. Their vendored
sources (`_reboot.scss`, `_type.scss`, and the `mixins/border-radius` + `mixins/lists` helpers they
used) are now orphaned and will be removed when that base layer is rewritten first-party.

**Do not hand-edit these files** — they are byte-identical upstream copies, with one exception:
`_variables.scss` has been pruned to just the variables the forwarded modules still read (verified by
diffing compiled `App.scss` output before/after). If a change here needs a variable that was pruned,
re-copy it from upstream.

`grid` and `containers` are **deliberately deferred — do not convert them in isolation.** Bootstrap's
12-column grid doesn't map cleanly to Tailwind (flex + `w-N/12` + `gap` wraps; CSS grid can't do
`col-auto`; a faithful grid means re-implementing Bootstrap's gutter mechanism). With 600+
`Grid.Row`/`Grid.Col` call-sites, move to a Tailwind-native grid during a reskin that is already
reworking layouts, not before.
