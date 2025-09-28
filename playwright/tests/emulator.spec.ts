import { test, expect } from '@playwright/test'
import { assertNoErrorBoundaries, loadPageAndWaitForReady } from './util.js'

test('create emulator', async ({ page }) => {
	await loadPageAndWaitForReady(page, 'surfaces/configured', true)

	// Check that there are no errors shown
	await assertNoErrorBoundaries(page)

	// ensure there are no emulators
	await expect(page.locator('.surfaces-grid-container b', { hasText: 'Emulator' })).not.toBeVisible()

	// Click the "Add Emulator" button
	const addButton = page.locator('button', { hasText: 'Add Emulator' })
	await expect(addButton).toBeVisible()
	await addButton.click()

	// Ensure the modal is open
	const modal = page.locator('.modal-add-emulator')
	await expect(modal).toBeVisible()

	// Submit the form
	await modal.locator('button', { hasText: 'Add' }).click()

	// ensure there is now an emulators
	await expect(page.locator('.surfaces-grid-container b', { hasText: 'Emulator' })).toBeVisible()
})
