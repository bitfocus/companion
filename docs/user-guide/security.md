---
title: Security
sidebar_position: 8
description: Configure overall settings, protocols, and security.
---

Companion has a number of features that help you limit casual access to the admin interface and control surfaces. Although none of these features makes an installation secure, they can help to stop casual browsers.

No single page of the Admin interface is dedicated to security, so this help section attempts to gather the features in a single place.

1. [Admin Password](./3_config/settings.md#admin-ui-password), _Settings > Advanced (Admin UI Password)_: If enabled, Companion will require a password to view any of the configuration pages
2. [Surface Lockscreen](./3_config/settings.md#pin-lockout), _Surfaces page (PIN Lockout)_: Allows all connected surfaces to be locked out after a timeout and requires a PIN to unlock.
3. [Page Permissions](./3_config/surfaces.md#page-permissions) _Surfaces_ tab: If enabled for a device or a group, it allows you to limit page access for that device/group.
4. [Remote Access](./category/remote-control) _Settings > Protocols_: Determine whether remote computers/devices can initiate a connection to Companion.
5. [Dangerous Features](./1_getting-started/server-configuration.md#security-dangerous-features): As of Companion 5.0, running shell commands and installing modules sent from remote clients are **disabled by default**. Leave these off unless you specifically need them and trust your network, as they allow code to run on the machine hosting Companion.
6. [REST API keys](./5_remote-control/rest-api/authentication.md), _Settings > Protocols (REST API)_: The REST API is disabled by default. When enabled, every request needs an API key. Give each script or system its own key with only the scopes it needs, and revoke keys which are no longer used. The **Last used** column helps you spot those.
7. [Prometheus metrics](./5_remote-control/prometheus-metrics.md), _Settings > Protocols (Prometheus Metrics)_: Disabled by default. When enabled, the metrics can only be read with the scrape token.
8. [Companion Link](./3_config/link.md), _Settings > Protocols (Companion Link)_ and the _Link_ page: Companion listens for other Companion installations on port 16624 by default. Connections are encrypted, and an installation that connects can do nothing until you pair it, by entering the code it shows into its pairing request. Check that the Link id shown while pairing matches the one the other installation shows for itself. Once paired, it can use only what you share with it on the Link page, and nothing is shared by default. Sharing **Buttons** lets it show and press any of your buttons, so share only with installations you trust. Turn the protocol off if you don't use Link, and use a VPN rather than exposing the port to the internet.

Note that the Admin Password only protects the admin interface. It does not protect the remote control protocols, the REST API or the metrics endpoint, which have their own settings above.
