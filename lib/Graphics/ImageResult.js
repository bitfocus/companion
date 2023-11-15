/**
 * @typedef {import("../Data/Model/StyleModel.js").DrawStyleButtonModel | 'pagenum' | 'pageup' | 'pagedown'} ImageResultStyle
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
	 * Image draw style
	 * @type {ImageResultStyle | undefined}
	 * @access public
	 * @readonly
	 */
	style

	/**
	 * @param {Buffer} buffer
	 * @param {string} dataUrl
	 * @param {ImageResultStyle | undefined} style
	 */
	constructor(buffer, dataUrl, style) {
		this.buffer = buffer
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
