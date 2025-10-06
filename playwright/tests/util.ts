import { expect, type Page } from '@playwright/test'

export const COMPANION_URL = process.env.COMPANION_URL || 'http://localhost:8000/'

export async function loadPageAndWaitForReady(page: Page, path = '', dismissWhatsNew = true): Promise<void> {
	console.log(`Loading page: ${COMPANION_URL + '/' + path}`)
	await page.goto(COMPANION_URL + '/' + path)

	console.log('Page loaded, waiting for ready state...')

	if (dismissWhatsNew) {
		const button = page.locator('.modal-whatsnew button[aria-label="Close"]')
		if (await button.isVisible()) await button.click()
	}

	// Check page is connecting
	// TODO - it would be nice to check this, but that is too race prone
	// await expect(page.getByRole('heading', { name: 'Connecting', level: 3 })).toBeVisible()

	// Wait for connecting to disappear
	await expect(page.locator('.app-loading')).toHaveCount(0, { timeout: 20000 })

	console.log('Page ready')

	await assertNoErrorBoundaries(page)

	if (dismissWhatsNew) {
		const button = page.locator('.modal-whatsnew button[aria-label="Close"]')
		if (await button.isVisible()) await button.click()
	}
}

export async function assertNoErrorBoundaries(page: Page): Promise<void> {
	await expect(page.locator('.my-error-boundary')).not.toBeVisible()
}
