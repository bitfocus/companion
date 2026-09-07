import { expect, gotoApp, test } from '../support/fixtures.js'

test('create a button and set its text, which survives a reload', async ({ page }) => {
	await gotoApp(page, '/buttons')

	// Click an empty cell, then pick the button type in the edit panel
	await page.getByTitle('1/1/1').click()
	await page.getByRole('button', { name: 'Regular button' }).click()

	// The style tab has the text element pre-selected
	await page.getByRole('tab', { name: 'Style' }).click()
	await page.getByLabel('Button text string').fill('Hello e2e')

	// The grid cell renders the new button through the real graphics pipeline
	await expect(page.getByTitle('1/1/1')).toHaveCSS('background-image', /data:image/)

	// The edit round-trips through the backend: still there after a full reload
	await page.reload()
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })
	await page.getByTitle('1/1/1').click()
	await page.getByRole('tab', { name: 'Style' }).click()
	await expect(page.getByLabel('Button text string')).toHaveValue('Hello e2e')
})
