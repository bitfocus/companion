import type { JsonValue } from 'type-fest'
import type {
	ButtonReferenceButtonModel,
	LayeredButtonModel,
	SomeButtonModel,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { exprVal, isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { ParseLocationString } from '../../../Internal/Util.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import {
	mangleReferenceSurfaceId,
	MAX_REFERENCE_DEPTH,
	referenceSurfaceIdDepth,
} from '../../../Surface/ReferenceSurfaceId.js'
import { ControlBase } from '../../ControlBase.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type {
	ControlWithConvert,
	ControlWithOptions,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutEntities,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutPushed,
} from '../../IControlFragments.js'
import { ControlButtonLayered } from './Layered.js'
import { MirrorButtonDrawer } from './MirrorButtonDrawer.js'

/**
 * A button that mirrors another button at a grid location: it renders the target's full draw output (via
 * {@link MirrorButtonDrawer}) and forwards presses/rotation to it. The only editable field is the `location`.
 * Presses forward with a mangled surfaceId (see {@link mangleReferenceSurfaceId}); 'Edit' snapshots the target
 * into a normal `button-layered` control via {@link convertControl}.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 5.1.0
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlButtonReference
	extends ControlBase<ButtonReferenceButtonModel>
	implements
		ControlWithoutLayeredStyle,
		ControlWithoutEntities,
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithOptions,
		ControlWithoutPushed,
		ControlWithConvert
{
	readonly type = 'button-reference'

	readonly supportsActions = false
	readonly supportsActionSets = false
	readonly supportsConvert = true
	readonly supportsEntities = false
	readonly supportsEvents = false
	readonly supportsLayeredStyle = false
	readonly supportsOptions = true
	readonly supportsPushed = false

	options: ButtonReferenceButtonModel['options']

	readonly #drawing: MirrorButtonDrawer
	override get drawing(): MirrorButtonDrawer {
		return this.#drawing
	}

	protected triggerInvalidation = (): void => {
		this.#drawing.invalidate()
	}

	constructor(
		deps: ControlDependencies,
		controlId: string,
		storage: ButtonReferenceButtonModel | null,
		isImport: boolean
	) {
		super(deps, controlId, 'Controls/Button/Reference')

		this.options = { location: exprVal('') }

		this.#drawing = new MirrorButtonDrawer(deps, controlId, () => this.#resolveTargetLocation())

		if (!storage) {
			// New control
			this.commitChange()
		} else {
			if (storage.type !== 'button-reference')
				throw new Error(`Invalid type given to ControlButtonReference: "${storage.type}"`)

			this.options = { location: storage.options.location, notes: storage.options.notes }

			if (isImport) this.commitChange()
		}
	}

	destroy(): void {
		this.#drawing.dispose()
		super.destroy()
	}

	/** Resolve the mirrored location, evaluating the expression/variables in the `location` field. */
	#resolveTargetLocation(): ControlLocation | null {
		const myLocation = this.deps.pageStore.getLocationOfControlId(this.controlId)
		const parser = this.deps.variableValues.createVariablesAndExpressionParser(
			myLocation,
			null,
			null,
			myLocation ? this.deps.getPageVariableEntities(myLocation.pageNumber) : null
		)

		const location = this.options.location
		let raw: string
		if (location.isExpression) {
			const res = parser.executeExpression(location.value, 'string')
			raw = res.ok ? (stringifyVariableValue(res.value) ?? '') : ''
		} else {
			raw = parser.parseVariables(location.value).text
		}

		return ParseLocationString(raw, myLocation ?? undefined)
	}

	#resolveTargetControlId(): string | undefined {
		const location = this.#resolveTargetLocation()
		return (location ? this.deps.pageStore.getControlIdAt(location) : undefined) ?? undefined
	}

	pressControl(pressed: boolean, surfaceId: string | undefined, force?: boolean): void {
		// Loop guard: stop forwarding once a press has hopped through too many references
		if (referenceSurfaceIdDepth(surfaceId) >= MAX_REFERENCE_DEPTH) return

		const targetControlId = this.#resolveTargetControlId()
		if (!targetControlId || targetControlId === this.controlId) return

		this.deps.controlsAccessor.pressControl(
			targetControlId,
			pressed,
			mangleReferenceSurfaceId(surfaceId, this.controlId),
			force
		)
	}

	override rotateControl(rightward: boolean, surfaceId: string | undefined): boolean {
		if (referenceSurfaceIdDepth(surfaceId) >= MAX_REFERENCE_DEPTH) return false

		const targetControlId = this.#resolveTargetControlId()
		if (!targetControlId || targetControlId === this.controlId) return false

		return this.deps.controlsAccessor.rotateControl(
			targetControlId,
			rightward,
			mangleReferenceSurfaceId(surfaceId, this.controlId)
		)
	}

	/**
	 * Update an option field. Only `location` (the mirrored target) and `notes` are editable.
	 */
	optionsSetField(key: string, value: JsonValue | undefined): boolean {
		if (key === 'notes') {
			if (typeof value !== 'string') return false
			this.options.notes = value
			this.commitChange(false)
			return true
		}

		if (key === 'location') {
			if (!isExpressionOrValue(value)) return false
			this.options.location = value
			this.commitChange(true)
			return true
		}

		return false
	}

	/**
	 * Snapshot the mirrored target into a normal editable layered button, breaking the link. If the target can't
	 * be resolved, produce a blank layered button.
	 */
	convertControl(): SomeButtonModel {
		const targetControlId = this.#resolveTargetControlId()
		const target = targetControlId ? this.deps.controlsAccessor.getControl(targetControlId) : undefined
		if (target) {
			return structuredClone(target.toJSON(true)) as SomeButtonModel
		}

		const blank: LayeredButtonModel = {
			type: 'button-layered',
			options: { stepProgression: 'auto', rotaryActions: false, canModifyStyleInApis: false },
			style: { layers: structuredClone(ControlButtonLayered.DefaultElements) },
			feedbacks: [],
			steps: {
				'0': {
					action_sets: { down: [], up: undefined, rotate_left: undefined, rotate_right: undefined },
					options: { runWhileHeld: [] },
				},
			},
			localVariables: [],
		}
		return blank
	}

	collectReferencedConnectionsAndVariables(
		foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void {
		const collector = new VisitorReferencesCollector(
			this.deps.internalModule,
			foundConnectionIds,
			foundConnectionLabels,
			foundVariables,
			undefined
		)
		collector.visitExpressionOrValue(this.options.location, true)
	}

	renameVariables(labelFrom: string, labelTo: string): void {
		const updater = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
		// Renames the label in-place within the location expression/variable-string
		updater.visitExpressionOrValue(this.options.location, true)

		if (updater.hasChanges()) this.commitChange(true)
	}

	triggerLocationHasChanged(): void {
		this.#drawing.invalidate()
	}

	toJSON(clone = true): ButtonReferenceButtonModel {
		const obj: ButtonReferenceButtonModel = {
			type: this.type,
			options: this.options,
		}
		return clone ? structuredClone(obj) : obj
	}
}
