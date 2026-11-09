import type { PixelSize, RemoteImage, RemoteImageSource } from '../Graphics/ImageCache/ImageCacheStore.js'
import { closestShape } from './ButtonSizes.js'
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
 * A remote button is subscribed to at each size it is shown at, so that each is drawn at its own resolution. Drawing it
 * at a size that has only just been subscribed to waits briefly for that size's first image, rather than flashing one
 * scaled from another size first.
 */
export class LinkRemoteImageStore implements RemoteImageSource {
	/** By the key of the remote button (the `source` of its remote elements) */
	readonly #buttons = new Map<string, RemoteButtonImages>()
	readonly #releasedListeners: ((slots: readonly string[]) => void)[] = []

	onReleased(listener: (slots: readonly string[]) => void): void {
		this.#releasedListeners.push(listener)
	}

	/** Tell the listeners of the slots of a remote button that are no longer held */
	#release(key: string, before: readonly LinkButtonImage[], after: readonly LinkButtonImage[]): void {
		const held = new Set(after.map((image) => slotOf(key, image)))
		const released = before.map((image) => slotOf(key, image)).filter((slot) => !held.has(slot))
		if (released.length === 0) return
		for (const listener of this.#releasedListeners) listener(released)
	}

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
		const button = this.#get(key)
		const before = button.images
		button.images = images
		this.#release(key, before, images)
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
		this.#release(key, button.images, [])
	}

	clear(): void {
		for (const key of Array.from(this.#buttons.keys())) this.delete(key)
	}

	/**
	 * The image to draw a remote button at a size: of the newest render at that size, waiting briefly for it when that
	 * size has just been subscribed to. Otherwise the newest image of the closest shape, to be scaled until it arrives
	 * @param key - the remote button
	 * @param size - of the content of the button, which the image is drawn in
	 * @param wait - whether to wait for a size just subscribed to (see above)
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
			slot: slotOf(key, image),
			revision: `${image.revision.stream}:${image.revision.seq}`,
			dataUrl: image.dataUrl,
		}
	}

	async #waitForShape(button: RemoteButtonImages, size: PixelSize): Promise<LinkButtonImage | null> {
		const shape = button.expected.find((shape) => isSameSize(shape.size, size))
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
 * The image to draw at a size: of the newest render, at that size or else the closest shape to it
 * @param exactOnly - only an image of the newest render, at the size itself
 */
function pickImage(
	images: readonly LinkButtonImage[],
	size: PixelSize,
	exactOnly: boolean
): LinkButtonImage | undefined {
	// The largest of each shape first, as the least scaled when drawn smaller
	const largestFirst = images.toSorted((a, b) => b.width * b.height - a.width * a.height)
	const current = largestFirst.filter((image) => image.current)
	if (exactOnly) return current.find((image) => isSameSize(image, size))

	// A newer image at another shape is better than an older one at this shape
	return closestShape(current.length > 0 ? current : largestFirst, size)
}

/** Which image of a remote button this is: the button at a size, of whichever revision */
function slotOf(key: string, image: PixelSize): string {
	return `${key}@${image.width}x${image.height}`
}

function isSameSize(a: PixelSize, b: PixelSize): boolean {
	return a.width === b.width && a.height === b.height
}
