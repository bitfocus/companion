import { LAUNCH_OPTIONS } from '@companion-app/shared/LaunchOptions.js'
import { ConfigFile } from './ConfigFile.js'
import { generateLaunchSnippet } from './Launch.js'
import { coerceValue, resolveValue, validateValue } from './options.js'
import { assertPresentationComplete } from './presentation.js'

const USAGE = `Companion headless configuration tool

Usage: config-tool <command>

Commands:
  edit                   Interactively edit the configuration (default; requires a terminal)
  init [--set key=value] Create the config file if missing, and add any new options to an existing file
  generate               Print a bash-sourceable launch snippet (env exports + a 'set --' of cli flags)
  validate               Check that every configured value is valid

  --set key=value can be repeated; it seeds the initial value for an option when it is first
  added to the file (it never overwrites a value already present). Used by install tooling to
  provide platform defaults, e.g. --set extraModulePath=/opt/companion-module-dev

The config file path is taken from the COMPANION_CONFIG_FILE environment variable.`

class UserError extends Error {}

/** Parse repeated `--set key=value` arguments into validated, coerced seed values. */
function parseSeedOverrides(args: string[]): Record<string, string | number | boolean | null> {
	const seeds: Record<string, string | number | boolean | null> = {}

	for (let i = 0; i < args.length; i++) {
		if (args[i] !== '--set') continue

		const pair = args[++i]
		const eq = pair?.indexOf('=') ?? -1
		if (!pair || eq < 1) throw new UserError(`--set expects key=value`)

		const key = pair.slice(0, eq)
		const option = LAUNCH_OPTIONS.find((o) => o.key === key)
		if (!option) throw new UserError(`--set: unknown option "${key}"`)

		const coerced = coerceValue(option, pair.slice(eq + 1))
		if (coerced.error) throw new UserError(`--set ${key}: ${coerced.error}`)
		const validationError = validateValue(option, coerced.value)
		if (validationError) throw new UserError(`--set ${key}: ${validationError}`)

		seeds[key] = coerced.value
	}

	return seeds
}

function getConfigPath(): string {
	const configPath = process.env.COMPANION_CONFIG_FILE
	if (!configPath) {
		throw new UserError(
			'COMPANION_CONFIG_FILE is not set. Set it to the path of the config file, e.g. /etc/companion/config.yaml'
		)
	}
	return configPath
}

function cmdInit(args: string[]): void {
	const seeds = parseSeedOverrides(args)
	const config = ConfigFile.load(getConfigPath())
	const added = config.mergeMissingOptions(seeds)
	config.write()

	if (!config.existed) {
		console.error(`Created ${config.path} with ${added.length} option(s).`)
	} else if (added.length > 0) {
		console.error(`Updated ${config.path}: added ${added.length} new option(s) (${added.join(', ')}).`)
	} else {
		console.error(`${config.path} is already up to date.`)
	}
}

function cmdGenerate(): void {
	const config = ConfigFile.load(getConfigPath())
	let snippet: string
	try {
		snippet = generateLaunchSnippet(config)
	} catch (e) {
		throw new UserError(e instanceof Error ? e.message : String(e))
	}
	// Snippet goes to stdout (for `source <(...)`); nothing else may be written there.
	process.stdout.write(snippet)
}

function cmdValidate(): void {
	const config = ConfigFile.load(getConfigPath())

	const errors: string[] = []
	for (const option of LAUNCH_OPTIONS) {
		try {
			const value = resolveValue(option, config.get(option.key))
			const error = validateValue(option, value)
			if (error) errors.push(`  ${option.key}: ${error}`)
		} catch (e) {
			errors.push(`  ${option.key}: ${e instanceof Error ? e.message : String(e)}`)
		}
	}

	if (errors.length > 0) {
		throw new UserError(`Configuration is invalid:\n${errors.join('\n')}`)
	}
	console.error(`${config.path} is valid.`)
}

async function cmdEdit(): Promise<void> {
	const configPath = getConfigPath()

	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw new UserError(
			`Interactive editing needs a terminal. The config file at ${configPath} can be edited manually instead.`
		)
	}

	const config = ConfigFile.load(configPath)
	config.mergeMissingOptions() // surface any newly-added options in the editor

	const { runEdit } = await import('./edit.js')

	// Run the editor in the terminal's alternate screen buffer (like vim/htop), so it behaves
	// as a full-screen app and the user's normal scrollback is restored untouched on exit.
	const enterAltScreen = '\x1b[?1049h'
	const leaveAltScreen = '\x1b[?1049l'
	process.stdout.write(enterAltScreen)
	let saved = false
	try {
		saved = await runEdit(config)
	} catch (e) {
		// Ctrl-C (inquirer's ExitPromptError) exits cleanly, like "quit without saving".
		if (!(e instanceof Error && e.name === 'ExitPromptError')) throw e
	} finally {
		process.stdout.write(leaveAltScreen)
	}

	console.error(saved ? `Saved ${config.path}` : 'No changes made.')
}

async function main(): Promise<void> {
	assertPresentationComplete()

	const args = process.argv.slice(2)
	const command = args.find((arg) => !arg.startsWith('-')) ?? 'edit'

	if (args.includes('--help') || args.includes('-h')) {
		console.log(USAGE)
		return
	}

	switch (command) {
		case 'edit':
			await cmdEdit()
			break
		case 'init':
			cmdInit(args)
			break
		case 'generate':
			cmdGenerate()
			break
		case 'validate':
			cmdValidate()
			break
		default:
			throw new UserError(`Unknown command "${command}".\n\n${USAGE}`)
	}
}

main().catch((e) => {
	if (e instanceof UserError) {
		console.error(`Error: ${e.message}`)
	} else {
		console.error(e instanceof Error ? (e.stack ?? e.message) : String(e))
	}
	process.exitCode = 1
})
