import { assertNever } from '../Util.js'
import type { ControlLocation } from '../Model/Common.js'
import type { DrawStyleLayeredButtonModel } from '../Model/StyleModel.js'
import type { ImageBase, LineStyle } from './ImageBase.js'
import {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsDecorationType,
	ButtonGraphicsGroupDrawElement,
	SomeButtonGraphicsDrawElement,
	type ButtonGraphicsCanvasDrawElement,
	type ButtonGraphicsImageDrawElement,
	type ButtonGraphicsTextDrawElement,
} from '../Model/StyleLayersModel.js'
import { DrawBounds, parseColor, type GraphicsOptions } from './Util.js'
import { TopbarRenderer } from './TopbarRenderer.js'

export class GraphicsLayeredButtonRenderer {
	static async draw(
		img: ImageBase<any>,
		options: GraphicsOptions,
		drawStyle: DrawStyleLayeredButtonModel,
		location: ControlLocation | undefined,
		elementsToHide: ReadonlySet<string>,
		selectedElementId: string | null,
		paddingPx: { x: number; y: number }
	) {
		const backgroundElement = drawStyle.elements[0].type === 'canvas' ? drawStyle.elements[0] : undefined

		const drawWidth = img.width - paddingPx.x * 2
		const drawHeight = img.height - paddingPx.y * 2

		const showTopBar = this.#shouldDrawTopBar(options, backgroundElement)
		const topBarBounds = showTopBar
			? new DrawBounds(
					paddingPx.x,
					paddingPx.y,
					drawWidth,
					Math.max(TopbarRenderer.DEFAULT_HEIGHT, Math.floor(0.2 * img.height))
				)
			: null
		const topBarHeight = topBarBounds?.height ?? 0
		const drawBounds = new DrawBounds(paddingPx.x, paddingPx.y + topBarHeight, drawWidth, drawHeight - topBarHeight)

		this.#drawBackgroundElement(img, drawBounds, backgroundElement)

		const selectedElementBounds = await this.#drawElements(
			img,
			drawStyle.elements,
			elementsToHide,
			selectedElementId,
			drawBounds,
			drawBounds,
			false
		)

		TopbarRenderer.draw(img, drawStyle, location, topBarBounds)

