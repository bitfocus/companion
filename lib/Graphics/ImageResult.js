/**
 * @typedef {import("../Shared/Model/StyleModel.js").DrawStyleButtonModel | 'pagenum' | 'pageup' | 'pagedown'} ImageResultStyle
 */

export class ImageResult {
	/**
	 * Image data-url for socket.io clients
	 * @type {string}
	 * @access private
	 */
	#dataUrl

	/**
	 * Image pixel buffer
	 * @type {Buffer}
	 * @access public
	 * @readonly
	 */
	buffer

	/**
	 * Image pixel buffer width
	 * @type {number}
	 * @access public
	 * @readonly
	 */
	bufferWidth

	/**
	 * Image pixel buffer height
	 * @type {number}
	 * @access public
	 * @readonly
	 */
	bufferHeight

	/**
	 * Image draw style
	 * @type {ImageResultStyle | undefined}
	 * @access public
	 * @readonly
	 */
	style

	/**
	 * @param {Buffer} buffer
	 * @param {number} width
	 * @param {number} height
	 * @param {string} dataUrl
	 * @param {ImageResultStyle | undefined} style
	 */
	constructor(buffer, width, height, dataUrl, style) {
		this.buffer = buffer
		this.bufferWidth = width
		this.bufferHeight = height
		this.#dataUrl = dataUrl
		this.style = style

		this.updated = Date.now()
	}

	/**
	 * Get the image as a data url which can be used by a web base client
	 * @returns {string}
	 */
	get asDataUrl() {
		return this.#dataUrl
	}

	get bgcolor() {
		if (typeof this.style === 'object') {
			return this.style.bgcolor ?? 0
		} else {
			return 0
		}
	}
}
