import { expect, gotoApp, test, type Page } from '../support/fixtures.js'

/** Create a custom variable through the variables page */
async function createCustomVariable(page: Page, name: string): Promise<void> {
	await gotoApp(page, '/variables/custom')
	await page.getByPlaceholder('variableName').fill(name)
	await page.getByRole('button', { name: 'Add' }).click()
	await expect(page.getByText(`$(custom:${name})`)).toBeVisible()
}

/** The variables page row for one custom variable */
function variableRow(page: Page, name: string) {
	return page.locator('.editor-grid').filter({ hasText: `$(custom:${name})` })
}

/** Create a button and give it an internal custom_variable_set_value action, all through the ui */
async function createButtonSettingVariable(
	page: Page,
	cellTitle: string,
	variableName: string,
	value: string
): Promise<void> {
	await gotoApp(page, '/buttons')
	await page.getByTitle(cellTitle).click()
	await page.getByRole('button', { name: 'Regular button' }).click()
	await page.getByRole('tab', { name: 'Step 1' }).click()

	// The picker only lists matches once something is typed
	const addAction = page.getByPlaceholder('+ Add action').first()
	await addAction.click()
	await addAction.fill('custom variable set value')
	await page.getByRole('option', { name: 'internal: Custom Variable: Set value' }).click()

	const row = page.locator('.entity-row', { hasText: 'internal: Custom Variable: Set value' })
	await expect(row).toBeVisible()

	// The variable dropdown input is covered by its group wrapper, so open it via the chevron
	// button; the popup is portalled to the body
	await row.locator('.dropdown-field-trigger').click()
	await page.getByRole('option', { name: new RegExp(variableName) }).click()

	await row.getByLabel('Value', { exact: true }).fill(value)
}

test('configure an action through the editor and run it with test press', async ({ page }) => {
	await createCustomVariable(page, 'edit_var')

	await createButtonSettingVariable(page, '1/3/3', 'edit_var', 'pressed by test')

	await page.getByTitle('Test press button').click()

	await gotoApp(page, '/variables/custom')
	await expect(variableRow(page, 'edit_var').getByLabel('Current value:')).toHaveValue('pressed by test')
})

test('the full user loop: configure a button, press it in the emulator, see the variable change', async ({ page }) => {
	await createCustomVariable(page, 'loop_var')

	await createButtonSettingVariable(page, '1/3/4', 'loop_var', 'pressed via emulator')

	// Add an emulator and press the button through it
	await gotoApp(page, '/surfaces')
	await page.getByRole('button', { name: 'Add Emulator' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel(/^Id/).fill('e2eloop')
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)

	await page.goto('/emulator/e2eloop')
	await page.getByTitle('Button 3/4').click()

	await gotoApp(page, '/variables/custom')
	await expect(variableRow(page, 'loop_var').getByLabel('Current value:')).toHaveValue('pressed via emulator')
})

test('add and configure a feedback through the editor, surviving a reload', async ({ page }) => {
	await createCustomVariable(page, 'fb_var')

	await gotoApp(page, '/buttons')
	await page.getByTitle('1/3/5').click()
	await page.getByRole('button', { name: 'Regular button' }).click()
	await page.getByRole('tab', { name: 'Feedbacks' }).click()

	const addFeedback = page.getByPlaceholder('+ Add feedback')
	await addFeedback.click()
	await addFeedback.fill('variable check value')
	await page.getByRole('option', { name: 'internal: Variable: Check value' }).click()

	const row = page.locator('.entity-row', { hasText: 'internal: Variable: Check value' })
	await expect(row).toBeVisible()

	// The variable picker allows custom values, so it can be typed directly
	await row.getByRole('combobox').first().fill('custom:fb_var')
	await row.getByRole('combobox').first().blur()
	await row.getByLabel('Value', { exact: true }).fill('yes')

	// The feedback round-trips through the backend
	await page.reload()
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })
	await page.getByTitle('1/3/5').click()
	await page.getByRole('tab', { name: 'Feedbacks' }).click()
	const rowAfter = page.locator('.entity-row', { hasText: 'internal: Variable: Check value' })
	await expect(rowAfter).toBeVisible()
	await expect(rowAfter.getByLabel('Value', { exact: true })).toHaveValue('yes')
})
