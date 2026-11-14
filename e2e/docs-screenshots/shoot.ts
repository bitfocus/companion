import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect } from '../support/fixtures.js'

const THEMES = ['light', 'dark'] as const

/** Hides what changes from one build to the next, so that an image is only rewritten when the ui changed */
const SCREENSHOT_STYLE = path.join(import.meta.dirname, 'screenshot.css')

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
			await expect(target.page).toHaveScreenshot(segments, { clip: target.clip, stylePath: SCREENSHOT_STYLE })
		} else {
			await expect(target).toHaveScreenshot(segments, { stylePath: SCREENSHOT_STYLE })
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
 * The area of a panel down to the end of what it shows, rather than the full height of the panel
 * @param panel The panel, which may fill the height of the page
 * @param margin Space to leave below its content
 */
export async function contentClip(panel: Locator, margin = 16): Promise<ShotTarget> {
	const panelBox = await panel.boundingBox()
	if (!panelBox) throw new Error('The panel is not visible')

	// The bottom of the lowest of the elements which show something, ignoring any which only fill the space left
	const contentBottom = await panel.evaluate((element) => {
		const panelRect = element.getBoundingClientRect()
		let bottom = panelRect.top
		for (const child of element.querySelectorAll('*')) {
			if (child.children.length > 0 && !['BUTTON', 'svg', 'SELECT', 'LABEL'].includes(child.tagName)) continue
			const rect = child.getBoundingClientRect()
			if (rect.width === 0 || rect.height === 0 || rect.bottom > panelRect.bottom || rect.top < panelRect.top) continue
			bottom = Math.max(bottom, rect.bottom)
		}
		return bottom
	})

	const bottom = Math.min(panelBox.y + panelBox.height, contentBottom + margin)
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

/**
 * Run some steps with the window at another size, eg to take a screenshot of the whole window at a typical size
 * rather than the tall one the screenshots of edit panels need
 */
export async function withViewport(
	page: Page,
	size: { width: number; height: number },
	steps: () => Promise<void>
): Promise<void> {
	const viewport = page.viewportSize()
	if (!viewport) throw new Error('The page has no viewport')

	await page.setViewportSize(size)
	try {
		await steps()
	} finally {
		await page.setViewportSize(viewport)
	}
}

/**
 * The area covering some elements, eg a menu and the button which opened it
 * @param page The page
 * @param elements The elements to cover
 * @param margin Space to leave around them
 */
export async function unionClip(page: Page, elements: Locator[], margin = 8): Promise<ShotTarget> {
	const boxes = await Promise.all(elements.map(async (element) => element.boundingBox()))
	if (boxes.some((box) => !box)) throw new Error('An element is not visible')
	const visible = boxes.filter((box) => !!box)

	const left = Math.max(0, Math.min(...visible.map((box) => box.x)) - margin)
	const top = Math.max(0, Math.min(...visible.map((box) => box.y)) - margin)
	const right = Math.max(...visible.map((box) => box.x + box.width)) + margin
	const bottom = Math.max(...visible.map((box) => box.y + box.height)) + margin
	return { page, clip: { x: left, y: top, width: right - left, height: bottom - top } }
}
