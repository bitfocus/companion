/**
 * The launch options that the headless `config-tool` manages.
 *
 * This is the single source of truth for those options: the server entrypoint
 * (companion/lib/main.ts, via registerLaunchOptions) registers them as cli flags, and the
 * standalone `config-tool` package reads/persists/generates them. Keeping them in one place
 * means the flags the server accepts can never drift from what the config tool generates.
 *
 * Server-only flags that the config tool does NOT manage are intentionally NOT here - they
 * are declared directly in main.ts, since putting them here would only need filtering back
 * out again.
 */

export type LaunchOptionType = 'string' | 'number' | 'boolean' | 'enum'

export interface LaunchOption {
	/** Canonical key. Must equal the name commander derives from `cliFlag` (e.g. '--admin-port' -> 'adminPort'). */
	key: string
	type: LaunchOptionType
	/** Allowed values for `type: 'enum'`. */
	enumValues?: readonly string[]
	/**
	 * Semantic default.
	 * - Only passed to commander for non-boolean options (to preserve the exact existing cli behaviour).
	 * - Used by the config tool as the file/ui default and by `generate` to decide whether a flag is emitted.
	 */
	default?: string | number | boolean
	/** One-line description. Used verbatim as the commander option description and the yaml comment. */
	short: string
	/** Full commander flags string, verbatim (e.g. '--admin-port <number>'). Omit for env-only options. */
	cliFlag?: string
	/** True for negated flags like '--no-notifications' (commander stores the value under the positive `key`). */
	cliNegated?: boolean
	/** Environment variable this maps to. Set for env-only options, and for flag+env options. */
	envVar?: string
	/** Optional validation; return an error message string, or undefined when valid. */
	validate?: (value: unknown) => string | undefined
}

const LOG_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const

function validatePort(value: unknown): string | undefined {
	if (value === null || value === undefined || value === '') return undefined
	const port = Number(value)
	if (!Number.isInteger(port) || port <= 0 || port > 65535) return `Must be a port number between 1 and 65535`
	return undefined
}

/** The config-tool-managed launch options. Order here is the order they appear in `--help` and the config file. */
export const LAUNCH_OPTIONS: readonly LaunchOption[] = [
	{
		key: 'adminPort',
		type: 'number',
		default: 8000,
		short: 'Set the port the admin ui should bind to',
		cliFlag: '--admin-port <number>',
		validate: validatePort,
	},
	{
		key: 'adminInterface',
		type: 'string',
		short: 'Set the interface the admin ui should bind to. The first ip on this interface will be used',
		cliFlag: '--admin-interface <string>',
	},
	{
		key: 'adminAddress',
		type: 'string',
		short: 'Set the ip address the admin ui should bind to (default: "0.0.0.0")',
		cliFlag: '--admin-address <string>',
	},
	{
		key: 'extraModulePath',
		type: 'string',
		short: 'Search an extra directory for modules to load',
		cliFlag: '--extra-module-path <string>',
	},
	{
		key: 'logLevel',
		type: 'enum',
		enumValues: LOG_LEVELS,
		short: 'Log level to output to console',
		cliFlag: '--log-level <string>',
	},
	{
		key: 'syslogEnable',
		type: 'boolean',
		default: false,
		short: 'Enable syslog transport',
		cliFlag: '--syslog-enable',
	},
	{
		key: 'syslogHost',
		type: 'string',
		short: 'Syslog server to write to (default: localhost)',
		cliFlag: '--syslog-host <string>',
	},
	{
		key: 'syslogPort',
		type: 'number',
		short: 'Port on syslog server to write to',
		cliFlag: '--syslog-port <string>',
		validate: validatePort,
	},
	{
		key: 'syslogTcp',
		type: 'boolean',
		default: false,
		short: 'Use TCP for transport (default: udp)',
		cliFlag: '--syslog-tcp',
	},
	{
		key: 'syslogLocalhost',
		type: 'string',
		short: 'Hostname of this machine',
		cliFlag: '--syslog-localhost <string>',
	},
	{
		key: 'enableShellCommandSupport',
		type: 'boolean',
		default: false,
		short: 'Allow running shell commands on this computer (e.g. the internal "run shell command" action)',
		cliFlag: '--enable-shell-command-support',
		envVar: 'COMPANION_ENABLE_SHELL_COMMAND_SUPPORT',
	},
	{
		// Defaults to true for headless installs (this tool): importing modules is a common,
		// expected workflow there. The desktop app's own default stays false - registerLaunchOptions
		// does not pass boolean defaults to commander, so this only affects config-tool output.
		key: 'enableRestrictedModules',
		type: 'boolean',
		default: true,
		short:
			'Allow loading modules that are otherwise held back for safety, e.g. importing custom modules from remote (non-loopback) clients. Local clients can always import',
		cliFlag: '--enable-restricted-modules',
		envVar: 'COMPANION_ENABLE_RESTRICTED_MODULES',
	},
	{
		key: 'trustedProxies',
		type: 'string',
		short:
			'Trust a reverse proxy in front of the admin UI, so the real client ip is detected instead of the proxy address',
		cliFlag: '--trusted-proxies <value>',
		envVar: 'COMPANION_TRUSTED_PROXIES',
	},
	{
		key: 'notifications',
		type: 'boolean',
		default: true,
		short: "Don't show version-related notifications in the header.",
		cliFlag: '--no-notifications',
		cliNegated: true,
	},
	{
		key: 'disableIpv6',
		type: 'boolean',
		default: false,
		short: 'Disable IPv6 support, binding the admin ui to IPv4 (0.0.0.0) by default',
		envVar: 'DISABLE_IPV6',
	},
]

/** The bare long flag name for an option (e.g. '--admin-port <number>' -> '--admin-port'). */
export function launchOptionFlagName(option: LaunchOption): string | undefined {
	return option.cliFlag?.split(/\s+/)[0]
}

/** Whether a cli flag takes a value (has a <required> or [optional] placeholder). */
export function launchOptionTakesValue(option: LaunchOption): boolean {
	return !!option.cliFlag && /[<[]/.test(option.cliFlag)
}
