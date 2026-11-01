import debounceFn from 'debounce-fn'
import { formatLocation, type BankControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation, ControlLocationString } from '@companion-app/shared/Model/Common.js'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { makeReferencePlaceholder } from '../../../Graphics/ConvertGraphicsElements.js'
import type { ImageResult } from '../../../Graphics/ImageResult.js'
import type { CompositeElementIdString } from '../../../Instance/Definitions.js'
import LogController, { type Logger } from '../../../Log/Controller.js'
import type { VariableDependency, VariableDependencyListener } from '../../../Variables/DependencyRegistry.js'
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
export class MirrorButtonDrawer implements IButtonDrawer, VariableDependencyListener<null> {
	readonly #logger: Logger
	readonly #deps: ControlDependencies
	readonly #controlId: BankControlId
	readonly #getTargetLocation: () => { location: ControlLocation | null; referencedVariableIds: ReadonlySet<string> }

	/** Locations the last draw depended on, so we know which `button_drawn` events must trigger a redraw. */
	#lastReferencedLocations: ReadonlySet<ControlLocationString> | null = null

	/** Variables the last location-resolution depended on, so a change to any (e.g. `$(page:x)`) redraws us. */
	readonly #locationVariables: VariableDependency<null>

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null

	constructor(
		deps: ControlDependencies,
		controlId: BankControlId,
		getTargetLocation: () => { location: ControlLocation | null; referencedVariableIds: ReadonlySet<string> }
	) {
		this.#logger = LogController.createLogger(`Controls/Button/MirrorDrawer/${controlId}`)
		this.#deps = deps
		this.#controlId = controlId
		this.#getTargetLocation = getTargetLocation
		this.#locationVariables = deps.variableDependencies.create(this, controlId, null)
	}

	dispose(): void {
		// Cancel any redraw still queued so it can't fire after the owning control is gone
		this.invalidate.cancel()
		this.#locationVariables.dispose()
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
		const { location: targetLocation, referencedVariableIds } = this.#getTargetLocation()
		this.#locationVariables.set(referencedVariableIds)

		if (!targetLocation) {
			return this.#storeAndReturn(this.#placeholder('Unresolved\nReference'), null)
		}

		const targetLocationStr = formatLocation(targetLocation)
		const myLocation = this.#deps.pageStore.getLocationOfControlId(this.#controlId)
		const myLocationStr = myLocation ? formatLocation(myLocation) : null

		// Direct self-reference
		if (myLocationStr === targetLocationStr) {
			return this.#storeAndReturn(this.#placeholder('∞'), new Set([targetLocationStr]))
		}

		const targetControlId = this.#deps.pageStore.getControlIdAt(targetLocation)
		const targetStyle = targetControlId
			? this.#deps.controlsAccessor.getControl(targetControlId)?.drawing?.getLastDrawStyle()
			: undefined

		// Not rendered yet (or gone): placeholder until the target's next `button_drawn` redraws us. Reading the
		// cached style (never getDrawStyle) keeps this sync and recursion-free.
		if (!targetStyle) {
			return this.#storeAndReturn(this.#placeholder('Unresolved\nReference'), new Set([targetLocationStr]))
		}

		// Transitive cycle: the target's render references us back
		if (myLocationStr && targetStyle.referencedLocations?.has(myLocationStr)) {
			return this.#storeAndReturn(this.#placeholder('∞'), new Set([targetLocationStr]))
		}

		const referencedLocations = new Set<ControlLocationString>([
			targetLocationStr,
			...(targetStyle.referencedLocations ?? []),
		])

		return this.#storeAndReturn(
			{
				...structuredClone(targetStyle),
				referencedLocations,
			},
			referencedLocations
		)
	}

	#storeAndReturn(
		style: DrawStyleLayeredButtonModel,
		referencedLocations: ReadonlySet<ControlLocationString> | null
	): DrawStyleLayeredButtonModel {
		this.#lastDrawStyle = style
		this.#lastReferencedLocations = referencedLocations
		this.#deps.referencedLocations.setControlReferences(this.#controlId, this.#lastReferencedLocations)
		return style
	}

	getLastDrawStyle(): DrawStyleLayeredButtonModel | null {
		return this.#lastDrawStyle
	}

	// A mirror owns no elements and converts no legacy feedback styles, so its own top-bar state is irrelevant.
	resolveDefaultNoTopBar(): boolean {
		return false
	}

	// A mirror owns no elements, but its `location` field can reference variables (e.g. `$(page:x)`): when one
	// of those changes the mirrored target may change, so redraw. The target's own variables are handled by
	// redrawing off its render (see onButtonDrawn), not here.
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		const locationVariables = this.#locationVariables.variableIds
		if (!locationVariables) return
		if (locationVariables.isDisjointFrom(allChangedVariables)) return

		this.invalidate()
	}
	onVariableDependenciesChanged(_hits: ReadonlyArray<VariableDependency<null>>, changed: ReadonlySet<string>): void {
		this.onVariablesChanged(changed)
	}
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
	onButtonDrawn(location: ControlLocation, _render: ImageResult): void {
		if (!this.#lastReferencedLocations?.has(formatLocation(location))) return

		this.#logger.silly('referenced control rendered')
		this.invalidate()
	}
}
