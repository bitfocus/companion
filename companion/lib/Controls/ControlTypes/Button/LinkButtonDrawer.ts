import debounceFn from 'debounce-fn'
import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { LinkButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonStatus } from '@companion-app/shared/Model/Link.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsBoxElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsImageElement,
	ButtonGraphicsTextDrawElement,
	ButtonGraphicsTextElement,
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage, type DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { PLACEHOLDER_BACKGROUND_COLOR, PLACEHOLDER_TEXT_COLOR } from '../../../Graphics/ConvertGraphicsElements.js'
import { computeElementContentHash } from '../../../Graphics/ConvertGraphicsElements/Util.js'
import type { DisplayedSize } from '../../../Graphics/DisplayedLocations.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import type { CompositeElementIdString } from '../../../Instance/Definitions.js'
import type { LinkButtonImage, LinkButtonState } from '../../../Link/ButtonClient.js'
import { closestShape, isSameShape } from '../../../Link/ButtonSizes.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ButtonSizedDraw, IButtonDrawer } from '../../IButtonDrawer.js'
import { CreateElementOfType } from './LayerDefaults.js'
import { LINK_ICON_SVG, LINK_SLASH_ICON_SVG } from './LinkButtonIcons.js'

/** The placeholder text shown for each status, when there is no remote image to show */
const PLACEHOLDER_TEXT: Record<Exclude<LinkButtonStatus, 'ok'>, string> = {
	unconfigured: 'Remote\nbutton',
	unknown_peer: 'Unknown\nremote',
	incompatible: 'Remote\nincompatible',
	offline: 'Remote\noffline',
	denied: 'Remote\nnot shared',
	over_limit: 'Remote\nbusy',
	loading: 'Loading…',
	loop: '∞',
}

/** The icon above the placeholder text: a link while it has nothing to show yet, broken when it can't be shown */
function placeholderIcon(status: Exclude<LinkButtonStatus, 'ok'>): string {
	return status === 'unconfigured' || status === 'loading' ? LINK_ICON_SVG : LINK_SLASH_ICON_SVG
}

/** Where the icon and the text go in the placeholder, as fractions of the button */
const ICON_BOUNDS = { x: 0.3, y: 0.1, width: 0.4, height: 0.36 }
const TEXT_BOUNDS = { x: 0.04, y: 0.5, width: 0.92, height: 0.44 }

/**
 * A remote button where it can't be connected, eg in the import preview: the placeholder it shows before it has one
 */
export function makeLinkButtonPreviewElements(): SomeButtonGraphicsElement[] {
	const percent = (bounds: typeof ICON_BOUNDS) => ({
		x: exprVal(bounds.x * 100),
		y: exprVal(bounds.y * 100),
		width: exprVal(bounds.width * 100),
		height: exprVal(bounds.height * 100),
	})
	return [
		{
			...(CreateElementOfType('box') as ButtonGraphicsBoxElement),
			color: exprVal(PLACEHOLDER_BACKGROUND_COLOR),
		},
		{
			...(CreateElementOfType('image') as ButtonGraphicsImageElement),
			...percent(ICON_BOUNDS),
			base64Image: exprVal(placeholderIcon('unconfigured')),
		},
		{
			...(CreateElementOfType('text') as ButtonGraphicsTextElement),
			...percent(TEXT_BOUNDS),
			text: exprVal(PLACEHOLDER_TEXT.unconfigured),
			color: exprVal(PLACEHOLDER_TEXT_COLOR),
			weight: exprVal('bold'),
		},
	]
}

/** The placeholder shown when there is no remote image to show: an icon, and why */
function makePlaceholderElements(
	parentId: string,
	status: Exclude<LinkButtonStatus, 'ok'>
): SomeButtonGraphicsDrawElement[] {
	const box: ButtonGraphicsBoxDrawElement = {
		id: `${parentId}:placeholder-bg`,
		type: 'box',
		usage: ButtonGraphicsElementUsage.Automatic,
		enabled: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		color: PLACEHOLDER_BACKGROUND_COLOR,
		cornerRadius: 0,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
		contentHash: '',
	}

	const icon: ButtonGraphicsImageDrawElement = {
		id: `${parentId}:placeholder-icon`,
		type: 'image',
		usage: ButtonGraphicsElementUsage.Automatic,
		enabled: true,
		opacity: 1,
		...ICON_BOUNDS,
		rotation: 0,
		base64Image: placeholderIcon(status),
		halign: 'center',
		valign: 'center',
		fillMode: 'fit',
		contentHash: '',
	}

	const text: ButtonGraphicsTextDrawElement = {
		id: `${parentId}:placeholder-text`,
		type: 'text',
		usage: ButtonGraphicsElementUsage.Automatic,
		enabled: true,
		opacity: 1,
		...TEXT_BOUNDS,
		rotation: 0,
		text: PLACEHOLDER_TEXT[status],
		fontsize: FONTSIZE_SHRINK_DEFAULT,
		fontsizeAllowShrink: true,
		font: 'companion-sans',
		weight: 'bold',
		styles: [],
		color: PLACEHOLDER_TEXT_COLOR,
		outlineColor: 'transparent',
		halign: 'center',
		valign: 'center',
		contentHash: '',
	}

	const elements = [box, icon, text]
	for (const element of elements) element.contentHash = computeElementContentHash(element)
	return elements
}

/** Wait briefly for the image of the remote button at the shape of a size, if it is on its way */
export type LinkButtonWaitForImage = (size: DisplayedSize) => Promise<LinkButtonImage | null>

/**
 * The image to draw at a size: of the newest render, at the closest shape to it
 * @param sameShapeOnly - only an image of the newest render, at the shape of the size
 */
