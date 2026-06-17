import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { registerLaunchOptions } from '../lib/LaunchOptionsCli.js'

function parse(args: string[]): Record<string, unknown> {
	const program = new Command()
	program.exitOverride() // throw instead of process.exit on parse errors
	registerLaunchOptions(program)
	program.parse(args, { from: 'user' })
	return program.opts()
}

describe('registerLaunchOptions', () => {
	// SECURITY: the server must not enable these unless the flag is explicitly passed, regardless
	// of the config-tool defaults in the shared list. Guards against a boolean default leaking
	// through registerLaunchOptions and silently enabling them for the desktop app / direct launch.
	it('does NOT enable security-sensitive flags by default', () => {
		const opts = parse([])
		expect(opts.enableRestrictedModules, 'enableRestrictedModules').toBeFalsy()
		expect(opts.enableShellCommandSupport, 'enableShellCommandSupport').toBeFalsy()
	})

	it('enables a flag only when it is explicitly passed', () => {
		expect(parse(['--enable-restricted-modules']).enableRestrictedModules).toBe(true)
		expect(parse(['--enable-shell-command-support']).enableShellCommandSupport).toBe(true)
	})

	it('preserves the historical non-boolean default (admin port 8000)', () => {
		expect(parse([]).adminPort).toBe('8000')
	})
})
