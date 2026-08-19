import { expect, gotoApp, test, type Page } from '../support/fixtures.js'

async function createCustomVariable(page: Page, name: string): Promise<void> {
	await gotoApp(page, '/variables/custom')
	await page.getByPlaceholder('variableName').fill(name)
	await page.getByRole('button', { name: 'Add' }).click()
	await expect(page.getByText(`$(custom:${name})`)).toBeVisible()
}

function variableRow(page: Page, name: string) {
	return page.locator('.editor-grid').filter({ hasText: `$(custom:${name})` })
}

test('configure and fire a variable-change trigger through the ui', async ({ page }) => {
	await createCustomVariable(page, 'watch_src')
	await createCustomVariable(page, 'watch_dst')

	await gotoApp(page, '/triggers')
	await page.getByRole('button', { name: 'Add Trigger' }).click()

	// Rename it, so the list row can be identified
	await page.getByLabel('Name').fill('E2E trigger')
	const listRow = page.locator('.collections-nesting-table-row-item', { hasText: 'E2E trigger' })
	await expect(listRow).toBeVisible()

	// Watch the source variable
	await page.getByRole('tab', { name: 'Events' }).click()
	await page.getByPlaceholder('+ Add event').click()
	await page.getByRole('option', { name: 'On variable change' }).click()
	// Commit the variable by picking the filtered option - the popup would otherwise stay open
	// over the tab bar
	const eventRow = page.locator('.entity-row', { hasText: 'On variable change' })
	await eventRow.getByRole('combobox').fill('custom:watch_src')
	await page.getByRole('option', { name: /custom:watch_src/ }).click()

	// Set the destination variable when it fires
	await page.getByRole('tab', { name: 'Actions' }).click()
	const addAction = page.getByPlaceholder('+ Add action')
	await addAction.click()
	await addAction.fill('custom variable set value')
	await page.getByRole('option', { name: 'internal: Custom Variable: Set value' }).click()
	const actionRow = page.locator('.entity-row', { hasText: 'internal: Custom Variable: Set value' })
	await actionRow.locator('.dropdown-field-trigger').click()
	await page.getByRole('option', { name: /watch_dst/ }).click()
	await actionRow.getByLabel('Value', { exact: true }).fill('triggered!')

	// Triggers are created disabled; the toggle lives on the list row
	await listRow.getByRole('switch').click()
	await expect(listRow.getByRole('switch')).toHaveAttribute('aria-checked', 'true')

	// Change the watched variable through the variables page (rows are expanded by default)
	await gotoApp(page, '/variables/custom')
	await variableRow(page, 'watch_src').getByLabel('Current value:').fill('go')

	// The trigger fires and sets the destination variable
	await expect(variableRow(page, 'watch_dst').getByLabel('Current value:')).toHaveValue('triggered!')
})

test('interval event options persist', async ({ page }) => {
	await gotoApp(page, '/triggers')
	await page.getByRole('button', { name: 'Add Trigger' }).click()
	await page.getByLabel('Name').fill('Interval trigger')

	await page.getByRole('tab', { name: 'Events' }).click()
	await page.getByPlaceholder('+ Add event').click()
	await page.getByRole('option', { name: 'Time Interval: Fixed' }).click()

	// A plain fill misbehaves on the number field, so replace the content via the keyboard
	const interval = page.getByLabel('Interval (seconds)')
	await interval.click()
	await interval.press('ControlOrMeta+a')
	await interval.pressSequentially('42')
	await interval.blur()

	await page.reload()
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })
	await expect(page.getByLabel('Interval (seconds)')).toHaveValue('42')
})
