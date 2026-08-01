# Vendored CoreUI SCSS

This directory is a **copy** of the parts of [`@coreui/coreui`](https://github.com/coreui/coreui)
(v5.6.1, MIT licensed — see `LICENSE`) whose SCSS we still consume.

It was extracted so we can drop the `@coreui/coreui` npm dependency while we
progressively replace these styles with our own. Only the files reachable from
the entry points we `@use`/`@forward` (and their transitive dependencies) were
copied; the internal relative imports are unchanged.

**Do not hand-edit these files.** The eventual aim is to replace every rule here
with first-party SCSS under `webui/src/scss/` and then delete this directory.
Until then, treat it as read-only vendored code.

Entry points currently referenced from our SCSS:
- `variables`, `root`, `reboot`, `type`, `containers`, `forms`, `grid`,
  `tables`, `transitions`, `nav`, `close`, `header`, `sidebar`, `helpers`,
  `utilities/api`
- `forms/form-control`
- `mixins/ltr-rtl`, `mixins/breakpoints`
