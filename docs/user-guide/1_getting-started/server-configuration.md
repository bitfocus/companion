---
title: Server configuration
sidebar_position: 3
description: The launch-level settings that control how the Companion server starts and binds.
---

# Server configuration

These are the settings that control **how the Companion server itself starts up** — things like which
network port it listens on and which security features are allowed. They're separate from the
[Settings](../3_config/settings.md) page inside the admin interface, which configures Companion once
it's already running.

You set these in one of two places, depending on how you run Companion:

- On a **desktop install**, through the launcher's settings window — see
  [Start the server](./start-the-server.md).
- On a **headless / server install**, through the `config-tool` — see
  [Headless configuration](./companion-pi/config-tool.md).

Both are just two ways of editing the same set of options, described below. Changing some of them
(notably the security options) restarts Companion so the new setting takes effect.

For the complete list of every option — including the exact `config.yaml` keys, environment variables
and command-line flags — see the [Configuration reference](./config-reference.generated.md).

## Network

- **Admin port** — the port the admin interface (and the rest of the web UI) listens on. The default
  is **8000**.
- **Admin address / interface** — which network address or interface the admin interface binds to. By
  default Companion listens on all interfaces. Restrict this if you only want Companion reachable on a
  specific network.
- **Trusted proxies** — set this when running Companion behind a
  [reverse proxy](./Using-a-reverse-proxy.md). It tells Companion which proxy addresses to trust so it
  can see the real client's address. Without it, remote clients may incorrectly appear to be local
  (which matters for the security features below). Accepts `loopback` or a comma-separated list of
  proxy IP addresses.
- **Disable IPv6** — turn off IPv6 binding for the admin interface, for networks where IPv6 causes
  problems.

## Logging

- **Log level** — how much detail Companion writes to its logs (`error`, `warn`, `info`, `debug`, and
  more). Higher levels include more information, which is useful when diagnosing a problem but noisier
  day-to-day.

## Syslog

Companion can forward its logs to a syslog server, which is handy for centralised logging on a server
deployment.

- **Enable syslog** — turn syslog forwarding on or off.
- **Syslog server** — the address of your syslog server (defaults to `localhost`).
- **Port** — the port on the syslog server (the syslog default is 514).
- **Use TCP** — use TCP instead of UDP for delivery.
- **Local hostname** — the hostname Companion reports to the syslog server. If unset, the system
  hostname is used.

## Security (Dangerous Features)

Two features are powerful enough that they're **disabled by default**, and should only be enabled in a
trusted environment — especially if Companion is reachable over a network. Changing either one
restarts Companion.

- **Shell command support** — allows running shell commands on the computer Companion runs on, such as
  the internal **Run shell command** action. Off by default.
- **Restricted modules** — allows loading modules that are otherwise held back for safety, such as
  importing custom modules sent from a remote client. Importing a module from the computer Companion
  is running on is always allowed; this setting is specifically about remote clients.

:::caution
These features let code run on the machine hosting Companion. Only enable them if you understand and
accept the risk.
:::

## Paths & developer options

- **Extra module path / developer modules** — point Companion at a folder of local modules to load, in
  addition to the installed ones. This is mainly used by module developers; the folder is watched and
  modules are automatically restarted when they change. See the
  [module development docs](https://companion.free/for-developers/module-development/home).

## Advanced

- **Header notifications** — whether to show version-related notifications in the admin interface
  header. You can turn these off if you don't want to see update prompts.
