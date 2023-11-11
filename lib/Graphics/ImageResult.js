/**
 * @typedef {import("../Data/Model/StyleModel.js").DrawStyleButtonModel | 'pagenum' | 'pageup' | 'pagedown'} ImageResultStyle
 */

export class ImageResult {
	/**
	 * Image data-url for socket.io clients
	 * @type {string | null}
	 * @access private
	 */
	#dataUrl = null

	/**
	 * Image pixel buffer
	 * @type {Buffer}
	 * @access public
	 * @readonly
	 */
	buffer

	/**
	 * Image draw style
	 * @type {ImageResultStyle | undefined}
	 * @access public
	 * @readonly
	 */
	style

	/**
	 * @param {Buffer} buffer
	 * @param {ImageResultStyle | undefined} style
	 */
	constructor(buffer, style) {
		this.buffer = buffer
		this.style = style

		this.updated = Date.now()
	}

	get asDataUrl() {
		if (!this.#dataUrl && this.buffer) {
			const imageSize = Math.sqrt(this.buffer.length / 4)
			const bmpHeader = this.#createBmpHeader(imageSize, imageSize)

			this.#dataUrl = 'data:image/bmp;base64,' + Buffer.concat([bmpHeader, this.buffer]).toString('base64')
		}

		return this.#dataUrl
	}

	/**
	 * Creates a BMP image header for the given size
	 * assuming RGBA channel order, 32Bit/Pixel, starting with top left pixel
	 * @param {number} imageWidth
	 * @param {number} imageHeight
	 * @returns {Buffer} buffer containing the header
	 */
	#createBmpHeader(imageWidth = 72, imageHeight = 72) {
		const dataLength = imageWidth * imageHeight * 4
		const bmpHeaderSize = 138
		const bmpHeader = Buffer.alloc(bmpHeaderSize, 0)
		// file header
		bmpHeader.write('BM', 0, 2) // flag
		bmpHeader.writeUInt32LE(dataLength + bmpHeaderSize, 2) // filesize
		bmpHeader.writeUInt32LE(0, 6) // reserved
		bmpHeader.writeUInt32LE(bmpHeaderSize, 10) // data start
		// image header
		bmpHeader.writeUInt32LE(bmpHeaderSize - 14, 14) // header info size
		bmpHeader.writeUInt32LE(imageWidth, 18) // width
		bmpHeader.writeInt32LE(imageHeight * -1, 22) // height
		bmpHeader.writeUInt16LE(1, 26) // planes
		bmpHeader.writeUInt16LE(32, 28) // bits per pixel
		bmpHeader.writeUInt32LE(3, 30) // compress
		bmpHeader.writeUInt32LE(dataLength, 34) // data size
		bmpHeader.writeUInt32LE(Math.round(39.375 * imageWidth), 38) // hr
		bmpHeader.writeUInt32LE(Math.round(39.375 * imageHeight), 42) // vr
		bmpHeader.writeUInt32LE(0, 46) // colors
		bmpHeader.writeUInt32LE(0, 50) // importantColors
		bmpHeader.writeUInt32LE(0x000000ff, 54) // Red Bitmask
		bmpHeader.writeUInt32LE(0x0000ff00, 58) // Green Bitmask
		bmpHeader.writeUInt32LE(0x00ff0000, 62) // Blue Bitmask
		bmpHeader.writeUInt32LE(0xff000000, 66) // Alpha Bitmask
		bmpHeader.write('BGRs', 70, 4) // colorspace

		return bmpHeader
	}

	get bgcolor() {
		if (typeof this.style === 'object') {
			return this.style.bgcolor ?? 0
		} else {
			return 0
		}
	}
}
