import debounceFn from 'debounce-fn'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { makeReferencePlaceholder } from '../../../Graphics/ConvertGraphicsElements.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import type { CompositeElementIdString } from '../../../Instance/Definitions.js'
import LogController, { type Logger } from '../../../Log/Controller.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { IButtonDrawer } from '../../IButtonDrawer.js'

const emptyStateProps = {
	pushed: false,
	stepCurrent: 0,
	stepCount: 0,
	button_status: undefined,
	action_running: undefined,
} as const

/**
 * The `drawing` for a button-reference control: owns no elements, but mirrors the target button's whole draw
 * style and redraws when the target renders. Reference cycles resolve to a placeholder.
 */
export class MirrorButtonDrawer implements IButtonDrawer {
	readonly #logger: Logger
	readonly #deps: ControlDependencies
	readonly #controlId: string
	readonly #getTargetLocation: () => ControlLocation | null

	/** Locations the last draw depended on, so we know which `button_drawn` events must trigger a redraw. */
	#lastReferencedLocations: ReadonlySet<string> | null = null

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null

	constructor(deps: ControlDependencies, controlId: string, getTargetLocation: () => ControlLocation | null) {
		this.#logger = LogController.createLogger(`Controls/Button/MirrorDrawer/${controlId}`)
		this.#deps = deps
		this.#controlId = controlId
		this.#getTargetLocation = getTargetLocation

		this.#deps.graphics.on('button_drawn', this.#onReferencedButtonDrawn)
	}

	dispose(): void {
		this.#deps.graphics.off('button_drawn', this.#onReferencedButtonDrawn)
	}

	#placeholder(text: string): DrawStyleLayeredButtonModel {
		return {
			...emptyStateProps,
			elements: makeReferencePlaceholder('reference', text),
			referencedLocations: undefined,
			style: 'button-layered',
			drawType: 'button',
		}
	}

	async getDrawStyle(): Promise<DrawStyleLayeredButtonModel> {
		const targetLocation = this.#getTargetLocation()
		if (!targetLocation) {
			this.#lastReferencedLocations = null
			return this.#storeAndReturn(this.#placeholder('Unresolved\nReference'))
		}

		const targetLocationStr = formatLocation(targetLocation)
		const myLocation = this.#deps.pageStore.getLocationOfControlId(this.#controlId)
		const myLocationStr = myLocation ? formatLocation(myLocation) : null

		// Direct self-reference
		if (myLocationStr === targetLocationStr) {
			this.#lastReferencedLocations = new Set([targetLocationStr])
			return this.#storeAndReturn(this.#placeholder('∞'))
		}

		const targetControlId = this.#deps.pageStore.getControlIdAt(targetLocation)
		const targetStyle = targetControlId
			? this.#deps.controlsAccessor.getControl(targetControlId)?.drawing?.getLastDrawStyle()
			: undefined

		// Not rendered yet (or gone): placeholder until the target's next `button_drawn` redraws us. Reading the
		// cached style (never getDrawStyle) keeps this sync and recursion-free.
		if (!targetStyle) {
			this.#lastReferencedLocations = new Set([targetLocationStr])
			return this.#storeAndReturn(this.#placeholder('Unresolved\nReference'))
		}

		// Transitive cycle: the target's render references us back
		if (myLocationStr && targetStyle.referencedLocations?.has(myLocationStr)) {
			this.#lastReferencedLocations = new Set([targetLocationStr])
			return this.#storeAndReturn(this.#placeholder('∞'))
		}

		const referencedLocations = new Set<string>([targetLocationStr, ...(targetStyle.referencedLocations ?? [])])
		this.#lastReferencedLocations = referencedLocations

		return this.#storeAndReturn({
			...structuredClone(targetStyle),
			referencedLocations,
		})
	}

	#storeAndReturn(style: DrawStyleLayeredButtonModel): DrawStyleLayeredButtonModel {
		this.#lastDrawStyle = style
		return style
	}

	getLastDrawStyle(): DrawStyleLayeredButtonModel | null {
		return this.#lastDrawStyle
	}

	// A mirror owns no variables/elements; it redraws off the target's render instead.
	onVariablesChanged(_allChangedVariables: ReadonlySet<string>): void {}
	onCompositeElementsChanged(_allChangedElementIds: ReadonlySet<CompositeElementIdString>): void {}

	invalidate = debounceFn(
		() => {
			if (this.#pendingDraw) return
			this.#pendingDraw = true
			setImmediate(() => {
				this.#deps.events.emit('invalidateControlRender', this.#controlId)
				this.#pendingDraw = false
			})
		},
		{ before: false, after: true, wait: 10, maxWait: 20 }
	)
	#pendingDraw = false

	/** Redraw when a location our last draw referenced finishes rendering. */
	#onReferencedButtonDrawn = (location: ControlLocation, _render: ImageResult): void => {
		if (!this.#lastReferencedLocations?.has(formatLocation(location))) return

		this.#logger.silly('referenced control rendered')
		this.invalidate()
	}
}
