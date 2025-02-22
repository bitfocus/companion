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
import { DrawBounds, ParseAlignment, parseColor, type GraphicsOptions } from './Util.js'
import { TopbarRenderer } from './TopbarRenderer.js'

export class GraphicsLayeredButtonRenderer {
	static async draw(
		img: ImageBase<any>,
		options: GraphicsOptions,
		drawStyle: DrawStyleLayeredButtonModel,
		location: ControlLocation | undefined,
		layersToHide: ReadonlySet<string>
	) {
		const backgroundElement = drawStyle.elements[0].type === 'canvas' ? drawStyle.elements[0] : undefined

		const showTopBar = this.#shouldDrawTopBar(options, backgroundElement)
		const topBarBounds = showTopBar
			? new DrawBounds(0, 0, img.width, Math.max(TopbarRenderer.DEFAULT_HEIGHT, Math.floor(0.2 * img.height)))
			: null
		const topBarHeight = topBarBounds?.height ?? 0
		const drawBounds = new DrawBounds(0, topBarHeight, img.width, img.height - topBarHeight)

		this.#drawBackgroundElement(img, drawBounds, backgroundElement)

		for (const element of drawStyle.elements) {
			// Skip any elements which should be hidden
			if (layersToHide.has(element.id)) continue

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

		TopbarRenderer.draw(img, drawStyle, location, topBarBounds)
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

			const newBounds = drawBounds.compose(element.x, element.y, element.width, element.height)

			await img.drawBase64Image(
				element.base64Image,
				newBounds.x,
				newBounds.y,
				newBounds.width,
				newBounds.height,
				halign,
				valign,
				element.fillMode
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
		let fontSize: 'auto' | number = Number(element.fontsize) || 'auto'
		const [halign, valign] = ParseAlignment(element.alignment)

		const newBounds = drawBounds.compose(element.x, element.y, element.width, element.height)

		// Force some padding around the text
		const marginX = 2
		const marginY = 1

		if (typeof fontSize === 'number') {
			// TODO-layered HACK: temporary scale until new font size scale is implemented
			fontSize *= img.height / 72
		}

		img.drawAlignedText(
			newBounds.x + marginX,
			newBounds.y + marginY,
			newBounds.width - 2 * marginX,
			newBounds.height - 2 * marginY,
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
