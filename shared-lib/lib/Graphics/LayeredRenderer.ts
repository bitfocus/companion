import { assertNever } from '../Util.js'
import type { ControlLocation } from '../Model/Common.js'
import type { DrawStyleLayeredButtonModel } from '../Model/StyleModel.js'
import type { ImageBase } from './ImageBase.js'
import {
	ButtonGraphicsDecorationType,
	type ButtonGraphicsCanvasDrawElement,
	type ButtonGraphicsImageDrawElement,
	type ButtonGraphicsTextDrawElement,
} from '../Model/StyleLayersModel.js'
import { ParseAlignment, parseColor, type GraphicsOptions } from './Util.js'

export class GraphicsLayeredButtonRenderer {
	static async draw(
		img: ImageBase<any>,
		options: GraphicsOptions,
		drawStyle: DrawStyleLayeredButtonModel,
		location: ControlLocation | undefined
	) {
		const backgroundElement = drawStyle.elements[0].type === 'canvas' ? drawStyle.elements[0] : undefined

		const showTopBar = this.#shouldDrawTopBar(options, backgroundElement)
		const topBarHeight = showTopBar ? 14 : 0
		const drawBounds = createDrawBounds(0, topBarHeight, img.width, img.height - topBarHeight)

		this.#drawBackgroundElement(img, drawBounds, backgroundElement)

		for (const element of drawStyle.elements) {
			try {
				switch (element.type) {
					case 'canvas':
						// Skip the background element, it's handled separately
						break
					case 'image':
						await this.#drawImageElement(img, drawBounds, element)
						break
					case 'text':
						this.#drawTextElement(img, drawBounds, element)
						break
					default:
						assertNever(element)
				}
			} catch (e) {
				// TODO - log/report error where? Or should this abandon the render and do a placeholder?
			}
		}

		// TODO - reenable this
		// GraphicsRenderer.drawTopbar(img, showTopBar, drawStyle, location)
	}

	static #drawBackgroundElement(
		img: ImageBase<any>,
		drawBounds: DrawBounds,
		backgroundElement: ButtonGraphicsCanvasDrawElement | undefined
	) {
		if (!backgroundElement) return

		img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY, parseColor(backgroundElement.color))
	}

	static async #drawImageElement(img: ImageBase<any>, drawBounds: DrawBounds, element: ButtonGraphicsImageDrawElement) {
		if (!element.base64Image) return

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
				'fit_or_shrink'
			)
		} catch (e) {
			console.error('error drawing image:', e)

			// Draw a thick red cross
			img.drawPath(
				[
					[drawBounds.x, drawBounds.y],
					[drawBounds.maxX, drawBounds.maxY],
				],
				{ color: 'red', width: 5 }
			)
			img.drawPath(
				[
					[drawBounds.x, drawBounds.maxY],
					[drawBounds.maxX, drawBounds.y],
				],
				{ color: 'red', width: 5 }
			)
		}
	}

	static #drawTextElement(img: ImageBase<any>, drawBounds: DrawBounds, element: ButtonGraphicsTextDrawElement) {
		if (!element.text) return

		// Draw button text
		const fontSize = Number(element.fontsize) || 'auto'
		const [halign, valign] = ParseAlignment(element.alignment)

		// Force some padding around the text
		const marginX = 2
		const marginY = 1

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
}

interface DrawBounds {
	x: number
	y: number

	width: number
	height: number

	maxX: number
	maxY: number
}

function createDrawBounds(x: number, y: number, width: number, height: number): DrawBounds {
	return {
		x,
		y,
		width,
		height,
		maxX: x + width,
		maxY: y + height,
	}
}
