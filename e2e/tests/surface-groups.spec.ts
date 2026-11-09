import { expect, gotoApp, reloadApp, test, watchConsoleErrors } from '../support/fixtures.js'

test('a surface group holds an emulator, with its own startup and allowed pages', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	// A second page, to start on and restrict to
	await gotoApp(page, '/buttons')
	await page.getByRole('tab', { name: 'Pages' }).click()
	const pageCount = await page.getByTitle('Jump to page').count()
	await page.getByRole('button', { name: 'Add Page' }).click()
	await expect(page.getByTitle('Jump to page')).toHaveCount(pageCount + 1)

	await gotoApp(page, '/surfaces')
	const list = page.locator('.primary-panel')

	await list.getByRole('button', { name: 'Add Group' }).click()
	let dialog = page.getByRole('dialog')
	await dialog.getByRole('textbox', { name: 'Name' }).fill('E2E Group')
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)

	await list.getByRole('button', { name: 'Add Emulator' }).click()
	dialog = page.getByRole('dialog')
	await dialog.getByLabel(/^Name/).fill('Grouped Emulator')
	await dialog.getByLabel(/^Id/).fill('grouped')
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)

	await list.getByText(/emulator:grouped/).click()
	await page.getByRole('combobox', { name: 'Surface Group' }).click()
	await page.getByRole('option', { name: /E2E Group/ }).click()
	await expect(page.getByRole('combobox', { name: 'Surface Group' })).toHaveText(/E2E Group/)

	const panel = page.locator('.secondary-panel')
	const allowedPages = panel.getByRole('combobox', { name: 'Allowed pages' })

	await list.getByText(/group:/).click()
	await expect(page.getByRole('heading', { name: 'Settings for E2E Group' })).toBeVisible()
	await panel.getByRole('switch', { name: 'Use Last Page At Startup' }).click()
	await panel.getByRole('combobox', { name: 'Startup Page' }).click()
	await page.getByRole('option', { name: /^2/ }).click()
	await panel.getByRole('switch', { name: 'Restrict pages accessible to this group' }).click()
	await allowedPages.click()
	await page.getByRole('option', { name: /^2/ }).click()
	await page.keyboard.press('Escape')
	await expect(panel.getByRole('button', { name: /^Remove 2/ })).toBeVisible()

	// The selected group is kept in the url, so its panel is still open after the reload
	await reloadApp(page)
	await expect(page.getByRole('heading', { name: 'Settings for E2E Group' })).toBeVisible()
	await expect(panel.getByRole('switch', { name: 'Use Last Page At Startup' })).not.toBeChecked()
	await expect(panel.getByRole('combobox', { name: 'Startup Page' })).toHaveValue(/^2/)
	await expect(panel.getByRole('switch', { name: 'Restrict pages accessible to this group' })).toBeChecked()
	await expect(panel.getByRole('button', { name: /^Remove 2/ })).toBeVisible()

	await list.getByText(/emulator:grouped/).click()
	await expect(page.getByRole('combobox', { name: 'Surface Group' })).toHaveText(/E2E Group/)

	expect(errors).toEqual([])
})
