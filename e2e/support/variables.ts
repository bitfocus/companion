import type { Locator, Page } from '@playwright/test'
import { expect, gotoApp } from './fixtures.js'

/** The custom variables list row for one variable */
export function customVariableRow(page: Page, name: string): Locator {
	return page.getByRole('button', { name: `$(custom:${name})` })
}

/**
 * Navigate to the custom variables page through the sidebar, without reloading the page. Use this
 * instead of `gotoApp` when an earlier step fired a mutation that must not be cut short by a reload.
 */
export async function navigateToCustomVariables(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Variables' }).click()
	await page.getByRole('link', { name: 'Custom', exact: true }).click()
}

/** Create a custom variable through the variables page */
export async function createCustomVariable(page: Page, name: string): Promise<void> {
	await gotoApp(page, '/variables/custom')

	await page.getByRole('button', { name: 'Add Custom Variable' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByPlaceholder('variableName').fill(name)
	await dialog.getByRole('button', { name: 'Add', exact: true }).click()

	await expect(customVariableRow(page, name)).toBeVisible()
}

/**
 * Open a custom variable's edit panel from the list, and return its "Current value" input.
 * The list is a master/detail pair, so the value only exists once the row is selected.
 */
export async function openCustomVariableValue(page: Page, name: string): Promise<Locator> {
	await customVariableRow(page, name).click()

	const value = page.getByLabel('Current value:')
	await expect(value).toBeVisible()
	return value
}
