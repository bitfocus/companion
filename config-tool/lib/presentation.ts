import { LAUNCH_OPTIONS } from '@companion-app/shared/LaunchOptions.js'

/** Rich UI metadata for an option, kept out of the shared mapping so that stays lean. */
export interface OptionPresentation {
	page: string
	label: string
	help: string
}

/** Page display order. */
export const PAGE_ORDER = ['Network', 'Logging', 'Syslog', 'Security', 'Paths', 'Advanced'] as const

export const PRESENTATION: Record<string, OptionPresentation> = {
	adminPort: {
		page: 'Network',
		label: 'Admin UI port',
		help: 'TCP port the web admin interface and API listen on. Default 8000.',
	},
	adminAddress: {
		page: 'Network',
		label: 'Admin UI bind address',
		help: 'IP address to bind the admin interface to. Leave unset to bind to all interfaces (0.0.0.0 / ::). Cannot be combined with a bind interface.',
	},
	adminInterface: {
		page: 'Network',
		label: 'Admin UI bind interface',
		help: 'Bind the admin interface to the first IPv4 address of this named network interface (e.g. eth0). Leave unset to use a bind address instead.',
	},
	trustedProxies: {
		page: 'Network',
		label: 'Trusted reverse proxies',
		help: "Use this when Companion runs behind a reverse proxy, so the real visitor IP is detected instead of the proxy's. Set to 'loopback', or a comma/semicolon separated list of proxy IP addresses or subnets to trust.",
	},
	disableIpv6: {
		page: 'Network',
		label: 'Disable IPv6',
		help: 'Disable IPv6 support. When enabled the various api and web interface ports in Companion bind to IPv4 (0.0.0.0) by default instead of ::.',
	},
	logLevel: {
		page: 'Logging',
		label: 'Console log level',
		help: 'How verbose console logging is. One of error, warn, info, http, verbose, debug, silly. Leave unset for the default (info).',
	},
	syslogEnable: {
		page: 'Syslog',
		label: 'Enable syslog',
		help: 'Forward logs to a syslog server. The remaining syslog options only apply when this is enabled.',
	},
	syslogHost: {
		page: 'Syslog',
		label: 'Syslog server host',
		help: 'Hostname or IP of the syslog server to write to. Default localhost.',
	},
	syslogPort: {
		page: 'Syslog',
		label: 'Syslog server port',
		help: 'Port on the syslog server to write to. Default 514.',
	},
	syslogTcp: {
		page: 'Syslog',
		label: 'Use TCP for syslog',
		help: 'Use TCP transport for syslog instead of the default UDP.',
	},
	syslogLocalhost: {
		page: 'Syslog',
		label: 'Reported hostname',
		help: 'Hostname this machine reports to the syslog server. Leave unset to use the system hostname.',
	},
	enableShellCommandSupport: {
		page: 'Security',
		label: 'Allow shell commands',
		help: 'Allow running shell commands on this computer (e.g. the internal "run shell command" action). Disabled by default.',
	},
	enableRestrictedModules: {
		page: 'Security',
		label: 'Allow restricted modules',
		help: 'Allow loading modules otherwise held back for safety, e.g. importing custom modules from remote (non-loopback) clients. Enabled by default.',
	},
	extraModulePath: {
		page: 'Paths',
		label: 'Extra module path',
		help: 'An additional directory to search for in-development modules to be loaded from.',
	},
	notifications: {
		page: 'Advanced',
		label: 'Show version notifications',
		help: 'Show version-related notifications in the admin UI header. Enabled by default.',
	},
	installName: {
		page: 'Advanced',
		label: 'Installation name',
		help: 'A fixed name for this Companion installation. When set it overrides and locks the value in the admin UI, so it cannot be changed there and survives database resets. Leave unset to manage the name from the UI.',
	},
}

/**
 * Throws if any managed launch option is missing a presentation entry, or if any presentation
 * entry uses a page not listed in PAGE_ORDER (which would silently drop it from the editor).
 */
export function assertPresentationComplete(): void {
	const missing = LAUNCH_OPTIONS.map((opt) => opt.key).filter((key) => !PRESENTATION[key])
	if (missing.length > 0) {
		throw new Error(`Missing presentation metadata for launch option(s): ${missing.join(', ')}`)
	}

	const badPages = Object.entries(PRESENTATION)
		.filter(([, meta]) => !(PAGE_ORDER as readonly string[]).includes(meta.page))
		.map(([key, meta]) => `${key} (page "${meta.page}")`)
	if (badPages.length > 0) {
		throw new Error(`Presentation page not listed in PAGE_ORDER: ${badPages.join(', ')}`)
	}
}
