import { expect, gotoApp, test, type Page } from '../support/fixtures.js'

const SETTING_LABEL = 'Flip counting direction on page up/down buttons'

function settingRow(page: Page) {
	return page.getByRole('row').filter({ hasText: SETTING_LABEL })
}

test('a settings switch persists, and can be reset to default', async ({ page }) => {
	await gotoApp(page, '/settings/buttons')

	const toggle = settingRow(page).getByRole('switch')
	await expect(toggle).toHaveAttribute('aria-checked', 'false')
	await toggle.click()
	await expect(toggle).toHaveAttribute('aria-checked', 'true')

	// The change round-trips through the backend
	await page.reload()
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })
	await expect(settingRow(page).getByRole('switch')).toHaveAttribute('aria-checked', 'true')

	// And the reset button restores the default
	await settingRow(page).getByTitle('Reset to default').click()
	await expect(settingRow(page).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
})
