/* eslint-disable @typescript-eslint/no-base-to-string */
import { confirm, input, number, select, Separator } from '@inquirer/prompts'
import { LAUNCH_OPTIONS, type LaunchOption } from '@companion-app/shared/LaunchOptions.js'
import type { ConfigFile } from './ConfigFile.js'
import { coerceValue, validateValue } from './options.js'
import { PAGE_ORDER, PRESENTATION } from './presentation.js'

const byKey = new Map(LAUNCH_OPTIONS.map((opt) => [opt.key, opt]))

// Sentinel menu values (not valid option keys).
const SAVE = ' save'
const QUIT = ' quit'

function displayValue(config: ConfigFile, option: LaunchOption): string {
	const raw = config.get(option.key)
	if (raw === null || raw === undefined || raw === '') return 'default'
	return String(raw)
}

/** Build the single home menu: every setting (grouped by page) plus save/quit rows. */
function buildMenuChoices(config: ConfigFile, dirty: boolean) {
	const choices: Array<Separator | { name: string; value: string; description: string }> = []

	for (const page of PAGE_ORDER) {
		const options = LAUNCH_OPTIONS.filter((opt) => PRESENTATION[opt.key]?.page === page)
		if (options.length === 0) continue

		choices.push(new Separator(`-- ${page} --`))
		for (const option of options) {
			const meta = PRESENTATION[option.key]
			choices.push({
				name: `${meta.label}: ${displayValue(config, option)}`,
				value: option.key,
				description: meta.help,
			})
		}
	}

	choices.push(new Separator())
	choices.push({ name: dirty ? 'Save and exit' : 'Exit', value: SAVE, description: '' })
	choices.push({ name: 'Quit without saving', value: QUIT, description: '' })
	return choices
}

/** Prompt for a single setting's value. Returns true if the stored value changed. */
async function editOne(config: ConfigFile, option: LaunchOption): Promise<boolean> {
	console.clear()
	const meta = PRESENTATION[option.key]
	const raw = config.get(option.key)
	const before = JSON.stringify(raw ?? null)

	let value: string | number | boolean | null

	if (option.type === 'boolean') {
		// A three-way choice so the value can be returned to "default" (unset), like the other types.
		value = await select<boolean | null>({
			message: meta.label,
			default: typeof raw === 'boolean' ? raw : null,
			choices: [
				{ name: `default (${option.default === true ? 'enabled' : 'disabled'})`, value: null },
				{ name: 'enabled', value: true },
				{ name: 'disabled', value: false },
			],
		})
	} else if (option.type === 'enum' && option.enumValues) {
		value = await select<string | null>({
			message: meta.label,
			default: typeof raw === 'string' ? raw : null,
			choices: [{ name: 'default', value: null }, ...option.enumValues.map((v) => ({ name: v, value: v }))],
		})
	} else if (option.type === 'number') {
		const answer = await number({
			message: `${meta.label} (blank for default)`,
			default: typeof raw === 'number' ? raw : undefined,
			validate: (value) => (value === undefined ? true : (validateValue(option, value) ?? true)),
		})
		value = answer ?? null
	} else {
		const answer = await input({
			message: `${meta.label} (blank for default)`,
			default: typeof raw === 'string' ? raw : undefined,
			validate: (value) => {
				const coerced = coerceValue(option, value)
				if (coerced.error) return coerced.error
				return validateValue(option, coerced.value) ?? true
			},
		})
		const coerced = coerceValue(option, answer)
		value = coerced.error ? null : coerced.value
	}

	config.set(option, value)
	return JSON.stringify(value) !== before
}

/**
 * Run the interactive editor: a single home menu of all settings. Enter edits the highlighted
 * setting and returns to the menu; the help for the highlighted setting is shown beneath the list.
 * Returns true if changes were saved.
 */
export async function runEdit(config: ConfigFile): Promise<boolean> {
	let dirty = false
	let cursor: string | undefined // the menu item to re-highlight, so editing does not jump to the top

	for (;;) {
		console.clear()
		const answer = await select({
			message: 'Companion configuration (up/down to move, Enter to edit; help shown below)',
			choices: buildMenuChoices(config, dirty),
			default: cursor,
			pageSize: 20,
			loop: false,
		})
		cursor = answer

		if (answer === SAVE) {
			if (dirty) config.write()
			return dirty
		}

		if (answer === QUIT) {
			if (!dirty) return false
			const discard = await confirm({ message: 'Discard unsaved changes?', default: false })
			if (discard) return false
			continue
		}

		const option = byKey.get(answer)
		if (option && (await editOne(config, option))) dirty = true
	}
}
