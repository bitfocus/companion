import type { Locator, Page } from '@playwright/test'
import { expect } from '../support/fixtures.js'

const THEMES = ['light', 'dark'] as const

/** What to capture: an element, or an area of the page */
export type ShotTarget = Locator | { page: Page; clip: { x: number; y: number; width: number; height: number } }

/**
 * Capture a screenshot for the docs in both themes, from the same state, as `<name>.light.png` and `<name>.dark.png`
 * @param page The page
 * @param target What to capture
 * @param name The path of the image under `docs/user-guide`, without its extension, eg
 * `3_config/images/custom-actions/uses`. The docs show it as `![…](images/custom-actions/uses.png)`
 */
export async function shoot(page: Page, target: ShotTarget, name: string): Promise<void> {
	for (const theme of THEMES) {
		await page.emulateMedia({ colorScheme: theme })
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

		const segments = `${name}.${theme}.png`.split('/')
		if ('clip' in target) {
			await expect(target.page).toHaveScreenshot(segments, { clip: target.clip })
		} else {
			await expect(target).toHaveScreenshot(segments)
		}
	}
}

/**
 * The area of an edit panel down to the end of its content, rather than the full height of the panel
 * @param panel The panel, which fills the height of the page
 * @param content The content of the panel, which may be shorter
 */
export async function panelClip(panel: Locator, content: Locator): Promise<ShotTarget> {
	const panelBox = await panel.boundingBox()
	const contentBox = await content.boundingBox()
	if (!panelBox || !contentBox) throw new Error('The panel is not visible')

	const bottom = Math.min(panelBox.y + panelBox.height, contentBox.y + contentBox.height + 16)
	return {
		page: panel.page(),
		clip: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: bottom - panelBox.y },
	}
}

/**
 * The area covering some cells of the button grid
 * @param page The page
 * @param from The top left cell, as `page/row/column`
 * @param to The bottom right cell, as `page/row/column`
 */
export async function gridClip(page: Page, from: string, to: string): Promise<ShotTarget> {
	const fromBox = await page.getByTitle(from, { exact: true }).boundingBox()
	const toBox = await page.getByTitle(to, { exact: true }).boundingBox()
	if (!fromBox || !toBox) throw new Error('The grid is not visible')

	const margin = 4
	return {
		page,
		clip: {
			x: fromBox.x - margin,
			y: fromBox.y - margin,
			width: toBox.x + toBox.width - fromBox.x + margin * 2,
			height: toBox.y + toBox.height - fromBox.y + margin * 2,
		},
	}
}
