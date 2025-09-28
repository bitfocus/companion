import { test, expect } from '@playwright/test'
import { assertNoErrorBoundaries, loadPageAndWaitForReady } from './util.js'
import { performFullReset, closeTrpcConnection } from './trpc.js'

test.beforeAll(async () => {
	await performFullReset()
})

test.afterAll(async () => {
	// Always close the connection to prevent hanging processes
	await closeTrpcConnection()
})

test('basic page loading', async ({ page }) => {
	await loadPageAndWaitForReady(page, '', false)

	await expect(page).toHaveTitle('Bitfocus Companion - Admin')

	// Check that the whats new dialog is visible, and dismiss it
	await expect(page.locator('.modal-whatsnew')).toBeVisible()
	await page.locator('.modal-whatsnew button[aria-label="Close"]').click()

	// Check that the whats new dialog is gone
	await expect(page.locator('.modal-whatsnew')).not.toBeVisible()

	// Check that there are no errors shown
	await assertNoErrorBoundaries(page)
})

// test('get started link', async ({ page }) => {
// 	await page.goto('https://playwright.dev/')

// 	// Click the get started link.
// 	await page.getByRole('link', { name: 'Get started' }).click()

// 	// Expects page to have a heading with the name of Installation.
// 	await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible()
// })
