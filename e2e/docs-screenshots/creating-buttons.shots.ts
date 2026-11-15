import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { shoot, shootPanel, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/program/buttons/creating/index.md, steps.md, actions.md and feedbacks.md
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })
// Wide, so that the edit panels don't wrap their content too much
test.use({ viewport: { width: 1920, height: 1600 } })

const IMAGES = '3_config/program/buttons/creating/images'

/** Open a button in the editor, on the buttons page */
async function editButton(page: Page, location: string): Promise<void> {
	await gotoApp(page, '/buttons')
	await page.getByTitle(location, { exact: true }).click()
	await expect(page.getByRole('tab', { name: `Edit Button ${location}` })).toBeVisible()
}

/** Open a tab of the button editor */
async function openEditorTab(page: Page, name: string): Promise<void> {
	await page.locator('.secondary-panel').getByRole('tab', { name, exact: true }).click()
}

const panel = (page: Page) => page.locator('.secondary-panel')

test('presets', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByRole('tab', { name: 'Presets' }).click()
	await expect(panel(page).getByText('Blackmagic Design: ATEM')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/preset-modules`)

	// The presets of a real module, an ATEM
	await panel(page).getByText('Blackmagic Design: ATEM').click()
	await panel(page).getByRole('button', { name: 'MixEffect Program/Preview', exact: true }).click()
	// Down to the end of its program and preview buttons
	const lastPreviewButton = panel(page).getByRole('button', { name: 'Preview button for MP2K', exact: true })
	await expect(lastPreviewButton).toBeVisible()
	await shoot(
		page,
		await unionClip(page, [panel(page).getByRole('tablist'), lastPreviewButton]),
		`${IMAGES}/preset-buttons`
	)

	await panel(page).getByRole('button', { name: 'Back', exact: true }).click()
	await panel(page).getByText('Demo: Vision Mixer').click()
	// Linked or copied, and the composite elements
	await panel(page).getByRole('button', { name: 'Inputs', exact: true }).click()
	await panel(page)
		.getByRole('button', { name: /^Showcase/ })
		.click()
	await expect(panel(page).getByRole('button', { name: 'Camera with tally' })).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/preset-placement`)
})

test('linked preset', async ({ page }) => {
	await editButton(page, '1/0/1')
	await expect(panel(page).getByText('Preset variables')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/linked-preset`)
})

// These panels centre what they show, so are taken with a shorter window
test('selecting the type of a button', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 640 }, async () => {
		await editButton(page, '1/0/5')
		await expect(panel(page).getByText('Empty button')).toBeVisible()
		await shoot(page, panel(page), `${IMAGES}/selecting-type`)
	})
})

test('convert to normal button', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 560 }, async () => {
		await editButton(page, '1/0/0')
		await expect(panel(page).getByText('Page up button', { exact: true })).toBeVisible()
		await shoot(page, panel(page), `${IMAGES}/convert-to-normal-button`)
	})
})

test('button reference', async ({ page }) => {
	await editButton(page, '1/2/1')
	await expect(panel(page).getByText('Mirrored button')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/button-reference`)
})

test('button notes', async ({ page }) => {
	await editButton(page, '1/0/2')
	const notes = panel(page).getByText('Puts this camera on program. Red when live.')
	await expect(notes).toBeVisible()
	await shoot(
		page,
		await unionClip(page, [panel(page).locator('.edit-button-summary'), panel(page).locator('.notes-preview')], 0),
		`${IMAGES}/button-notes`
	)
})

test('steps', async ({ page }) => {
	await editButton(page, '1/2/2')
	await panel(page).getByRole('button', { name: 'Step 2' }).click()
	await shootPanel(panel(page), `${IMAGES}/button-step2`)
})

test('actions', async ({ page }) => {
	await editButton(page, '1/2/6')
	await expect(panel(page).getByText('Auto transition')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/button-actions`)

	await editButton(page, '1/2/5')
	const group = panel(page).locator('.entity-row', { hasText: 'Action Group' }).first()
	await expect(group).toBeVisible()
	// With the actions in it collapsed, as what matters is the group
	await group.getByRole('button', { name: 'Collapse all' }).click()
	await expect(group.getByText('Put an input on preview, ready for the next transition')).toBeHidden()
	// Off the button just clicked, so that it isn't shown hovered
	await page.mouse.move(0, 0)
	await shoot(page, group, `${IMAGES}/action-group-sequential`)
})

test('generated image', async ({ page }) => {
	await editButton(page, '1/3/0')
	await openEditorTab(page, 'Feedbacks')
	await expect(panel(page).getByText('Audio meters (image)')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/feedback-advanced-example`)
})

test('feedbacks', async ({ page }) => {
	await editButton(page, '1/2/4')
	await openEditorTab(page, 'Feedbacks')
	await expect(panel(page).getByText('Check boolean expression')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/feedback-list`)
	await shoot(
		page,
		panel(page).locator('.entity-row', { hasText: 'Check boolean expression' }).first(),
		`${IMAGES}/feedback-example-result`
	)

	await editButton(page, '1/2/3')
	await openEditorTab(page, 'Feedbacks')
	await expect(panel(page).getByText('Audio level (dB)')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/feedback-value-override`)
})

test('adding element properties to a feedback', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 1000 }, async () => {
		await editButton(page, '1/2/4')
		await openEditorTab(page, 'Feedbacks')
		await panel(page).getByTitle('Add override').first().click()
		const modal = page.getByRole('dialog')
		await modal.getByText('Text', { exact: true }).click()
		await modal.getByText('Color', { exact: true }).click()
		await modal.getByText('Text Size', { exact: true }).click()
		await shoot(page, modal, `${IMAGES}/feedback-add-element-properties`)
	})
})
