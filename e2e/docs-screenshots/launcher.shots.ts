import path from 'node:path'
import { test, type Page } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
import { expect } from '../support/fixtures.js'
import { shoot, shootUnthemed } from './shoot.js'

// docs/user-guide/1_getting-started/start-the-server.md
// The launcher's windows are served by vite, with the electron main process they talk to standing in for itself

const IMAGES = '1_getting-started/images'

/** What the main process answers each request of the windows with */
const RESPONSES: Record<string, unknown[]> = {
	info: [
		{
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
			trusted_proxies: 'loopback',
		},
		{ appVersion: '5.2.0', appStatus: 'running', appMessage: null, appLaunch: 'http://127.0.0.1:8000/' },
		'win32',
		null,
	],
	'network-interfaces:get': [
		[
			{ id: '0.0.0.0', label: 'All Interfaces: 0.0.0.0' },
			{ id: '127.0.0.1', label: 'Loopback: 127.0.0.1' },
			{ id: '192.168.0.5', label: 'Ethernet: 192.168.0.5' },
		],
	],
}

/** The bridge to the main process, which the windows use */
interface LauncherApi {
	send: (channel: string) => void
	receive: (channel: string, func: (...args: unknown[]) => void) => () => void
}

let server: ViteDevServer

test.beforeAll(async () => {
	const root = path.join(import.meta.dirname, '../../launcher-ui')
	server = await createServer({
		root,
		configFile: path.join(root, 'vite.config.ts'),
		server: { port: 0, strictPort: false },
		logLevel: 'warn',
	})
	await server.listen()
})

test.afterAll(async () => {
	await server.close()
})

/** Open a window of the launcher, answering its requests of the main process */
async function openWindow(page: Page, file: string): Promise<void> {
	await page.addInitScript((responses) => {
		const listeners = new Map<string, (...args: unknown[]) => void>()
		// The bridge the launcher's preload scripts expose (see launcher-ui/src/global.d.ts)
		;(window as unknown as { api: LauncherApi }).api = {
			send: (channel) => {
				const response = responses[channel]
				if (response) setTimeout(() => listeners.get(channel)?.(...response), 0)
			},
			receive: (channel, func) => {
				listeners.set(channel, func)
				return () => listeners.delete(channel)
			},
		}
	}, RESPONSES)

	const url = server.resolvedUrls?.local[0]
	if (!url) throw new Error('The launcher ui is not being served')
	await page.goto(new URL(file, url).href)
}

test('launcher window', async ({ page }) => {
	// The size of the window
	await page.setViewportSize({ width: 400, height: 520 })
	await openWindow(page, 'launcher.html')
	await expect(page.getByText('http://127.0.0.1:8000/').first()).toBeVisible()
	// It always uses the dark theme
	await shootUnthemed(page.locator('body'), `${IMAGES}/launcher`)
})

test('advanced settings window', async ({ page }) => {
	// The size of the window, which scrolls
	const window = { width: 1000, height: 720 }
	await page.setViewportSize(window)
	await openWindow(page, 'index.html')
	await expect(page.getByRole('navigation', { name: 'Settings sections' })).toBeVisible()
	await shoot(page, { page, clip: { x: 0, y: 0, ...window } }, `${IMAGES}/launcher-advanced`)
})
