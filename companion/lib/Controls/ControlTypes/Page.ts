import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { PageControlModel } from '@companion-app/shared/Model/PageControlModel.js'
import { VisitorReferencesCollector } from '../../Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../Resources/Visitors/ReferencesUpdater.js'
import { ControlBase } from '../ControlBase.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import type { ControlEntityListChangeProps } from '../Entities/EntityListPoolBase.js'
import { EntityListPoolPage } from '../Entities/EntityListPoolPage.js'
import type {
	ControlWithEntities,
	ControlWithoutActions,
	ControlWithoutActionSets,
	ControlWithoutConvert,
	ControlWithoutEvents,
	ControlWithoutLayeredStyle,
	ControlWithoutOptions,
	ControlWithoutPushed,
} from '../IControlFragments.js'

/**
 * Class for a "page" control.
 *
 * There is exactly one of these per page (id `page:<pageId>`, auto-created and destroyed with the
 * page). It has no drawing and no options - it exists purely to own the page's local variables, which
 * are exposed to the rest of the page as `$(page:varname)`. Values propagate to the page's other
 * controls through the standard local-variables change path (see `EntityListPoolBase` and the
 * `variablesChanged` handling in `Registry`).
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
export class ControlPage
	extends ControlBase<PageControlModel>
	implements
		ControlWithoutActions,
		ControlWithoutEvents,
		ControlWithEntities,
		ControlWithoutLayeredStyle,
		ControlWithoutActionSets,
		ControlWithoutOptions,
		ControlWithoutPushed,
		ControlWithoutConvert
{
	readonly type = 'page'

	readonly supportsActions = false
	readonly supportsConvert = false
	readonly supportsEvents = false
	readonly supportsEntities = true
	readonly supportsLayeredStyle = false
	readonly supportsActionSets = false
	readonly supportsOptions = false
	readonly supportsPushed = false

	readonly entities: EntityListPoolPage

	/**
	 * @param deps - the control dependencies
	 * @param controlId - id of the control (`page:<pageId>`)
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a control, not creating at startup
	 */
	constructor(deps: ControlDependencies, controlId: string, storage: PageControlModel | null, isImport: boolean) {
		super(deps, controlId, `Controls/ControlTypes/Page/${controlId}`)

		this.entities = new EntityListPoolPage({
			controlId,
			reportChange: this.#entityListReportChange.bind(this),
			instanceDefinitions: deps.instance.definitions,
			internalModule: deps.internalModule,
			processManager: deps.instance.processManager,
			variableValues: deps.variableValues,
			pageStore: deps.pageStore,
			getPageVariableEntities: deps.getPageVariableEntities,
		})

		if (!storage) {
			// New control
			this.commitChange()
		} else {
			if (storage.type !== 'page') throw new Error(`Invalid type given to ControlPage: "${storage.type}"`)

			this.entities.loadStorage(storage, true, isImport)

			if (isImport) setImmediate(() => this.#postProcessImport())
			else this.commitChange()
		}
	}

	#entityListReportChange(options: ControlEntityListChangeProps): void {
		if (!options.noSave) {
			this.commitChange(false)
		}
		// Page controls do not draw, so there is nothing to redraw here. Value propagation to the
		// page's other controls happens via the local-variables change path in the entity pool.
	}

	/**
	 * Collect the instance ids, labels, and variables referenced by this control
	 */
	collectReferencedConnectionsAndVariables(
		foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void {
		new VisitorReferencesCollector(
			this.deps.internalModule,
			foundConnectionIds,
			foundConnectionLabels,
			foundVariables,
			undefined
		).visitEntities(this.entities.getAllEntities(), [])
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		this.entities.resubscribeEntities(EntityModelType.Feedback, 'internal')
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	toJSON(clone = true): PageControlModel {
		const obj: PageControlModel = {
			type: this.type,
			localVariables: this.entities.getLocalVariableEntities().map((e) => e.asEntityModel(true)),
		}
		return clone ? structuredClone(obj) : obj
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param labelFrom - the old instance short name
	 * @param labelTo - the new instance short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const allEntities = this.entities.getAllEntities()

		// Fix up references
		const changed = new VisitorReferencesUpdater(
			this.deps.internalModule,
			{ [labelFrom]: labelTo },
			undefined,
			undefined
		)
			.visitEntities(allEntities, [])
			.recheckChangedFeedbacks()
			.hasChanges()

		// 'redraw' if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	#postProcessImport(): void {
		this.entities.resubscribeEntities()

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Remove all of this page's variables. Used when the page is wiped/cleared.
	 * @returns true if anything was removed
	 */
	clearVariables(): boolean {
		return this.entities.clearVariables()
	}

	destroy(): void {
		this.entities.destroy()

		super.destroy()
	}

	/**
	 * Page controls do not draw and do not publish a single value, so invalidation is a no-op.
	 * (Value propagation to the page's other controls happens via the local-variables change path.)
	 */
	protected triggerInvalidation(): void {
		// Nothing to do
	}

	get drawing(): null {
		return null // Page controls don't draw
	}

	/**
	 * Execute a press of this control
	 */
	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Nothing to do
	}
}
