import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import type { LauncherAppInfo } from '@companion-app/shared/Model/LauncherAppInfo.js'
import { Settings } from '~/Settings.js'
import type { LauncherConfig } from '~/types/config'

const CONFIG: LauncherConfig = {
	http_port: 8000,
	bind_ip: '0.0.0.0',
	start_minimised: false,
	run_at_login: false,
	enable_developer: true,
	dev_modules_path: '/dev/modules',
	log_level: 'info',
	enable_syslog: true,
	syslog_host: '10.0.0.5',
	syslog_port: 514,
	syslog_use_tcp: false,
	syslog_local_hostname: '',
	enable_shell_command_support: false,
	enable_restricted_modules: false,
	trusted_proxies: 'loopback',
}

const APP_INFO: LauncherAppInfo = {
	appVersion: '5.2.0',
	appStatus: 'running',
	appMessage: null,
	appLaunch: 'http://127.0.0.1:8000/',
}

let listeners: Map<string, (...args: any[]) => void>
let send: Mock<Window['api']['send']>

/** Render the window, and have the main process answer with `config` */
function renderSettings(config: LauncherConfig): void {
	render(<Settings />)
	act(() => listeners.get('info')?.(config, APP_INFO, 'darwin', 'studio-mac'))
}

/** The config changes the window has asked the main process to save */
function savedChanges(): unknown[] {
	return send.mock.calls.filter(([channel]) => channel === 'save-config').map(([, data]) => data)
}

beforeEach(() => {
	listeners = new Map()
	send = vi.fn<Window['api']['send']>()
	window.api = {
		send,
		receive: (channel, func) => {
			listeners.set(channel, func)
			return () => listeners.delete(channel)
		},
	}
	globalThis.ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}
})

afterEach(() => cleanup())

describe('Advanced settings', () => {
	test('saves a text field when it loses focus, not on every keystroke', () => {
		renderSettings(CONFIG)

		const host = screen.getByLabelText('Syslog server')
		fireEvent.change(host, { target: { value: '10.0.0.6' } })
		expect(savedChanges()).toEqual([])

		fireEvent.blur(host)
		expect(savedChanges()).toEqual([{ syslog_host: '10.0.0.6' }])
	})

	test('does not save a text field that is left unchanged, as saving restarts Companion', () => {
		renderSettings(CONFIG)

		for (const label of ['Syslog server', 'Port', 'Local hostname', 'Modules path', 'Trusted proxies']) {
			fireEvent.blur(screen.getByLabelText(label))
		}

		expect(savedChanges()).toEqual([])
	})

	test('compares against the default a text field shows when the config is empty', () => {
		renderSettings({ ...CONFIG, syslog_host: '' })

		const host = screen.getByLabelText<HTMLInputElement>('Syslog server')
		expect(host.value).toBe('127.0.0.1')
		fireEvent.blur(host)

		expect(savedChanges()).toEqual([])
	})

	test('clamps the syslog port to one the server accepts', () => {
		renderSettings(CONFIG)

		const port = screen.getByLabelText<HTMLInputElement>('Port')
		fireEvent.change(port, { target: { value: '50' } })
		fireEvent.blur(port)

		expect(port.value).toBe('101')
		expect(savedChanges()).toEqual([{ syslog_port: 101 }])
	})

	test('saves a switch as soon as it is toggled', () => {
		renderSettings(CONFIG)

		fireEvent.click(screen.getByRole('switch', { name: 'Shell command support' }))

		expect(savedChanges()).toEqual([{ enable_shell_command_support: true }])
	})
})
