import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { contentClip, shoot, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/program/variables.md, triggers.md and image-library.md
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })
// Wide, so that the edit panels don't wrap their content too much
test.use({ viewport: { width: 1920, height: 1600 } })

const IMAGES = '3_config/program/images'

const primary = (page: Page) => page.locator('.primary-panel')
const secondary = (page: Page) => page.locator('.secondary-panel')

test('variables page', async ({ page }) => {
	await gotoApp(page, '/variables')
	await expect(primary(page).getByText('Demo: Media Player')).toBeVisible()
	await shoot(page, await contentClip(primary(page)), `${IMAGES}/variables-page`)

	await primary(page).getByText('Demo: Vision Mixer').click()
	await expect(secondary(page).getByText('$(mixer:input_1_name)')).toBeVisible()
	await withViewport(page, { width: 1280, height: 700 }, async () => {
		await shoot(page, page.locator('.split-panels'), `${IMAGES}/variables-connection`)
	})
})

test('using a variable', async ({ page }) => {
	// Short, as the preview of the button fills the height of the editor
	await page.setViewportSize({ width: 1440, height: 1100 })
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/3/6', { exact: true }).click()
	await secondary(page).getByRole('tab', { name: 'Style', exact: true }).click()
	await secondary(page).locator('.element-name').getByText('Text', { exact: true }).click()

	const textRow = secondary(page).locator('.property-inspector-row', { hasText: 'Button text string' })
	await expect(textRow.locator('input')).toHaveValue('On air\\n$(mixer:program_input_name)')
	// The text and the button showing it, with the sections between them collapsed
	for (const section of ['Drawing', 'Position & Size']) {
		const item = secondary(page).locator('.accordion2-item', {
			has: page.locator('.accordion2-trigger', { hasText: section }),
		})
		await item.locator('.accordion2-trigger').click()
		await expect(item.getByRole('region')).toBeHidden()
	}
	await shoot(
		page,
		await unionClip(page, [secondary(page).locator('.button-layer-top'), textRow], 0),
		`${IMAGES}/dynamic-variable-usage`
	)
	await shoot(page, textRow.locator('.feature-icons'), `${IMAGES}/variables-support`)
})

test('custom variables', async ({ page }) => {
	await withViewport(page, { width: 1280, height: 600 }, async () => {
		await gotoApp(page, '/variables/custom')
		await primary(page).getByText('$(custom:show_name)').click()
		await expect(secondary(page).locator('input[value="The name of the show"]')).toBeVisible()
		await shoot(page, page.locator('.split-panels'), `${IMAGES}/variables-custom`)
	})
})

test('expression variables', async ({ page }) => {
	await withViewport(page, { width: 1280, height: 700 }, async () => {
		await gotoApp(page, '/variables/expression')
		await primary(page).getByText('$(expression:on_air)').click()
		await expect(secondary(page).getByText('toUpperCase')).toBeVisible()
		await shoot(page, page.locator('.split-panels'), `${IMAGES}/variables-expression`)
	})
})

test('local variables', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/3/5', { exact: true }).click()
	await secondary(page).getByRole('tab', { name: 'Local Variables', exact: true }).click()

	const row = (name: string) => secondary(page).locator('.entity-row', { hasText: name }).first()
	await shoot(page, row('User Value'), `${IMAGES}/variables-local-value`)
	await shoot(page, row('Evaluate Expression'), `${IMAGES}/variables-local-expression`)
	await shoot(page, row('Input is on program'), `${IMAGES}/variables-local-feedback`)

	await secondary(page).getByRole('button', { name: 'Collapse all' }).click()
	await expect(secondary(page).getByText('$(local:doubled)')).toBeVisible()
	await shoot(page, await contentClip(secondary(page)), `${IMAGES}/variables-page-collapsed`)
})

test('triggers', async ({ page }) => {
	await gotoApp(page, '/triggers')
	await expect(primary(page).getByText('Camera 2 ready')).toBeVisible()
	await shoot(page, await contentClip(primary(page)), `${IMAGES}/triggers`)

	await primary(page).getByText('Camera 2 ready').click()
	const stages = secondary(page).locator('.trigger-stage')
	await expect(stages).toHaveCount(3)
	await shoot(page, stages.nth(0), `${IMAGES}/triggers/events`)
	await shoot(page, stages.nth(1), `${IMAGES}/triggers/condition`)
	await shoot(page, stages.nth(2), `${IMAGES}/triggers/actions`)
})

test('image library', async ({ page }) => {
	await gotoApp(page, '/image-library')
	await expect(primary(page).getByText('The Companion logo')).toBeVisible()
	await shoot(page, await contentClip(primary(page)), `${IMAGES}/image-library-managing`)

	await primary(page).getByText('The Companion logo').click()
	await expect(secondary(page).getByRole('img').first()).toBeVisible()
	await shoot(page, await contentClip(secondary(page)), `${IMAGES}/image-library-edit`)
})
