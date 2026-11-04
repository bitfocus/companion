# Companion Grafana dashboard

`companion-metrics.json` is a Grafana dashboard for the application-level metrics Companion
publishes on `/api/metrics` (the `companion_*` series). Generic Node.js / process metrics are
deliberately left out — pair this with a standard [Node.js dashboard](https://grafana.com/grafana/dashboards/11159)
if you want those.

## 1. Enable the metrics endpoint in Companion

The endpoint is opt-in and behind a bearer token. Enable it under **Settings → Protocols →
Prometheus Metrics** (or via the userconfig keys `prometheus_enabled` / `prometheus_token`). A
token is generated automatically when you enable it; copy it for the scrape config below.

## 2. Scrape it with Prometheus

```yaml
scrape_configs:
  - job_name: companion
    metrics_path: /api/metrics
    authorization:
      type: Bearer
      credentials: '<the prometheus_token from Companion>'
    static_configs:
      - targets: ['<companion-host>:8000']
```

## 3. Import the dashboard

Grafana → **Dashboards → New → Import** → upload `companion-metrics.json`, then pick your
Prometheus data source when prompted.

## Notes

- Per-connection panels join to `companion_instance_info` so they show the connection **label**
  (e.g. `atem`, `obs`) rather than the opaque `instance_id`. The **Connection** dashboard
  variable filters those panels.
- Counters (`*_total`) are graphed with `rate()` / `increase()` over `$__rate_interval`, so they
  survive Companion restarts (Prometheus counter-reset detection) correctly.
- The **Instance overview** table joins several instant queries on `instance_id` (a "Join by field
  → outer" transformation). Each query is wrapped in `sum by (instance_id, ...)` so the frames only
  carry the labels used for the join and the display columns. If you add or rename metrics, update
  the `organize` transformation's `Value #A`…`Value #F` field names to match.
- The **Storage** row's SQLite panels (`companion_database_operations_total`,
  `companion_database_operation_errors_total`, `companion_database_operation_duration_seconds`,
  `companion_database_table_rows`) are labelled by `database`, `table` and `operation`. Because
  node:sqlite is synchronous, **Time spent in SQLite** (rate of the duration histogram's `_sum`) is
  the key panel — it reads as the fraction of wall-clock time the event loop is blocked in the DB.
- The **Variables** row covers the variable dependency registry: how often variable changes are
  dispatched, how many registered readers each one reaches, and the share of event-loop time spent
  dispatching them (including the re-evaluations they run synchronously). **Registered variable
  readers** should fall back when buttons or connections are removed; steady growth suggests a leak.
  **Variable values reported vs changed** compares the values connections (and custom/internal
  variables) report with those that actually changed; the gap is values re-sent unchanged.
