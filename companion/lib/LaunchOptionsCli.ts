import type { Command } from 'commander'
import { LAUNCH_OPTIONS } from '@companion-app/shared/LaunchOptions.js'

/**
 * Register every launch option that has a cli flag onto the commander program.
 *
 * The option list (names, descriptions, defaults, order) lives in
 * `@companion-app/shared/LaunchOptions.js` so it stays in sync with the standalone
 * `config-tool` package. This replaces the previously hand-written `.option()` chain.
 */
export function registerLaunchOptions(program: Command): void {
	for (const option of LAUNCH_OPTIONS) {
		if (!option.cliFlag) continue

		// Only non-boolean options carried a commander default historically (just --admin-port).
		// Booleans must not be given a default so commander's negation/absence behaviour is unchanged.
		if (option.type !== 'boolean' && option.default !== undefined && option.default !== null) {
			program.option(option.cliFlag, option.short, String(option.default))
		} else {
			program.option(option.cliFlag, option.short)
		}
	}
}
