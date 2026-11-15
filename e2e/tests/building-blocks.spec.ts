import type { Locator } from '@playwright/test'
import {
	clickListPageAdd,
	expect,
	gotoApp,
	reloadApp,
	test,
	watchConsoleErrors,
	type Page,
} from '../support/fixtures.js'
import { createCustomVariable, customVariableRow, navigateToCustomVariables } from '../support/variables.js'

/** The kinds of building block, which share their list page */
const KINDS = [
	{ path: '/custom-actions', nounTitle: 'Custom Action', noun: 'custom action' },
	{ path: '/custom-feedbacks', nounTitle: 'Custom Feedback', noun: 'custom feedback' },
] as const

function listRow(page: Page, name: string): Locator {
	return page.locator('.primary-panel .list-row').filter({ has: page.getByText(name, { exact: true }) })
}

for (const kind of KINDS) {
	test(`a ${kind.noun} can be added, renamed, cloned and deleted`, async ({ page }) => {
		const errors = watchConsoleErrors(page)
		const name = `e2e ${kind.noun}`

		await gotoApp(page, kind.path)
		await clickListPageAdd(page, `Add ${kind.nounTitle}`, `Add your first ${kind.noun}`)

		// The new one is opened in the editor
		const editor = page.locator('.secondary-panel')
		await expect(editor.getByText(`Edit ${kind.nounTitle}`)).toBeVisible()
		await editor.getByRole('textbox', { name: 'Name' }).fill(name)
		await editor.getByRole('textbox', { name: 'Description' }).fill('Made by e2e')
		await expect(listRow(page, name)).toContainText('Made by e2e')

		await listRow(page, name).getByTitle(`Clone ${kind.noun}`).click()
		await expect(listRow(page, `${name} (copy)`)).toBeVisible()

		await listRow(page, `${name} (copy)`).getByTitle(`Delete ${kind.noun}`).click()
		const dialog = page.getByRole('dialog')
		await expect(dialog).toContainText(`Are you sure you wish to delete this ${kind.noun}?`)
		await dialog.getByRole('button', { name: 'Delete' }).click()
		await expect(listRow(page, `${name} (copy)`)).toHaveCount(0)

		await reloadApp(page)
		await expect(listRow(page, name)).toContainText('Made by e2e')
		await expect(listRow(page, `${name} (copy)`)).toHaveCount(0)

		expect(errors).toEqual([])
	})
}

test('a custom action can be test run from the list', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await createCustomVariable(page, 'test_run_out')

	await gotoApp(page, '/custom-actions')
	await clickListPageAdd(page, 'Add Custom Action', 'Add your first custom action')
	const editor = page.locator('.secondary-panel')
	await editor.getByRole('textbox', { name: 'Name' }).fill('e2e test run')

	// The run sets a custom variable, so that it can be seen to have happened
	const addAction = editor.getByPlaceholder('+ Add action')
	await addAction.click()
	await addAction.fill('custom variable set value')
	await page.getByRole('option', { name: 'internal: Custom Variable: Set value' }).click()
	const actionRow = editor.locator('.entity-row', { hasText: 'Custom Variable: Set value' })
	await actionRow.locator('.dropdown-field-trigger').click()
	await page.getByRole('option', { name: /test_run_out/ }).click()
	await actionRow.getByLabel('Value', { exact: true }).fill('ran')

	await listRow(page, 'e2e test run').getByTitle('Test run, with the default inputs').click()

	// Navigate inside the app, as a page load could cut the run short
	await navigateToCustomVariables(page)
	await expect(customVariableRow(page, 'test_run_out')).toContainText('ran')
	await expect(page.getByText('Test Failed')).toHaveCount(0)

	expect(errors).toEqual([])
})

test('the tabs move between the kinds of building block', async ({ page }) => {
	await gotoApp(page, '/custom-actions')
	const tabs = page.locator('.page-tabs')
	await expect(tabs.locator('.page-tab.active')).toHaveText('Custom Actions')

	await tabs.getByRole('link', { name: 'Custom Feedbacks' }).click()
	await expect(page).toHaveURL(/\/custom-feedbacks$/)
	await expect(tabs.locator('.page-tab.active')).toHaveText('Custom Feedbacks')
})
