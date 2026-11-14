import { test as base, expect, type Page } from '@playwright/test'
import { launchCompanion, type CompanionServer } from './companion.js'

/**
 * One Companion application per Playwright worker, shared by the tests that worker runs.
 * Tests must therefore use distinct grid locations / variable names, the same discipline as the
 * backend integration suite.
 */
export const test = base.extend<NonNullable<unknown>, { scenario: string | null; companion: CompanionServer }>({
	/**
	 * A module which seeds the app before the tests run (see launch-app.mts), set with `test.use({ scenario })`.
	 * The app is shared by the worker, so this applies to the whole file
	 */
	scenario: [null, { scope: 'worker', option: true }],

	companion: [
		async ({ scenario }, use) => {
			const server = await launchCompanion(scenario)
			await use(server)
			await server.stop()
		},
		{ scope: 'worker' },
	],

	baseURL: async ({ companion }, use) => {
		await use(companion.url)
	},

	context: async ({ context }, use) => {
		// Suppress the "What's New" modal, which auto-opens when this localStorage key is behind
		await context.addInitScript(() => localStorage.setItem('whatsnew', '"99.0.0"'))
		await use(context)
	},
})

export { expect }
export type { Page } from '@playwright/test'

/**
 * Navigate to an admin ui page and wait for the app to finish loading (it shows a loading screen
 * until all its subscriptions have delivered)
 */
export async function gotoApp(page: Page, path: string): Promise<void> {
	await page.goto(path)
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })
}

/** Collect the console errors the page logs, to check none were logged */
export function watchConsoleErrors(page: Page): string[] {
	const errors: string[] = []
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text())
	})
	return errors
}

/** Reload the page and wait for the app to finish loading */
export async function reloadApp(page: Page): Promise<void> {
	await page.reload()
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })
}
