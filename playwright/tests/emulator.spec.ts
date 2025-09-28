import { test, expect } from '@playwright/test'
import { assertNoErrorBoundaries, loadPageAndWaitForReady } from './util.js'
import { closeTrpcConnection, performFullReset, trpcClient } from './trpc.js'

test.beforeAll(async () => {
	await performFullReset()

	// Create the initial emulator
	await trpcClient.surfaces.emulatorAdd.mutate({ name: '', baseId: 'emulator123', rows: 4, columns: 8 })
})

test.afterAll(async () => {
	// Always close the connection to prevent hanging processes
	await closeTrpcConnection()
})

// test('create emulator', async ({ page }) => {
// 	await loadPageAndWaitForReady(page, 'surfaces/configured')

// 	// Check that there are no errors shown
// 	await assertNoErrorBoundaries(page)

// 	// ensure there are no emulators
// 	await expect(page.locator('.surfaces-grid-container b', { hasText: 'Emulator' })).not.toBeVisible()

// 	// Click the "Add Emulator" button
// 	const addButton = page.locator('button', { hasText: 'Add Emulator' })
// 	await expect(addButton).toBeVisible()
// 	await addButton.click()

// 	// Ensure the modal is open
// 	const modal = page.locator('.modal-add-emulator')
// 	await expect(modal).toBeVisible()

// 	// Submit the form
// 	await modal.locator('button', { hasText: 'Add' }).click()

// 	// ensure there is now an emulators
// 	await expect(page.locator('.surfaces-grid-container b', { hasText: 'Emulator' })).toBeVisible()
// })

test('open created emulator', async ({ page }) => {
	await loadPageAndWaitForReady(page, 'emulator')

	// Check that there are no errors shown
	await assertNoErrorBoundaries(page)

	// Check one emulator exists
	const emulatorButtons = page.locator('.emulator-button')
	await expect(emulatorButtons).toHaveCount(1)

	// Check button looks sane
	await expect(emulatorButtons.first().locator('div')).toHaveText('Emulator')

	// Open first emulator
	await emulatorButtons.first().click()

	// Check that there are no errors shown
	await assertNoErrorBoundaries(page)

	// Count visible buttons
	const buttons = page.locator('.emulatorgrid .button-control')
	await expect(buttons).toHaveCount(32)
})
