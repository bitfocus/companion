/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import { Image } from './Image.js'
import { ParseAlignment, parseColor } from '../Resources/Util.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ImageResult } from './ImageResult.js'
import type { GraphicsOptions } from './Controller.js'
import type {
	DrawStyleButtonModel,
	DrawStyleButtonStateProps,
	DrawStyleLayeredButtonModel,
	DrawStyleModel,
} from '@companion-app/shared/Model/StyleModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	ButtonGraphicsCanvasLayer,
	ButtonGraphicsDecorationType,
	ButtonGraphicsImageLayer,
	ButtonGraphicsTextLayer,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { assertNever } from '@companion-app/shared/Util.js'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorWhite = 'white'
const colorBlack = 'black'
const colorDarkGrey = 'rgba(15, 15, 15, 1)'

const internalIcons = {
	// 15x8 argb
	cloud:
		'AAAAAAAAAAAAAAAAAAAAAAAAAAAD////D////4L////7//////////D+/v51+/v7A////wAAAAAAAAAAAAAAAAAAA' +
		'AAAAAAAAAAAAAAAAABN////kf///////////v7+//z8/P/5+fn/9vb2RfDw8AAAAAAAAAAAAAAAAAAAAAB7///////////////0/////' +
		'P7+/v/9/f3/+vr6//b29v/y8vL/7e3tf+np6QAAAAAAAAAAAv///xz///+k/////////////////f39//r6+v/39/f/8/Pz/+7u7v/p6' +
		'en/5OTkquDg4DDV1dUC////N////6v////s/v7+//39/f/7+/v/+Pj4//T09P/v7+//6urq/+Xl5f/g4OD/3Nzc8dfX18DS0tJKz8/Pt' +
		'P/////+/v7/+/v7//n5+f/09PT/8PDw/+vr6//m5ub/4eHh/9zc3P/Y2Nj/1NTU/9HR0f/Ozs7HzMzM2Pv7+//5+fn/9fX1//Hx8f/s7' +
		'Oz/5+fn/+Li4v/d3d3/2dnZ/9TU1P/R0dH/z8/P/83Nzf/MzMzGy8vLVvb29u7y8vL/7e3t/+jo6P/j4+P/3t7e/9nZ2f/V1dX/0dHR/' +
		'87Ozv/Nzc3/zMzM/8zMzOHMzMwwysrK',
	// 15x8 argb
	cloudError:
		'AAAAAAAAAAAAAAAAAAAAABj/AACj/wIC7P8BAfX/Cwv+/0xM///m5vD+/v51+/v7A////wAAAAAAAAAAAAAAAAAAA' +
		'AAAAAAAGf8AAMz/AACk/z09kf///////////n5+//8ZGf/54eH/9vb2RfDw8AAAAAAAAAAAAAAAAAAAAAB7//////9bW///g4P0/////' +
		'P7+/v/90tL//i0t//4UFP/6XFz/7e3tf+np6QAAAAAAAAAAAv///xz///+k//////8XF////////f39//ygoP//CAj/+mVl/+/n5//9F' +
		'RX/5OTkquDg4DDV1dUC////N////6v////s/v7+//8XF//77+///FlZ//4QEP/0pKT/6urq/+Xl5f/8FBT/3Nzc8dfX18DS0tJKz8/Pt' +
		'P/////+/v7/+/v7//1OTv/+ERH//DY2/+3Q0P/m5ub/4eHh/+5qav/vWlr/1NTU/9HR0f/Ozs7HzMzM2Pv7+//5+fn/9fX1//PNzf/9G' +
		'Rn/83Z2/+Li4v/d3d3/7G9v//cqKv/Uw8P/z8/P/83Nzf/MzMzGy8vLVvb29u7y8vL/7e3t/+jo6P/mzc3/81NT//wREf/8ERH/8T4+/' +
		'9O7u//Nzc3/zMzM/8zMzOHMzMwwysrK',
}

// let lastDraw = 0

export class GraphicsRenderer {
	/**
	 * Draw the image for an empty button
	 */
	static drawBlank(options: GraphicsOptions, location: ControlLocation): ImageResult {
		// let now = performance.now()
		// console.log('starting drawBlank ' + now, 'time elapsed since last start ' + (now - lastDraw))
		// lastDraw = now
		// console.time('drawBlankImage')
		const img = new Image(72, 72, 2)

		img.fillColor('black')

		if (!options.remove_topbar) {
			img.drawTextLine(2, 3, formatLocation(location), 'rgb(50, 50, 50)', 8)
			img.horizontalLine(13.5, { color: 'rgb(30, 30, 30)' })
		}
		// console.timeEnd('drawBlankImage')
		return new ImageResult(img.buffer(), img.realwidth, img.realheight, img.toDataURLSync(), undefined)
	}

