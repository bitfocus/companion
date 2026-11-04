import { expect, gotoApp, reloadApp, test, watchConsoleErrors } from '../support/fixtures.js'

/**
 * Edits made through the ui reach the backend and are kept. The backend checks each change against a schema, so a
 * field sending a value of the wrong shape would be refused, which the ui reports as a console error.
 */

test('a regular button options persist', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/0/5').click()
	await page.getByRole('button', { name: 'Regular button' }).click()
	await page.getByRole('tab', { name: 'Options' }).click()

	const editor = page.locator('.edit-button-panel')
	await editor.getByRole('combobox', { name: 'Step Progression' }).click()
	await page.getByRole('option').filter({ hasNotText: 'On button release' }).first().click()
	const progression = await editor.getByRole('combobox', { name: 'Step Progression' }).textContent()
	await editor.getByRole('switch', { name: 'Rotary Actions' }).click()
	await editor.getByRole('switch', { name: 'Allow style changes' }).click()
	await expect(editor.getByRole('switch', { name: 'Rotary Actions' })).toBeChecked()

	await reloadApp(page)
	await page.getByTitle('1/0/5').click()
	await page.getByRole('tab', { name: 'Options' }).click()
	await expect(editor.getByRole('combobox', { name: 'Step Progression' })).toHaveText(progression ?? '')
	await expect(editor.getByRole('switch', { name: 'Rotary Actions' })).toBeChecked()
	await expect(editor.getByRole('switch', { name: 'Allow style changes' })).toBeChecked()

	expect(errors).toEqual([])
})

test('a settings dropdown persists', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/settings/buttons')

	const row = page.getByRole('row').filter({ hasText: 'Default decoration to show on each button' })
	await row.getByRole('combobox').click()
	await page.getByRole('option', { name: /Border/ }).click()
	await expect(row.getByRole('combobox')).toHaveValue(/Border/)

	await reloadApp(page)
	await expect(row.getByRole('combobox')).toHaveValue(/Border/)

	await row.getByTitle('Reset to default').click()
	await expect(row.getByRole('combobox')).toHaveValue(/Top bar/)

	expect(errors).toEqual([])
})

test('surface group settings persist', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/surfaces')
	await page.locator('.primary-panel').getByRole('button', { name: 'Add Emulator' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel(/^Name/).fill('Persist Emulator')
	await dialog.getByLabel(/^Id/).fill('persist')
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)

	const openPanel = async () => {
		const surface = page.locator('.primary-panel').getByText(/emulator:persist/)
		await expect(surface).toBeVisible()
		await surface.click()
		await expect(page.getByRole('heading', { name: /Settings for Persist Emulator/ })).toBeVisible()
	}
	await openPanel()
	await page.getByRole('switch', { name: 'Use Last Page At Startup' }).click()
	await page.getByRole('switch', { name: 'Never pin code lock' }).click()
	await page.getByRole('switch', { name: 'Restrict pages accessible to this surface' }).click()
	await expect(page.getByRole('switch', { name: 'Restrict pages accessible to this surface' })).toBeChecked()

	// The selected surface is kept in the url, so its panel is still open after the reload
	await reloadApp(page)
	await expect(page.getByRole('heading', { name: /Settings for Persist Emulator/ })).toBeVisible()
	await expect(page.getByRole('switch', { name: 'Use Last Page At Startup' })).not.toBeChecked()
	await expect(page.getByRole('switch', { name: 'Never pin code lock' })).toBeChecked()
	await expect(page.getByRole('switch', { name: 'Restrict pages accessible to this surface' })).toBeChecked()

	expect(errors).toEqual([])
})

test('a trigger name and enabled state persist', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/triggers')
	await page.locator('.primary-panel').getByRole('button', { name: 'Add Trigger' }).click()

	await page.getByRole('button', { name: 'Edit trigger name' }).click()
	const nameInput = page.locator('.secondary-panel').getByRole('textbox').first()
	await nameInput.fill('Persisted trigger')
	await nameInput.press('Enter')
	await expect(page.locator('.primary-panel').getByText('Persisted trigger')).toBeVisible()

	const enable = page
		.locator('.primary-panel')
		.getByRole('switch', { name: /^(Enable|Disable) trigger$/ })
		.first()
	const wasEnabled = await enable.isChecked()
	await enable.click()
	// The switch shows what the backend has, so this waits for the change to reach it
	await expect(enable).toBeChecked({ checked: !wasEnabled })

	await reloadApp(page)
	await expect(page.locator('.primary-panel').getByText('Persisted trigger')).toBeVisible()
	await expect(
		page
			.locator('.primary-panel')
			.getByRole('switch', { name: /^(Enable|Disable) trigger$/ })
			.first()
	).toBeChecked({
		checked: !wasEnabled,
	})

	expect(errors).toEqual([])
})

test('an expression variable persists', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/variables/expression')
	await page.locator('.primary-panel').getByRole('button', { name: 'Add Expression Variable' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('textbox', { name: 'Name' }).fill('e2e_persist')
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)

	await expect(page.locator('.primary-panel').getByText('e2e_persist').first()).toBeVisible()
	await reloadApp(page)
	await expect(page.locator('.primary-panel').getByText('e2e_persist').first()).toBeVisible()

	expect(errors).toEqual([])
})

test('a backup rule edit persists', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/settings/backups')

	const enable = page.getByRole('switch', { name: /^(Enable|Disable) rule$/ }).first()
	const wasEnabled = await enable.isChecked()
	await enable.click()
	// The switch shows what the backend has, so this waits for the change to reach it
	await expect(enable).toBeChecked({ checked: !wasEnabled })

	await reloadApp(page)
	await expect(page.getByRole('switch', { name: /^(Enable|Disable) rule$/ }).first()).toBeChecked({
		checked: !wasEnabled,
	})

	expect(errors).toEqual([])
})
