/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>, Dorian Meid <meid@backstage.org>
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

import { Canvas, ImageData, Image as CanvasImage, loadImage, SKRSContext2D } from '@napi-rs/canvas'
import LogController from '../Log/Controller.js'
import { ImageBase, LineStyle } from '@companion-app/shared/Graphics/ImageBase.js'

export { LineStyle }

/**
 * Class for generating an image and rendering some content to it
 */
export class Image extends ImageBase<CanvasImage | Canvas> {
	readonly #canvas: Canvas
	readonly #context2d: SKRSContext2D

	readonly realwidth: number
	readonly realheight: number

	private constructor(
		canvas: Canvas,
		context2d: SKRSContext2D,
		width: number,
		height: number,
		realwidth: number,
		realheight: number
	) {
		super(LogController.createLogger('Graphics/Image'), context2d, width, height)

		this.#canvas = canvas
		this.#context2d = context2d

		this.realwidth = realwidth
		this.realheight = realheight
	}

	static create(width: number, height: number, oversampling: number): Image {
		if (oversampling === undefined) oversampling = 1

		const realwidth = width * oversampling
		const realheight = height * oversampling

		const canvas = new Canvas(realwidth, realheight)
		const context2d = canvas.getContext('2d')
		context2d.scale(oversampling, oversampling)
		context2d.textWrap = false

		return new Image(canvas, context2d, width, height, realwidth, realheight)
	}

	protected drawImage(
		image: CanvasImage | Canvas,
		sx: number,
		sy: number,
		sw: number,
		sh: number,
		dx: number,
		dy: number,
		dw: number,
		dh: number
	): void {
		this.#context2d.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
	}

	protected async loadBase64Image(base64Image: string): Promise<CanvasImage> {
		const png64 = base64Image.startsWith('data:image/png;base64,') ? base64Image.slice(22) : base64Image
		return loadImage(Buffer.from(png64, 'base64'))
	}

	protected loadPixelBuffer(data: Uint8Array, width: number, height: number): CanvasImage | Canvas | null {
		let imageData: ImageData
		try {
			imageData = new ImageData(new Uint8ClampedArray(data), width, height)
		} catch (error: any) {
			this.logger.error(`Can't draw pixel buffer, creating ImageData from buffer failed: ` + error.stack)
			return null
		}

		// createImageBitmap() works async, so this intermediate canvas is a synchronous workaround
		const imageCanvas = new Canvas(imageData.width, imageData.height)
		const imageContext2d = imageCanvas.getContext('2d')
		imageContext2d.putImageData(imageData, 0, 0)

		return imageCanvas
	}

	/**
	 * returns the pixels of the image in a buffer
	 * color order is RGBA
	 * @returns RGBA buffer of the pixels
	 */
	buffer(): Buffer {
		const buffer = Buffer.from(this.#context2d.getImageData(0, 0, this.realwidth, this.realheight).data)
		return buffer
	}

	// /**
	//  * returns the image as a data-url
	//  */
	// toDataURL(): Promise<string> {
	// 	return this.canvas.toDataURLAsync('image/png')
	// }

	/**
	 * returns the image as a data-url
	 */
	toDataURLSync(): string {
		return this.#canvas.toDataURL('image/png')
	}
}
