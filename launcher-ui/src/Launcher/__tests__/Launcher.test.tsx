import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import type { LauncherAppInfo, LauncherVersionWarning } from '@companion-app/shared/Model/LauncherAppInfo.js'
import type { LauncherConfig } from '~/types/config'
import { Launcher } from '../Launcher.js'

const CONFIG: LauncherConfig = {
	http_port: 8000,
	bind_ip: '0.0.0.0',
	start_minimised: false,
	run_at_login: false,
	enable_developer: false,
	dev_modules_path: '',
	log_level: 'info',
	enable_syslog: false,
	syslog_host: '',
	syslog_port: 514,
	syslog_use_tcp: false,
	syslog_local_hostname: '',
	enable_shell_command_support: false,
	enable_restricted_modules: false,
	trusted_proxies: '',
}

const RUNNING: LauncherAppInfo = {
	appVersion: '5.2.0',
	appStatus: 'running',
	appMessage: null,
	appLaunch: 'http://127.0.0.1:8000/',
}

let listeners: Map<string, (...args: any[]) => void>
let send: Mock<Window['api']['send']>

/** Simulate the main process sending a message to the window */
function emit(channel: string, ...args: any[]): void {
	act(() => listeners.get(channel)?.(...args))
}

function emitInfo(appInfo: LauncherAppInfo, versionWarning: LauncherVersionWarning | null): void {
	emit('info', CONFIG, appInfo, 'darwin', versionWarning)
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

describe('Launcher', () => {
	test('asks the main process for its state on load', () => {
		render(<Launcher />)

		expect(send).toHaveBeenCalledWith('info')
		expect(send).toHaveBeenCalledWith('network-interfaces:get')
	})

	test('stops listening when unmounted', () => {
		const { unmount } = render(<Launcher />)
		unmount()

		expect(listeners.size).toBe(0)
	})

	test('shows the server is starting until told otherwise', () => {
		render(<Launcher />)
		emitInfo({ ...RUNNING, appStatus: 'starting', appLaunch: null }, null)

		expect(screen.getByText('Starting')).toBeTruthy()
		expect(screen.getByText('Waiting for the web server…')).toBeTruthy()
		expect(screen.getByRole<HTMLButtonElement>('button', { name: /Launch GUI/ }).disabled).toBe(true)
	})

	test('offers the url and the GUI once running', () => {
		render(<Launcher />)
		emitInfo({ ...RUNNING, appMessage: 'Listening on all network interfaces' }, null)

		expect(screen.getByText('Running')).toBeTruthy()
		expect(screen.getByText('Listening on all network interfaces')).toBeTruthy()

		const launch = screen.getByRole<HTMLButtonElement>('button', { name: /Launch GUI/ })
		expect(launch.disabled).toBe(false)
		fireEvent.click(launch)
		expect(send).toHaveBeenCalledWith('launcher-open-gui')

		fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }))
		expect(send).toHaveBeenCalledWith('launcher-copy-url')
	})

	test('shows why the server failed to start', () => {
		render(<Launcher />)
		emitInfo(
			{
				...RUNNING,
				appStatus: 'error',
				appMessage: 'Port 8000 is already in use. Choose another port.',
				appLaunch: null,
			},
			null
		)

		expect(screen.getByText('Error')).toBeTruthy()
		expect(screen.getByText('Port 8000 is already in use. Choose another port.')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Copy URL' })).toBeNull()
	})

	test('warns about an OS version losing support', () => {
		render(<Launcher />)
		emitInfo(RUNNING, { platform: 'macos', minimumVersion: '14.0' })

		expect(screen.getByRole('alert').textContent).toContain('Upgrade to macOS 14.0 or later')
	})

	test('applies a typed port, then shows what the main process reports back', () => {
		render(<Launcher />)
		emitInfo(RUNNING, null)

		const port = screen.getByLabelText<HTMLInputElement>('Port')
		fireEvent.change(port, { target: { value: '80' } })
		fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
		expect(send).toHaveBeenCalledWith('launcher-set-http-port', '80')

		// The main process rejects it and resends the unchanged config
		emitInfo(RUNNING, null)
		expect(port.value).toBe('8000')
	})
})
