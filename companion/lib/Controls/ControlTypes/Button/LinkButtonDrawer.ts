import debounceFn from 'debounce-fn'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonStatus } from '@companion-app/shared/Model/Link.js'
import type { ButtonGraphicsImageDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage, type DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { makeReferencePlaceholder } from '../../../Graphics/ConvertGraphicsElements.js'
import { computeElementContentHash } from '../../../Graphics/ConvertGraphicsElements/Util.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import type { CompositeElementIdString } from '../../../Instance/Definitions.js'
import type { LinkButtonState } from '../../../Link/ButtonClient.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { IButtonDrawer } from '../../IButtonDrawer.js'

/** The placeholder text shown for each status, when there is no remote image to show */
const PLACEHOLDER_TEXT: Record<Exclude<LinkButtonStatus, 'ok'>, string> = {
	unconfigured: 'Remote\nbutton',
	unknown_peer: 'Unknown\nremote',
	incompatible: 'Remote\nincompatible',
	offline: 'Remote\noffline',
	loading: 'Loading…',
	loop: '∞',
}

/**
 * The `drawing` for a link button: shows the image of the remote button, or a placeholder explaining why it can't.
 */
export class LinkButtonDrawer implements IButtonDrawer {
	readonly #deps: ControlDependencies
	readonly #controlId: string
	readonly #getState: () => LinkButtonState
	readonly #onVariablesChanged: (allChangedVariables: ReadonlySet<string>) => void

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null

	constructor(
		deps: ControlDependencies,
		controlId: string,
		getState: () => LinkButtonState,
		onVariablesChanged: (allChangedVariables: ReadonlySet<string>) => void
	) {
		this.#deps = deps
		this.#controlId = controlId
		this.#getState = getState
		this.#onVariablesChanged = onVariablesChanged
	}

	dispose(): void {
		this.invalidate.cancel()
	}

	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel> {
		const state = this.#getState()

		const style: DrawStyleLayeredButtonModel = {
			pushed: state.pressed,
			stepCurrent: 0,
			stepCount: 0,
			button_status: undefined,
			action_running: undefined,
			elements:
				state.status === 'ok' && state.dataUrl
					? [makeImageElement(this.#controlId, state.dataUrl)]
					: makeReferencePlaceholder(this.#controlId, state.status === 'ok' ? '' : PLACEHOLDER_TEXT[state.status]),
			referencedLocations: undefined,
			style: 'button-layered',
			drawType: 'button',
		}

		this.#lastDrawStyle = style
		return style
	}

	getLastDrawStyle(): DrawStyleLayeredButtonModel | null {
		return this.#lastDrawStyle
	}

	resolveDefaultNoTopBar(): boolean {
		return false
	}

	/** The location field of the control can reference variables, so it decides what to do */
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		this.#onVariablesChanged(allChangedVariables)
	}

	onCompositeElementsChanged(_allChangedElementIds: ReadonlySet<CompositeElementIdString>): void {}

	onButtonDrawn(_location: ControlLocation, _render: ImageResult): void {}

	invalidate = debounceFn(() => this.#deps.events.emit('invalidateControlRender', this.#controlId), {
		before: false,
		after: true,
		wait: 10,
		maxWait: 20,
	})
}

function makeImageElement(parentId: string, dataUrl: string): ButtonGraphicsImageDrawElement {
	const element: ButtonGraphicsImageDrawElement = {
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
	element.contentHash = computeElementContentHash(element)
	return element
}
