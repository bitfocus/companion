import { describe, expect, it } from 'vitest'
import { LAUNCH_OPTIONS, launchOptionFlagName } from '@companion-app/shared/LaunchOptions.js'
import { assertPresentationComplete, PAGE_ORDER, PRESENTATION } from '../lib/presentation.js'

/** Reproduce the key name commander derives from a flag, to guard against mapping mistakes. */
function commanderKey(cliFlag: string, negated: boolean): string {
	let name = cliFlag.split(/\s+/)[0].replace(/^--/, '')
	if (negated) name = name.replace(/^no-/, '')
	return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

describe('launch options schema', () => {
	it('every cli flag derives the declared key (no drift vs main.ts commander parsing)', () => {
		for (const option of LAUNCH_OPTIONS) {
			if (!option.cliFlag) continue
			expect(commanderKey(option.cliFlag, !!option.cliNegated), `flag ${option.cliFlag}`).toBe(option.key)
		}
	})

	it('has unique keys', () => {
		const keys = LAUNCH_OPTIONS.map((o) => o.key)
		expect(new Set(keys).size).toBe(keys.length)
	})

	it('enum options declare their allowed values', () => {
		for (const option of LAUNCH_OPTIONS) {
			if (option.type === 'enum') expect(option.enumValues?.length, option.key).toBeGreaterThan(0)
		}
	})

	it('flag names are well-formed', () => {
		for (const option of LAUNCH_OPTIONS) {
			if (!option.cliFlag) continue
			expect(launchOptionFlagName(option)).toMatch(/^--[a-z][a-z-]*$/)
		}
	})

	it('admin port rejects privileged (<1024) ports; syslog port rejects values the server ignores (<=100)', () => {
		const adminPort = LAUNCH_OPTIONS.find((o) => o.key === 'adminPort')!
		expect(adminPort.validate?.(80), 'privileged port').toBeDefined()
		expect(adminPort.validate?.(8000)).toBeUndefined()
		expect(adminPort.validate?.(70000)).toBeDefined()

		const syslogPort = LAUNCH_OPTIONS.find((o) => o.key === 'syslogPort')!
		expect(syslogPort.validate?.(50)).toBeDefined()
		expect(syslogPort.validate?.(514)).toBeUndefined()
	})
})

describe('presentation metadata', () => {
	it('covers every managed option and nothing more', () => {
		expect(() => assertPresentationComplete()).not.toThrow()

		const managedKeys = new Set(LAUNCH_OPTIONS.map((o) => o.key))
		for (const key of Object.keys(PRESENTATION)) {
			expect(managedKeys.has(key), `presentation for non-managed "${key}"`).toBe(true)
		}
	})

	it('every presentation page is listed in PAGE_ORDER (else it is dropped from the editor)', () => {
		for (const [key, meta] of Object.entries(PRESENTATION)) {
			expect(PAGE_ORDER, key).toContain(meta.page)
		}
	})

	it('does not manage server-only options (machineId, configDir, etc.)', () => {
		const keys = LAUNCH_OPTIONS.map((o) => o.key)
		for (const serverOnly of ['machineId', 'configDir', 'listInterfaces', 'disableAdminPassword']) {
			expect(keys, serverOnly).not.toContain(serverOnly)
			expect(PRESENTATION[serverOnly]).toBeUndefined()
		}
	})
})
