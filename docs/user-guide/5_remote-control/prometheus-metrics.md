---
title: Monitoring with Prometheus
sidebar_position: 10
description: Monitor the health and performance of Companion with Prometheus and Grafana.
---

Companion can provide metrics for [Prometheus](https://prometheus.io/), a popular tool for
monitoring servers and applications. This lets you keep an eye on the health of your Companion installations, and
investigate problems such as high memory usage or slow drawing, alongside the rest of your systems.

:::note
So far, the metrics are the ones the Companion developers have found useful for monitoring test installations. We
aren't yet sure how useful they are for monitoring real installations. If there is something you would like to
see, let us know and we will look at adding it.
:::

## Enabling the metrics endpoint

The metrics endpoint is **disabled** by default.

1. Go to **Settings > Protocols** and turn on **Prometheus metrics endpoint**.
2. A **Scrape token** is generated for you. Prometheus must send this token to be allowed to read the metrics.

Companion shows an example Prometheus configuration below the token, which you can copy into your Prometheus
configuration and adjust. It looks like this:

```yaml
scrape_configs:
  - job_name: companion
    metrics_path: /api/metrics
    authorization:
      credentials: <your scrape token>
    static_configs:
      - targets: ['<companion address>:8000']
```

The metrics are served at `/api/metrics`, on the same address and port as the Companion admin interface.
Requests without the correct token are rejected. If you need to change the token, use the regenerate button next
to it; the old token stops working immediately.

The scrape token is separate from the [REST API](./rest-api/index.md) keys.

## What is measured

As well as the standard measurements of the Companion process (such as memory and CPU usage, and how busy it is),
Companion reports metrics with names starting `companion_`, including:

- the version of Companion (`companion_build_info`)
- how many buttons, pages, triggers, variables, connections and surfaces there are
- for each connection: whether it is running, how often it has restarted, how many variables and feedbacks it
  has, and how much it is communicating with Companion
- how much work is being done to draw buttons, and how long it is taking
- the size of Companion's database, and how busy it is

## Grafana dashboard

A ready-made [Grafana](https://grafana.com/) dashboard for these metrics is available in the
[Companion repository](https://github.com/bitfocus/companion/tree/main/assets/grafana), along with instructions for
importing it.
