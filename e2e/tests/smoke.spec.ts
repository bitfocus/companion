import { expect, gotoApp, test } from '../support/fixtures.js'

test('the app loads to the connections page with no blocking modals', async ({ page }) => {
	await gotoApp(page, '/')

	await expect(page).toHaveURL(/\/connections/)

	for (const link of ['Connections', 'Buttons', 'Triggers', 'Variables', 'Settings', 'Log']) {
		await expect(page.locator('.nav-link', { hasText: link }).first()).toBeVisible()
	}

	// Neither the setup wizard nor the what's new modal should be covering the app
	await expect(page.getByRole('dialog')).toHaveCount(0)
})
