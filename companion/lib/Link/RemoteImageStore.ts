import type { PixelSize, RemoteImage, RemoteImageSource } from '../Graphics/ImageCache/ImageCacheStore.js'
import { closestShape, isSameShape } from './ButtonSizes.js'
import type { LinkButtonRevision } from './Protocol/v1/Schemas.js'

/** An image of a remote button, at one of the sizes it is subscribed to */
export interface LinkButtonImage {
	width: number
	height: number
	dataUrl: string
	revision: LinkButtonRevision
	/** Whether it is of the newest render of the button, rather than one from before it at a size yet to catch up */
	current: boolean
}

/** A shape of a remote button that has just been subscribed to, whose first image is on its way */
interface ExpectedShape {
	readonly size: PixelSize
	/** Until when a draw waits for it */
	readonly until: number
	readonly waiters: Set<(image: LinkButtonImage | null) => void>
}

interface RemoteButtonImages {
	/** What the link buttons showing it are shown */
	images: readonly LinkButtonImage[]
	readonly expected: ExpectedShape[]
}

/**
 * The images of the remote buttons that link buttons show, for drawing them: their remote elements are fetched from
 * here, at the size they are drawn at. The link client keeps it up to date.
 *
 * A remote button is subscribed to at each shape it is shown at. Drawing it at a shape that has only just been
 * subscribed to waits briefly for that shape's first image, rather than flashing another shape first.
 */
export class LinkRemoteImageStore implements RemoteImageSource {
	/** By the key of the remote button (the `source` of its remote elements) */
	readonly #buttons = new Map<string, RemoteButtonImages>()

	#get(key: string): RemoteButtonImages {
		let button = this.#buttons.get(key)
		if (!button) {
			button = { images: [], expected: [] }
			this.#buttons.set(key, button)
		}
		return button
	}

	/** Set the images of a remote button that the link buttons showing it are shown */
	setImages(key: string, images: readonly LinkButtonImage[]): void {
		this.#get(key).images = images
	}

	/**
	 * A remote button has just been subscribed to at a shape, so its first image is on its way
	 * @param until - until when a draw at that shape waits for it
	 */
	expectShape(key: string, size: PixelSize, until: number): void {
		const button = this.#get(key)
		const existing = button.expected.find((shape) => isSameSize(shape.size, size))
		// One that was given up on is replaced, as this is a new subscription to it
		if (existing && existing.until > Date.now()) return
		if (existing) this.shapeArrived(key, existing.size, null)
		button.expected.push({ size, until, waiters: new Set() })
	}

	/**
	 * The first image of a shape has arrived, or won't (eg it was refused): stop waiting for it. Only for that exact
	 * size, so that letting go of one size doesn't end the wait for another of the same shape
	 */
	shapeArrived(key: string, size: PixelSize, image: LinkButtonImage | null): void {
		const button = this.#buttons.get(key)
		if (!button) return

		const index = button.expected.findIndex((shape) => isSameSize(shape.size, size))
		if (index === -1) return

		const [shape] = button.expected.splice(index, 1)
		for (const done of shape.waiters) done(image)
	}

	/** A remote button is no longer shown */
	delete(key: string): void {
		const button = this.#buttons.get(key)
		if (!button) return

		this.#buttons.delete(key)
		for (const shape of button.expected) for (const done of shape.waiters) done(null)
	}

	clear(): void {
		for (const key of Array.from(this.#buttons.keys())) this.delete(key)
	}

	/**
	 * The image to draw a remote button at a size: of the newest render at that shape, waiting briefly for it when that
	 * shape has just been subscribed to. Otherwise the newest image of the closest shape
	 * @param key - the remote button
	 * @param size - of the content of the button, which the image is drawn in
	 * @param wait - whether to wait for a shape just subscribed to (see above)
	 */
	async getImage(key: string, size: PixelSize, wait: boolean): Promise<RemoteImage | null> {
		const button = this.#buttons.get(key)
		if (!button) return null

		let image: LinkButtonImage | null | undefined =
			pickImage(button.images, size, true) ?? (wait ? await this.#waitForShape(button, size) : null)
		// It may no longer be shown, once done waiting
		if (this.#buttons.get(key) !== button) return null
		image ??= pickImage(button.images, size, false)
		if (!image) return null

		// Identified by its button, size and revision, so that the image data is never compared
		return {
			slot: `${key}@${image.width}x${image.height}`,
			revision: `${image.revision.stream}:${image.revision.seq}`,
			dataUrl: image.dataUrl,
		}
	}

	async #waitForShape(button: RemoteButtonImages, size: PixelSize): Promise<LinkButtonImage | null> {
		const shape = button.expected.find((shape) => isSameShape(shape.size, size))
		const waitMs = shape ? shape.until - Date.now() : 0
		if (!shape || waitMs <= 0) return null

		return new Promise((resolve) => {
			const done = (image: LinkButtonImage | null) => {
				clearTimeout(timer)
				shape.waiters.delete(done)
				resolve(image)
			}
			const timer = setTimeout(() => done(null), waitMs)
			shape.waiters.add(done)
		})
	}
}

/**
 * The image to draw at a size: of the newest render, at the closest shape to it
 * @param sameShapeOnly - only an image of the newest render, at the shape of the size
 */
function pickImage(
	images: readonly LinkButtonImage[],
	size: PixelSize,
	sameShapeOnly: boolean
): LinkButtonImage | undefined {
	// The largest of each shape first, eg while a shape is held at a size it has grown from as well as the new one
	const largestFirst = images.toSorted((a, b) => b.width * b.height - a.width * a.height)
	const current = largestFirst.filter((image) => image.current)
	if (sameShapeOnly) return current.find((image) => isSameShape(image, size))

	// A newer image at another shape is better than an older one at this shape
	return closestShape(current.length > 0 ? current : largestFirst, size)
}

function isSameSize(a: PixelSize, b: PixelSize): boolean {
	return a.width === b.width && a.height === b.height
}