export function pickLinkButtonImage(
	images: readonly LinkButtonImage[],
	size: DisplayedSize,
	sameShapeOnly: boolean
): LinkButtonImage | undefined {
	const current = images.filter((image) => image.current)
	if (sameShapeOnly) return current.find((image) => isSameShape(image, size))

	// A newer image at another shape is better than an older one at this shape
	return closestShape(current.length > 0 ? current : images, size)
}

/**
 * The `drawing` for a link button: shows the image of the remote button, or a placeholder explaining why it can't.
 * The remote button is drawn by its peer at each shape it is shown at, so each size here is drawn from the image of
 * its shape (see getSizedDraw).
 */
export class LinkButtonDrawer implements IButtonDrawer {
	readonly #deps: ControlDependencies
	readonly #controlId: string
	readonly #getState: () => LinkButtonState
	readonly #getOptions: () => LinkButtonModel['options']
	readonly #waitForImage: LinkButtonWaitForImage

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null
	/** The images the last draw style was computed from */
	#lastImages: readonly LinkButtonImage[] = []

	constructor(
		deps: ControlDependencies,
		controlId: string,
		getState: () => LinkButtonState,
		getOptions: () => LinkButtonModel['options'],
		waitForImage: LinkButtonWaitForImage
	) {
		this.#deps = deps
		this.#controlId = controlId
		this.#getState = getState
		this.#getOptions = getOptions
		this.#waitForImage = waitForImage
	}

	dispose(): void {
		this.invalidate.cancel()
	}

	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel> {
		const state = this.#getState()
		const images = state.status === 'ok' ? state.images : []

		// What is drawn at no size in particular, eg where a reference element shows this button: the largest image
		const largest = pickLargestImage(images)
		const canvas = this.#makeCanvas()

		// Decorated here, from the state of the remote button, as for a button of this installation
		const style: DrawStyleLayeredButtonModel = {
			pushed: state.pressed,
			stepCurrent: state.stepCurrent,
			stepCount: state.stepCount,
			button_status: state.buttonStatus,
			action_running: state.actionRunning,
			elements: [
				canvas,
				...(largest
					? [makeRemoteImageElement(this.#controlId, largest.dataUrl)]
					: makePlaceholderElements(this.#controlId, state.status === 'ok' ? 'loading' : state.status)),
			],
			// A cloud in its top bar marks it as a remote button
			link_status: state.status === 'ok' ? (state.unreachable ? 'unreachable' : 'ok') : undefined,
			referencedLocations: undefined,
			style: 'button-layered',
			drawType: 'button',
		}

		this.#lastDrawStyle = style
		this.#lastImages = images
		return style
	}

	getSizedDraw(): ButtonSizedDraw | null {
		const images = this.#lastImages
		if (images.length === 0) return null
		const canvas = this.#makeCanvas()

		return {
			key: images
				.map((image) => `${image.width}x${image.height}@${image.revision.stream}:${image.revision.seq}`)
				.join(),
			elementsAt: async (width, height) => {
				const size = { width, height }
				// Just shown at this shape, so its image may be on its way
				const image =
					pickLinkButtonImage(images, size, true) ??
					(await this.#waitForImage(size)) ??
					pickLinkButtonImage(images, size, false)

				return [
					canvas,
					...(image
						? [makeRemoteImageElement(this.#controlId, image.dataUrl)]
						: makePlaceholderElements(this.#controlId, 'loading')),
				]
			},
		}
	}

	/** How the button is decorated, which is done here rather than by the remote installation */
	#makeCanvas(): ButtonGraphicsCanvasDrawElement {
		const options = this.#getOptions()
		const canvas: ButtonGraphicsCanvasDrawElement = {
			id: `${this.#controlId}:canvas`,
			type: 'canvas',
			usage: ButtonGraphicsElementUsage.Automatic,
			decoration: options.decoration,
			showStatusIcons: options.showStatusIcons,
			contentHash: '',
		}
		canvas.contentHash = computeElementContentHash(canvas)
		return canvas
	}

	getLastDrawStyle(): DrawStyleLayeredButtonModel | null {
		return this.#lastDrawStyle
	}

	resolveDefaultNoTopBar(): boolean {
		return false
	}

	/** The remote image references no variables; the control resolves its location again itself */
	onVariablesChanged(_allChangedVariables: ReadonlySet<string>): void {}

	onCompositeElementsChanged(_allChangedElementIds: ReadonlySet<CompositeElementIdString>): void {}

	onButtonDrawn(_location: ControlLocation, _render: ImageResult): void {}

	invalidate = debounceFn(() => this.#deps.events.emit('invalidateControlRender', this.#controlId), {
		before: false,
		after: true,
		wait: 10,
		maxWait: 20,
	})
}

function pickLargestImage(images: readonly LinkButtonImage[]): LinkButtonImage | undefined {
	let largest: LinkButtonImage | undefined
	for (const image of images) {
		if (!image.current) continue
		if (!largest || image.width * image.height > largest.width * largest.height) largest = image
	}
	return largest
}

/**
 * The remote image fills the content of the button. It is drawn without decoration by the remote installation, so that
 * the decoration (eg the top bar) is drawn here, as it is for any button of this installation
 */
function makeRemoteImageElement(parentId: string, dataUrl: string): ButtonGraphicsImageDrawElement {
	const image: ButtonGraphicsImageDrawElement = {
		id: `${parentId}:remote`,
		type: 'image',
		usage: ButtonGraphicsElementUsage.Automatic,
		enabled: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		base64Image: dataUrl,
		halign: 'center',
		valign: 'center',
		fillMode: 'fit',
		contentHash: '',
	}
	image.contentHash = computeElementContentHash(image)
	return image
}