	static wrapDrawButtonImage(
		buffer: Buffer,
		width: number,
		height: number,
		dataUrl: string,
		draw_style: DrawStyleModel['style'] | undefined,
		drawStyle: DrawStyleModel
	): ImageResult {
		const draw_style2 =
			draw_style === 'button' || draw_style === 'button-layered'
				? drawStyle.style === 'button' || drawStyle.style === 'button-layered'
					? drawStyle
					: undefined
				: draw_style

		return new ImageResult(buffer, width, height, dataUrl, draw_style2)
	}

	/**
	 * Draw the image for a btuton
	 */
	static async drawButtonImageUnwrapped(
		options: GraphicsOptions,
		drawStyle: DrawStyleModel,
		location: ControlLocation | undefined,
		pagename: string | undefined
	): Promise<{
		buffer: Buffer
		width: number
		height: number
		dataUrl: string
		draw_style: DrawStyleModel['style'] | undefined
	}> {
		// console.log('starting drawButtonImage '+ performance.now())
		// console.time('drawButtonImage')
		const img = new Image(72, 72, 4)

		let draw_style: DrawStyleModel['style'] | undefined = undefined

		// special button types
		if (drawStyle.style == 'pageup') {
			draw_style = 'pageup'

			img.fillColor(colorDarkGrey)

			if (options.page_plusminus) {
				img.drawTextLine(31, 20, options.page_direction_flipped ? '–' : '+', colorWhite, 18)
			} else {
				img.drawPath(
					[
						[46, 30],
						[36, 20],
						[26, 30],
					],
					{ color: colorWhite, width: 2 }
				) // Arrow up path
			}

			img.drawTextLineAligned(36, 39, 'UP', colorButtonYellow, 10, 'center', 'top')
		} else if (drawStyle.style == 'pagedown') {
			draw_style = 'pagedown'

			img.fillColor(colorDarkGrey)

			if (options.page_plusminus) {
				img.drawTextLine(31, 36, options.page_direction_flipped ? '+' : '–', colorWhite, 18)
			} else {
				img.drawPath(
					[
						[46, 40],
						[36, 50],
						[26, 40],
					],
					{ color: colorWhite, width: 2 }
				) // Arrow down path
			}

			img.drawTextLineAligned(36, 23, 'DOWN', colorButtonYellow, 10, 'center', 'top')
		} else if (drawStyle.style == 'pagenum') {
			draw_style = 'pagenum'

			img.fillColor(colorDarkGrey)

			if (location === undefined) {
				// Preview (no location)
				img.drawTextLineAligned(36, 18, 'PAGE', colorButtonYellow, 10, 'center', 'top')
				img.drawTextLineAligned(36, 32, 'x', colorWhite, 18, 'center', 'top')
			} else if (!pagename || pagename.toLowerCase() == 'page') {
				img.drawTextLine(23, 18, 'PAGE', colorButtonYellow, 10)
				img.drawTextLineAligned(36, 32, '' + location.pageNumber, colorWhite, 18, 'center', 'top')
			} else {
				img.drawAlignedText(0, 0, 72, 72, pagename, colorWhite, 18, 'center', 'center')
			}
		} else if (drawStyle.style === 'button') {
			draw_style = 'button'

			await GraphicsRenderer.#drawButtonMain(img, options, drawStyle, location)
		} else if (drawStyle.style === 'button-layered') {
			draw_style = 'button-layered'

			await GraphicsLayeredButtonRenderer.draw(img, options, drawStyle, location)
		}

		// console.timeEnd('drawButtonImage')
		return {
			buffer: img.buffer(),
			width: img.realwidth,
			height: img.realheight,
			dataUrl: img.toDataURLSync(),
			draw_style,
		}
	}

