import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LAUNCH_OPTIONS } from '@companion-app/shared/LaunchOptions.js'
import { ConfigFile } from '../lib/ConfigFile.js'

const tmpDirs: string[] = []
afterEach(() => {
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function tmpFile(name = 'config.yaml'): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfgtool-'))
	tmpDirs.push(dir)
	return path.join(dir, name)
}

describe('ConfigFile', () => {
	it('reports whether the file already existed', () => {
		const file = tmpFile()
		expect(ConfigFile.load(file).existed).toBe(false)
		fs.writeFileSync(file, '{}\n')
		expect(ConfigFile.load(file).existed).toBe(true)
	})

	it('init merge writes every configurable option (commented) and is idempotent', () => {
		const file = tmpFile()
		const config = ConfigFile.load(file)
		const added = config.mergeMissingOptions()
		config.write()

		const expectedKeys = LAUNCH_OPTIONS.map((o) => o.key)
		expect(added.sort()).toEqual([...expectedKeys].sort())

		// every option is present with a preceding comment line
		const text = fs.readFileSync(file, 'utf8')
		for (const opt of LAUNCH_OPTIONS) {
			expect(text, opt.key).toContain(`${opt.key}:`)
		}
		expect(text).toMatch(/#.*\nadminPort:/)

		// re-running adds nothing
		const reload = ConfigFile.load(file)
		expect(reload.mergeMissingOptions()).toEqual([])
	})

	it('seeds initial values for newly-added options but never clobbers existing ones', () => {
		const file = tmpFile()

		// First init seeds the value
		const first = ConfigFile.load(file)
		first.mergeMissingOptions({ extraModulePath: '/opt/companion-module-dev' })
		first.write()
		expect(fs.readFileSync(file, 'utf8')).toContain('extraModulePath: /opt/companion-module-dev')

		// User edits it, then a re-init with the same seed must not overwrite the edit
		const edited = ConfigFile.load(file)
		const extraModulePath = LAUNCH_OPTIONS.find((o) => o.key === 'extraModulePath')!
		edited.set(extraModulePath, '/home/me/mods')
		edited.write()

		const reinit = ConfigFile.load(file)
		expect(reinit.mergeMissingOptions({ extraModulePath: '/opt/companion-module-dev' })).toEqual([])
		reinit.write()
		expect(fs.readFileSync(file, 'utf8')).toContain('extraModulePath: /home/me/mods')
	})

	it('preserves unknown keys and hand-written comments across a round-trip', () => {
		const file = tmpFile()
		fs.writeFileSync(file, ['# my banner', 'adminPort: 9000', '# keep this', 'someFutureKey: keep-me', ''].join('\n'))

		const config = ConfigFile.load(file)
		const adminPort = LAUNCH_OPTIONS.find((o) => o.key === 'adminPort')!
		config.set(adminPort, 7000)
		config.mergeMissingOptions()
		config.write()

		const text = fs.readFileSync(file, 'utf8')
		expect(text).toContain('# my banner')
		expect(text).toContain('# keep this')
		expect(text).toContain('someFutureKey: keep-me')
		expect(text).toContain('adminPort: 7000')
		// merged-in option is present too
		expect(text).toContain('syslogHost:')
	})

	it('creates parent directories and writes atomically', () => {
		const file = path.join(tmpFile('x'), 'nested', 'config.yaml')
		const config = ConfigFile.load(file)
		config.mergeMissingOptions()
		config.write()
		expect(fs.existsSync(file)).toBe(true)
		// no leftover temp file
		const leftovers = fs.readdirSync(path.dirname(file)).filter((f) => f.includes('.tmp'))
		expect(leftovers).toEqual([])
	})
})
