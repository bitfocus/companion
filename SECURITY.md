# Security Policy

## Reporting a security issue

Please report security vulnerabilities **privately**, through **GitHub Private
Vulnerability Reporting**: use the **"Report a vulnerability"** button on the
[Security tab](https://github.com/bitfocus/companion/security/advisories) of this
repository. Don't open a public GitHub issue for a suspected vulnerability, and
please give us a chance to respond before disclosing it publicly.

When reporting, please include where you can:

- the affected version(s) and platform (and ideally the build you tested),
- a description of the issue and its security impact,
- steps to reproduce, or a proof-of-concept.

## Supported versions

Companion follows a rolling release model; security fixes are made against the
current stable release line. Please reproduce issues against the latest release
before reporting, and upgrade to the current line to receive fixes.

| Version               | Supported            |
| --------------------- | -------------------- |
| Latest stable release | :white_check_mark:   |
| Older releases        | :x: — please upgrade |

## What to expect

Companion is a largely community-driven project maintained by a small team, so
please bear with us. As a baseline we aim to:

- acknowledge your report within **5 business days**,
- give an initial assessment (triage and in-scope determination) within
  **10 business days**,
- keep you updated and agree a disclosure timeline with you — we're happy to
  honour a reasonable coordinated-disclosure embargo (up to ~90 days),
- credit you in the advisory or release notes unless you'd rather remain
  anonymous.

These are goals we work towards in good faith, not contractual guarantees.

## Scope and threat model

Companion is, by design, an **extensible automation host**, and that shapes what
we can treat as a vulnerability:

- Companion runs with the privileges of the **logged-in user** who launches it.
- Much of Companion's functionality comes from **community-written modules** —
  third-party code, which may load native libraries, that we neither author nor
  audit. These run as part of Companion.
- Companion can be configured to run **user-defined actions, including shell
  commands**, as the same user.
- These capabilities are reachable through the **admin web UI**: anyone who can
  open it can install modules and configure shell-command actions, so admin
  access is equivalent to code execution on the host. The UI has **no built-in
  authentication** (the optional screen lock is a local convenience, not access
  control) — the desktop build binds to loopback, but headless/server mode binds
  to all interfaces, and either can be pointed at any address.
- Where the operating system has a per-application permission model (for example
  macOS TCC: Accessibility, Screen Recording, and similar), any permission the
  user grants to Companion is **inherited by everything Companion runs** —
  modules, spawned processes, and configured actions alike.

As a result, **we treat the host machine and the local user account as
trusted.** Anyone who already has same-user code execution on the host — or
write access to Companion's configuration or module directories — can make
Companion run arbitrary code under its identity and with any permissions it
holds. That is an inherent property of what Companion is for, not a defect we
can patch without removing core functionality.

### Generally out of scope

- Anything that requires the **pre-existing same-user access** described above:
  a local shell as that user, or the ability to modify Companion's configuration,
  installed modules, or any other files it loads.
- Vulnerabilities **within third-party modules** — please report those to the
  module's maintainer. We're happy to help route a report if you're unsure.
- Reaching the admin web UI and using its intended features — installing
  modules, or configuring shell-command actions — to run code on the host. As
  above, this is by design: there is no built-in authentication, so keep the UI
  on a trusted network and restrict the bind address to interfaces you control.
- Social engineering, physical access, or issues that require a malicious
  operating system or hardware.

### In scope

- Code execution that is **remotely or network-reachable**, or any RCE that does
  **not** require prior local access.
- Authentication or authorization bypass on a surface that is meant to be
  protected.
- Injection of attacker-controlled code into Companion's signed process from a
  **different user**, or from an **unprivileged / no-prior-access** context.
- Cross-origin or browser-driven attacks against Companion's local interfaces
  (for example DNS rebinding or CSRF) that let a remote web page drive
  Companion.
- Memory-safety or logic bugs in Companion's **own first-party code** that have
  a security impact.

If you are not sure whether something is in scope, please report it anyway and
we'll discuss it with you.

## Safe harbour

We will not pursue or support action against researchers who act in good faith:
who make a reasonable effort to avoid privacy violations, data destruction, and
service disruption; who only interact with systems and accounts they own or have
permission to test; and who give us reasonable time to respond before public
disclosure.
