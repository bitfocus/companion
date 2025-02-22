import { assertNever } from '../../../../util.js'
import { DEFAULT_FONTS } from '@companion-app/shared/Graphics/Fonts.js'

type ListenerFn = () => void

/**
 * A simple global loader for the fonts needed by the preview canvas
 * Renderers can listen for the font load event to be able to trigger a re-render when the fonts are ready
 */
class PreviewCanvasFontLoader {
	#state: 'pending' | 'loading' | 'loaded' = 'pending'
	#callbacks = new Set<ListenerFn>()

	listenForFontLoad(callback: ListenerFn): 'loaded' | (() => void) {
		switch (this.#state) {
			case 'pending':
				this.#triggerLoad()

				this.#callbacks.add(callback)
				return () => {
					this.#callbacks.delete(callback)
				}
			case 'loading':
				this.#callbacks.add(callback)
				return () => {
					this.#callbacks.delete(callback)
				}
			case 'loaded':
				return 'loaded'
			default:
				assertNever(this.#state)
				console.error('invalid state')
				// Don't know how to handle it, so pretend everything is ok
				return 'loaded'
		}
	}

	#triggerLoad() {
		this.#state = 'loading'

		console.log('FONTS: Loading fonts...')

		Promise.allSettled(
			DEFAULT_FONTS.map(async (name) => {
				const fontface = new FontFace(name, `url(/int/graphics/font/${name})`)
				await fontface.load().catch((e) => {
					console.error('Failed to load font', name, e)
				})

				// Add the font to the document
				document.fonts.add(fontface)
			})
		).then(() => {
			console.log('FONTS: Fonts loaded')

			this.#state = 'loaded'
			this.#callbacks.forEach((cb) => cb())
			this.#callbacks.clear()
		})
	}
}

// Create a singleton instance of the class
export default new PreviewCanvasFontLoader()
