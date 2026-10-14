import { expect, gotoApp, test } from '../support/fixtures.js'

test('the theme follows the system until one is chosen, and the choice survives a reload', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' })
	await gotoApp(page, '/connections')

	// Nothing chosen yet, so it follows the system
	const html = page.locator('html')
	await expect(html).toHaveAttribute('data-theme', 'dark')

	// Choose light from the top bar, overriding the system
	await page.getByTitle('Theme: System').click()
	await page.locator('.popover2-popup').getByText('Light', { exact: true }).click()
	await expect(html).toHaveAttribute('data-theme', 'light')

	// Applied before the app loads, so a reload shows it straight away
	await page.reload()
	await expect(html).toHaveAttribute('data-theme', 'light')
	await expect(page.getByTitle('Theme: Light')).toBeVisible({ timeout: 30_000 })

	// Back to following the system, which switches live
	await page.getByTitle('Theme: Light').click()
	await page.locator('.popover2-popup').getByText('System', { exact: true }).click()
	await expect(html).toHaveAttribute('data-theme', 'dark')
	await page.emulateMedia({ colorScheme: 'light' })
	await expect(html).toHaveAttribute('data-theme', 'light')
})