	/**
	 * Draw the main button
	 */
	static async #drawButtonMain(
		img: Image,
		options: GraphicsOptions,
		drawStyle: DrawStyleButtonModel,
		location: ControlLocation | undefined
	): Promise<void> {
		let showTopbar = !!drawStyle.show_topbar
		if (drawStyle.show_topbar === 'default' || drawStyle.show_topbar === undefined) {
			showTopbar = !options.remove_topbar
		}

		// handle upgrade from pre alignment-support configuration
		if (drawStyle.alignment === undefined) {
			drawStyle.alignment = 'center:center'
		}
		if (drawStyle.pngalignment === undefined) {
			drawStyle.pngalignment = 'center:center'
		}

		// Draw background color first
		!showTopbar
			? img.box(0, 0, 72, 72, parseColor(drawStyle.bgcolor))
			: img.box(0, 14, 72, 72, parseColor(drawStyle.bgcolor))

		// Draw background PNG if exists
		if (drawStyle.png64 !== undefined && drawStyle.png64 !== null) {
			try {
				let png64 = drawStyle.png64.startsWith('data:image/png;base64,') ? drawStyle.png64.slice(22) : drawStyle.png64
				let data = Buffer.from(png64, 'base64')
				const [halign, valign] = ParseAlignment(drawStyle.pngalignment)

				!showTopbar
					? await img.drawFromImageBuffer(data, 0, 0, 72, 72, halign, valign, 'fit_or_shrink')
					: await img.drawFromImageBuffer(data, 0, 14, 72, 58, halign, valign, 'fit_or_shrink')
			} catch (e) {
				console.error('error drawing image:', e)
				img.box(0, 14, 71, 57, 'black')
				!showTopbar
					? img.drawAlignedText(2, 2, 68, 68, 'PNG ERROR', 'red', 10, 'center', 'center')
					: img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', 'red', 10, 'center', 'center')

				GraphicsRenderer.drawTopbar(img, showTopbar, drawStyle, location)
				return
			}
		}

		// Draw images from feedbacks
		try {
			for (const image of drawStyle.imageBuffers || []) {
				if (image.buffer) {
					const yOffset = showTopbar ? 14 : 0

					const x = image.x ?? 0
					const y = yOffset + (image.y ?? 0)
					const width = image.width || 72
					const height = image.height || 72 - yOffset

					img.drawPixelBuffer(x, y, width, height, image.buffer, image.pixelFormat, image.drawScale)
				}
			}
		} catch (e) {
			img.fillColor('black')
			!showTopbar
				? img.drawAlignedText(2, 2, 68, 68, 'IMAGE\\nDRAW\\nERROR', 'red', 10, 'center', 'center')
				: img.drawAlignedText(2, 18, 68, 52, 'IMAGE\\nDRAW\\nERROR', 'red', 10, 'center', 'center')

			GraphicsRenderer.drawTopbar(img, showTopbar, drawStyle, location)
			return
		}

		// Draw button text
		const [halign, valign] = ParseAlignment(drawStyle.alignment)

		let fontSize: 'auto' | number = 'auto'
		if (drawStyle.size == 'small') {
			fontSize = 7 // compatibility with v1 database
		} else if (drawStyle.size == 'large') {
			fontSize = 14 // compatibility with v1 database
		} else {
			fontSize = Number(drawStyle.size) || 'auto'
		}

		if (!showTopbar) {
			img.drawAlignedText(2, 1, 68, 70, drawStyle.text, parseColor(drawStyle.color), fontSize, halign, valign)
		} else {
			img.drawAlignedText(2, 15, 68, 57, drawStyle.text, parseColor(drawStyle.color), fontSize, halign, valign)
		}

		// At last draw Topbar on top
		GraphicsRenderer.drawTopbar(img, showTopbar, drawStyle, location)
	}

	/**
	 * Draw the topbar onto an image for a button
	 */
	static drawTopbar(
		img: Image,
		showTopbar: boolean,
		drawStyle: DrawStyleButtonStateProps,
		location: ControlLocation | undefined
	) {
		if (!showTopbar) {
			if (drawStyle.pushed) {
				img.drawBorder(3, colorButtonYellow)
			}
		} else {
			let step = ''
			img.box(0, 0, 72, 13.5, colorBlack)
			img.horizontalLine(13.5, { color: colorButtonYellow })

			if (typeof drawStyle.step_cycle === 'number' && location) {
				step = `.${drawStyle.step_cycle}`
			}

			if (location === undefined) {
				// Preview (no location)
				img.drawTextLine(4, 2, `x.x${step}`, colorButtonYellow, 9)
			} else if (drawStyle.pushed) {
				img.box(0, 0, 72, 14, colorButtonYellow)
				img.drawTextLine(4, 2, `${formatLocation(location)}${step}`, colorBlack, 9)
			} else {
				img.drawTextLine(4, 2, `${formatLocation(location)}${step}`, colorButtonYellow, 9)
			}
		}

		// Draw status icons from right to left
		let rightMax = 72

		// first the cloud icon if present
		if (drawStyle.cloud_error && showTopbar) {
			img.drawPixelBuffer(rightMax - 17, 3, 15, 8, internalIcons.cloudError)
			rightMax -= 17
		} else if (drawStyle.cloud && showTopbar) {
			img.drawPixelBuffer(rightMax - 17, 3, 15, 8, internalIcons.cloud)
			rightMax -= 17
		}

		// next error or warning icon
		if (location) {
			switch (drawStyle.button_status) {
				case 'error':
					img.box(rightMax - 10, 3, rightMax - 2, 11, 'red')
					rightMax -= 10
					break
				case 'warning':
					img.drawFilledPath(
						[
							[rightMax - 10, 11],
							[rightMax - 2, 11],
							[rightMax - 6, 3],
						],
						'rgb(255, 127, 0)'
					)
					img.drawTextLineAligned(rightMax - 6, 11, '!', colorBlack, 7, 'center', 'bottom')
					rightMax -= 10
					break
			}

			// last running icon
			if (drawStyle.action_running) {
				//img.drawTextLine(55, 3, '►', 'rgb(0, 255, 0)', 8) // not as nice
				let iconcolor = 'rgb(0, 255, 0)'
				if (drawStyle.pushed) iconcolor = colorBlack
				img.drawFilledPath(
					[
						[rightMax - 8, 3],
						[rightMax - 2, 7],
						[rightMax - 8, 11],
					],
					iconcolor
				)
				rightMax -= 8
			}
		}
	}

	/**
	 * Draw pincode entry button for given number
	 * @param num Display number
	 */
	static drawPincodeNumber(num: number): ImageResult {
		const img = new Image(72, 72, 3)
		img.fillColor(colorDarkGrey)
		img.drawTextLineAligned(36, 36, `${num}`, colorWhite, 44, 'center', 'center')
		return new ImageResult(img.buffer(), img.realwidth, img.realheight, img.toDataURLSync(), undefined)
	}

	/**
	 * Draw pincode entry button
	 */
	static drawPincodeEntry(code: string | undefined): ImageResult {
		const img = new Image(72, 72, 4)
		img.fillColor(colorDarkGrey)
		img.drawTextLineAligned(36, 30, 'Lockout', colorButtonYellow, 14, 'center', 'center')
		if (code !== undefined) {
			img.drawAlignedText(0, 15, 72, 72, code.replace(/[a-z0-9]/gi, '*'), colorWhite, 18, 'center', 'center')
		}

		return new ImageResult(img.buffer(), img.realwidth, img.realheight, img.toDataURLSync(), undefined)
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

export class GraphicsLayeredButtonRenderer {
	static async draw(
		img: Image,
		options: GraphicsOptions,
		drawStyle: DrawStyleLayeredButtonModel,
		location: ControlLocation | undefined
	) {
		const backgroundLayer = drawStyle.layers[0].type === 'canvas' ? drawStyle.layers[0] : undefined

		const showTopBar = this.#shouldDrawTopBar(options, backgroundLayer)
		const drawBounds = createDrawBounds(0, showTopBar ? 14 : 0, 72, showTopBar ? 58 : 72)

		this.#drawLayerBackground(img, drawBounds, backgroundLayer)

		for (const layer of drawStyle.layers) {
			try {
				switch (layer.type) {
					case 'canvas':
						// Skip the background layer, it's handled separately
						break
					case 'image':
						await this.#drawLayerImage(img, drawBounds, layer)
						break
					case 'text':
						this.#drawLayerText(img, drawBounds, layer)
						break
					default:
						assertNever(layer)
				}
			} catch (e) {
				// TODO - log/report error where? Or should this abandon the render and do a placeholder?
			}
		}

		GraphicsRenderer.drawTopbar(img, showTopBar, drawStyle, location)
	}

	static #drawLayerBackground(
		img: Image,
		drawBounds: DrawBounds,
		backgroundLayer: ButtonGraphicsCanvasLayer | undefined
	) {
		if (!backgroundLayer) return

		img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY, parseColor(backgroundLayer.color))
	}

	static async #drawLayerImage(img: Image, drawBounds: DrawBounds, layer: ButtonGraphicsImageLayer) {
		if (!layer.base64Image) return

		try {
			const png64 = layer.base64Image.startsWith('data:image/png;base64,')
				? layer.base64Image.slice(22)
				: layer.base64Image
			let data = Buffer.from(png64, 'base64')
			const [halign, valign] = ParseAlignment(layer.alignment || 'center:center')

			await img.drawFromImageBuffer(
				data,
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

	static #drawLayerText(img: Image, drawBounds: DrawBounds, layer: ButtonGraphicsTextLayer) {
		if (!layer.text) return

		// Draw button text
		const fontSize = Number(layer.fontsize) || 'auto'
		const [halign, valign] = ParseAlignment(layer.alignment)

		// Force some padding around the text
		const marginX = 2
		const marginY = 1

		img.drawAlignedText(
			drawBounds.x + marginX,
			drawBounds.y + marginY,
			drawBounds.width - 2 * marginX,
			drawBounds.height - 2 * marginY,
			layer.text,
			parseColor(layer.color),
			fontSize,
			halign,
			valign
		)
	}

	static #shouldDrawTopBar(options: GraphicsOptions, backgroundLayer: ButtonGraphicsCanvasLayer | undefined) {
		const decoration = backgroundLayer?.decoration
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
