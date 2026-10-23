import type { JsonValue } from 'type-fest'
import type { LinkButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { LinkButtonRuntimeProps } from '@companion-app/shared/Model/Link.js'
import { exprVal, isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { ParseLocationString } from '../../../Internal/Util.js'
import type { LinkButtonState, LinkButtonTarget } from '../../../Link/ButtonClient.js'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../../Resources/Visitors/ReferencesUpdater.js'
import { mangleReferenceSurfaceId } from '../../../Surface/ReferenceSurfaceId.js'
import { ControlBase } from '../../ControlBase.js'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type {
	ControlWithOptions,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutConvert,
	ControlWithoutEntities,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutPushed,
} from '../../IControlFragments.js'
import { LinkButtonDrawer } from './LinkButtonDrawer.js'

const UNCONFIGURED_STATE: LinkButtonState = {
	status: 'unconfigured',
	peerName: null,
	dataUrl: null,
	pressed: false,
	sourceChain: [],
}

/**
 * A button that mirrors a button on another Companion installation, over Companion Link: it shows the remote
 * button's image and forwards presses and rotation to it. The subscription to the remote button is managed by the
 * {@link LinkButtonClient}; this control only says what it wants to show.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 5.2.0
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ControlButtonLink
	extends ControlBase<LinkButtonModel>
	implements
		ControlWithoutLayeredStyle,
		ControlWithoutEntities,
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithOptions,
		ControlWithoutPushed,
		ControlWithoutConvert
{
	readonly type = 'link-button'

	readonly supportsActions = false
	readonly supportsActionSets = false
	readonly supportsConvert = false
	readonly supportsEntities = false
	readonly supportsEvents = false
	readonly supportsLayeredStyle = false
	readonly supportsOptions = true
	readonly supportsPushed = false

	options: LinkButtonModel['options']

	readonly #drawing: LinkButtonDrawer
	override get drawing(): LinkButtonDrawer {
		return this.#drawing
	}

	/** Variables the location depends on, so that it is resolved again when any of them change */
	#locationVariables: ReadonlySet<string> = new Set()

	protected triggerInvalidation = (): void => {
		this.#drawing.invalidate()
	}

	constructor(deps: ControlDependencies, controlId: string, storage: LinkButtonModel | null, isImport: boolean) {
		super(deps, controlId, 'Controls/Button/Link')

		this.options = { peerId: '', location: exprVal('') }

		this.#drawing = new LinkButtonDrawer(
			deps,
			controlId,
			() => this.deps.linkButtons.getState(this.controlId) ?? UNCONFIGURED_STATE
		)

		if (!storage) {
			// New control
			this.commitChange()
		} else {
			if (storage.type !== 'link-button') throw new Error(`Invalid type given to ControlButtonLink: "${storage.type}"`)

			this.options = {
				peerId: storage.options.peerId,
				location: storage.options.location,
				notes: storage.options.notes,
			}

			if (isImport) this.commitChange()
		}

		this.#updateTarget()
	}

	destroy(): void {
		this.deps.linkButtons.removeTarget(this.controlId)
		this.#drawing.dispose()
		super.destroy()
	}

	/** Resolve the location, and tell the link client what this button should show */
	#updateTarget(): void {
		const target = this.#resolveTarget()
		this.deps.linkButtons.setTarget(this.controlId, target, () => {
			this.sendRuntimePropsChange()
			this.#drawing.invalidate()
		})
	}

	#resolveTarget(): LinkButtonTarget | null {
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
			this.#locationVariables = res.variableIds
		} else {
			const res = parser.parseVariables(location.value)
			raw = res.text
			this.#locationVariables = res.variableIds
		}

		// `this` (and page 0) means the same location as this button, but on the remote installation
		const resolved = ParseLocationString(raw, myLocation ?? undefined)
		if (!this.options.peerId || !resolved) return null

		return { peerId: this.options.peerId, location: resolved }
	}

	pressControl(pressed: boolean, surfaceId: string | undefined): void {
		this.deps.linkButtons.press(this.controlId, pressed, mangleReferenceSurfaceId(surfaceId, this.controlId))
	}

	override rotateControl(delta: number, surfaceId: string | undefined): boolean {
		return this.deps.linkButtons.rotate(this.controlId, delta, mangleReferenceSurfaceId(surfaceId, this.controlId))
	}

	/** The actions run on the remote installation, so abort them there */
	override abortDelayedActions(skip_up: boolean, _exceptSignal: AbortSignal | null, linkHops: number): void {
		this.deps.linkButtons.abort(this.controlId, skip_up, linkHops)
	}

	/**
	 * Update an option field: `peerId`, `location` or `notes`
	 */
	optionsSetField(key: string, value: JsonValue | undefined): boolean {
		switch (key) {
			case 'notes':
				if (typeof value !== 'string') return false
				this.options.notes = value
				this.commitChange(false)
				return true
			case 'peerId':
				if (typeof value !== 'string') return false
				this.options.peerId = value
				break
			case 'location':
				if (!isExpressionOrValue(value)) return false
				this.options.location = value
				break
			default:
				return false
		}

		this.commitChange(false)
		this.#updateTarget()
		return true
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
		updater.visitExpressionOrValue(this.options.location, true)

		if (updater.hasChanges()) {
			this.commitChange(false)
			this.#updateTarget()
		}
	}

	/** The location can reference variables, so resolve it again when any of them change */
	override onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		if (!this.#locationVariables.isDisjointFrom(allChangedVariables)) this.#updateTarget()
	}

	/** The location can be relative to this button, so resolve it again */
	triggerLocationHasChanged(): void {
		this.#updateTarget()
	}

	toRuntimeJSON(): LinkButtonRuntimeProps {
		const state = this.deps.linkButtons.getState(this.controlId) ?? UNCONFIGURED_STATE
		return { status: state.status, peerName: state.peerName }
	}

	toJSON(clone = true): LinkButtonModel {
		const obj: LinkButtonModel = {
			type: this.type,
			options: this.options,
		}
		return clone ? structuredClone(obj) : obj
	}
}
