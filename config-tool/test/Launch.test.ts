import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigFile } from '../lib/ConfigFile.js'
import { generateLaunchSnippet } from '../lib/Launch.js'

const tmpDirs: string[] = []
afterEach(() => {
	for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function configFrom(yaml: string): ConfigFile {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfgtool-'))
	tmpDirs.push(dir)
	const file = path.join(dir, 'config.yaml')
	fs.writeFileSync(file, yaml)
	return ConfigFile.load(file)
}

describe('generateLaunchSnippet', () => {
	it('emits the defaulted flags for an empty config', () => {
		const snippet = generateLaunchSnippet(configFrom('{}\n'))
		// adminPort defaults to 8000 and enableRestrictedModules defaults to true (headless default)
		expect(snippet).toBe('set -- --admin-port 8000 --enable-restricted-modules\n')
	})

	it('emits flags for cli options and exports for env-only options', () => {
		const snippet = generateLaunchSnippet(
			configFrom(
				[
					'adminPort: 9000',
					'adminAddress: 192.168.1.5',
					'logLevel: debug',
					'enableShellCommandSupport: true',
					'trustedProxies: loopback, 10.0.0.0/8',
					'disableIpv6: true',
					'notifications: false',
				].join('\n')
			)
		)
		const lines = snippet.trimEnd().split('\n')
		// env-only option becomes an export
		expect(lines).toContain('export DISABLE_IPV6=1')
		// flags collected into a single set --
		const setLine = lines.find((l) => l.startsWith('set -- '))!
		expect(setLine).toContain('--admin-port 9000')
		expect(setLine).toContain('--admin-address 192.168.1.5')
		expect(setLine).toContain('--log-level debug')
		expect(setLine).toContain('--enable-shell-command-support')
		// value with spaces/special chars is shell-quoted
		expect(setLine).toContain(`--trusted-proxies 'loopback, 10.0.0.0/8'`)
		// negated boolean emitted when false
		expect(setLine).toContain('--no-notifications')
	})

	it('does not emit a flag for a false (non-negated) boolean or an unset value', () => {
		const snippet = generateLaunchSnippet(configFrom('syslogEnable: false\nconfigDir: null\n'))
		expect(snippet).not.toContain('--syslog-enable')
		expect(snippet).not.toContain('--config-dir')
	})

	it('does not emit excluded options (machineId)', () => {
		const snippet = generateLaunchSnippet(configFrom('machineId: abc123\n'))
		expect(snippet).not.toContain('--machine-id')
		expect(snippet).not.toContain('abc123')
	})

	it('throws on an invalid value', () => {
		expect(() => generateLaunchSnippet(configFrom('adminPort: 70000\n'))).toThrow()
	})
})
