import { LAUNCH_OPTIONS, launchOptionFlagName, launchOptionTakesValue } from '@companion-app/shared/LaunchOptions.js'
import type { ConfigFile } from './ConfigFile.js'
import { resolveValue, validateValue } from './options.js'

/** Single-quote a value for safe `source`-ing in bash; only quote when needed for readability. */
function shellQuote(value: string): string {
	if (/^[A-Za-z0-9._/:=-]+$/.test(value)) return value
	return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Build the bash-sourceable launch snippet from the config file.
 *
 * Options that have a cli flag are emitted as flags (in a single `set --`), so they take the
 * precedence the server expects. Env-only options are emitted as `export`s. Throws if any value
 * is invalid, so the caller can fail loudly before the server is launched.
 */
export function generateLaunchSnippet(config: ConfigFile): string {
	const exports: string[] = []
	const args: string[] = []

	for (const option of LAUNCH_OPTIONS) {
		const value = resolveValue(option, config.get(option.key))

		const validationError = validateValue(option, value)
		if (validationError) throw new Error(`Invalid value for "${option.key}": ${validationError}`)

		if (value === null) continue

		if (option.cliFlag) {
			const flag = launchOptionFlagName(option)!
			if (option.type === 'boolean') {
				// Negated flags (e.g. --no-notifications) are emitted when the value is false.
				if (option.cliNegated ? value === false : value === true) args.push(flag)
			} else if (launchOptionTakesValue(option)) {
				args.push(flag, shellQuote(String(value)))
			} else {
				args.push(flag)
			}
		} else if (option.envVar) {
			if (option.type === 'boolean') {
				if (value === true) exports.push(`export ${option.envVar}=1`)
			} else {
				exports.push(`export ${option.envVar}=${shellQuote(String(value))}`)
			}
		}
	}

	const lines = [...exports]
	if (args.length > 0) lines.push(`set -- ${args.join(' ')}`)
	return lines.join('\n') + '\n'
}
