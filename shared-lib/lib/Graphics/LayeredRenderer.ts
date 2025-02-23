import { assertNever } from '../Util.js'
import type { ControlLocation } from '../Model/Common.js'
import type { DrawStyleLayeredButtonModel } from '../Model/StyleModel.js'
import type { ImageBase, LineStyle } from './ImageBase.js'
import {
	ButtonGraphicsDecorationType,
	type ButtonGraphicsCanvasDrawElement,
	type ButtonGraphicsImageDrawElement,
	type ButtonGraphicsTextDrawElement,
} from '../Model/StyleLayersModel.js'
import { DrawBounds, ParseAlignment, parseColor, type GraphicsOptions } from './Util.js'
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

		let selectedElementBounds: DrawBounds | null = null

		for (const element of drawStyle.elements) {
			// Skip the background element, it's handled separately
			if (element.type === 'canvas') continue

			const skipDraw = elementsToHide.has(element.id) || !element.enabled

			let elementBounds: DrawBounds | null = null
			try {
				switch (element.type) {
					case 'image':
						elementBounds = await this.#drawImageElement(img, drawBounds, element, skipDraw)
						break
					case 'text':
						elementBounds = this.#drawTextElement(img, drawBounds, element, skipDraw)
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

		TopbarRenderer.draw(img, drawStyle, location, topBarBounds)

		// Draw a border around the selected element, do this last so it's on top
		if (selectedElementBounds) this.#drawBoundsLines(img, selectedElementBounds)
	}

	static #drawBackgroundElement(
		img: ImageBase<any>,
		drawBounds: DrawBounds,
		backgroundElement: ButtonGraphicsCanvasDrawElement | undefined
	) {
		if (!backgroundElement) return

		img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY, parseColor(backgroundElement.color))
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
			const [halign, valign] = ParseAlignment(element.alignment || 'center:center')

			await img.drawBase64Image(
				element.base64Image,
				drawBounds.x,
				drawBounds.y,
				drawBounds.width,
				drawBounds.height,
				halign,
				valign,
				element.fillMode
			)
		} catch (e) {
			console.error('error drawing image:', e)

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
		}

		// if (isSelected) this.#drawBoundsLines(img, newBounds)
		return drawBounds
	}

	static #drawTextElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsTextDrawElement,
		skipDraw: boolean
	): DrawBounds {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw || !element.text) return drawBounds

		// Draw button text
		let fontSize: 'auto' | number = Number(element.fontsize) || 'auto'
		const [halign, valign] = ParseAlignment(element.alignment)

		// Force some padding around the text
		const marginX = 2
		const marginY = 1

		if (typeof fontSize === 'number') {
			// TODO-layered HACK: temporary scale until new font size scale is implemented
			fontSize *= img.height / 72
		}

		img.drawAlignedText(
			drawBounds.x + marginX,
			drawBounds.y + marginY,
			drawBounds.width - 2 * marginX,
			drawBounds.height - 2 * marginY,
			element.text,
			parseColor(element.color),
			fontSize,
			halign,
			valign
		)

		// if (isSelected) this.#drawBoundsLines(img, newBounds)
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