		// Draw a border around the selected element, do this last so it's on top
		if (selectedElementBounds) this.#drawBoundsLines(img, selectedElementBounds)
	}

	static async #drawElements(
		img: ImageBase<any>,
		elements: SomeButtonGraphicsDrawElement[],
		elementsToHide: ReadonlySet<string>,
		selectedElementId: string | null,
		rootBounds: DrawBounds,
		drawBounds: DrawBounds,
		skipDrawParent: boolean
	): Promise<DrawBounds | null> {
		let selectedElementBounds: DrawBounds | null = null
		for (const element of elements) {
			// Skip the background element, it's handled separately
			if (element.type === 'canvas') continue

			const skipDraw = skipDrawParent || elementsToHide.has(element.id) || !element.enabled

			let elementBounds: DrawBounds | null = null
			try {
				// const tmpImage =
				switch (element.type) {
					case 'group': {
						await img.usingTemporaryLayer(element.opacity / 100, async (img) => {
							elementBounds = await this.#drawGroupElement(img, drawBounds, element, skipDraw)

							// Propogte the selected
							const childElementBounds = await this.#drawElements(
								img,
								element.children,
								elementsToHide,
								selectedElementId,
								rootBounds,
								elementBounds,
								skipDraw
							)
							if (childElementBounds) selectedElementBounds = childElementBounds
						})
						break
					}
					case 'image':
						elementBounds = await this.#drawImageElement(img, drawBounds, element, skipDraw)

						break
					case 'text':
						elementBounds = await this.#drawTextElement(img, rootBounds, drawBounds, element, skipDraw)
						break
					case 'box':
						elementBounds = await this.#drawBoxElement(img, drawBounds, element, skipDraw)
						break
					default:
						assertNever(element)
				}
			} catch (e) {
				// TODO - log/report error where? Or should this abandon the render and do a placeholder?
			}

			// Find the bounds of the selected element
			if (element.id === selectedElementId) selectedElementBounds = elementBounds
		}

		return selectedElementBounds
	}

	static #drawBackgroundElement(
		_img: ImageBase<any>,
		_drawBounds: DrawBounds,
		backgroundElement: ButtonGraphicsCanvasDrawElement | undefined
	) {
		if (!backgroundElement) return

		// img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY, parseColor(backgroundElement.color))
	}

	static async #drawGroupElement(
		_img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsGroupDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw) return drawBounds

		return drawBounds
	}

	static async #drawImageElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsImageDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw || !element.base64Image) return drawBounds

		try {
			const imageData = element.base64Image

			await img.usingAlpha(element.opacity / 100, async () => {
				await img.drawBase64Image(
					imageData,
					drawBounds.x,
					drawBounds.y,
					drawBounds.width,
					drawBounds.height,
					element.halign,
					element.valign,
					element.fillMode
				)
			})
		} catch (e) {
			console.error('error drawing image:', e)

			await img.usingTemporaryLayer(element.opacity / 100, async (img) => {
				// Draw a thick red cross
				img.drawPath(
					[
						[parentBounds.x, parentBounds.y],
						[parentBounds.maxX, parentBounds.maxY],
					],
					{ color: 'red', width: 5 }
				)
				img.drawPath(
					[
						[parentBounds.x, parentBounds.maxY],
						[parentBounds.maxX, parentBounds.y],
					],
					{ color: 'red', width: 5 }
				)
			})
		}

		// if (isSelected) this.#drawBoundsLines(img, newBounds)
		return drawBounds
	}

	static async #drawTextElement(
		img: ImageBase<any>,
		rootBounds: DrawBounds,
		parentBounds: DrawBounds,
		element: ButtonGraphicsTextDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw || !element.text) return drawBounds

		// Draw button text
		let fontSize: 'auto' | number = Number(element.fontsize) || 'auto'

		// Force some padding around the text
		const marginX = 2
		const marginY = 1

		if (typeof fontSize === 'number') {
			// Scale font to be a percentage relative to the height of the usable button space
			// Future: should this be relative to the bounds of the text element?
			fontSize *= rootBounds.height / 100 / 1.2
		}

		await img.usingAlpha(element.opacity / 100, async () => {
			img.drawAlignedText(
				drawBounds.x + marginX,
				drawBounds.y + marginY,
				drawBounds.width - 2 * marginX,
				drawBounds.height - 2 * marginY,
				element.text,
				parseColor(element.color),
				fontSize,
				element.halign,
				element.valign
			)
		})

		// if (isSelected) this.#drawBoundsLines(img, newBounds)
		return drawBounds
	}

	static async #drawBoxElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsBoxDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw) return drawBounds

		await img.usingAlpha(element.opacity / 100, async () => {
			img.box(parentBounds.x, parentBounds.y, parentBounds.maxX, parentBounds.maxY, parseColor(element.color))
		})

		return drawBounds
	}

	static #shouldDrawTopBar(options: GraphicsOptions, backgroundElement: ButtonGraphicsCanvasDrawElement | undefined) {
		const decoration = backgroundElement?.decoration
		switch (decoration) {
			case ButtonGraphicsDecorationType.Border:
				return false
			case ButtonGraphicsDecorationType.TopBar:
				return true
			case ButtonGraphicsDecorationType.FollowDefault:
			case undefined:
				return !options.remove_topbar
			default:
				assertNever(decoration)
				return !options.remove_topbar
		}
	}

	static #drawBoundsLines(img: ImageBase<any>, bounds: DrawBounds) {
		const lineStyle: LineStyle = { color: 'rgb(255, 0, 0)', width: 1 } // TODO - what colour is best?

		img.horizontalLine(bounds.y, lineStyle)
		img.horizontalLine(bounds.maxY, lineStyle)

		img.verticalLine(bounds.x, lineStyle)
		img.verticalLine(bounds.maxX, lineStyle)
	}
}
