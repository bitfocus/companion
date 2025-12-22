import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ActionSetsModel } from '@companion-app/shared/Model/ActionModel.js'
import type { LayeredButtonModel, ButtonModelBase } from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ExportControlv6, ExportTriggerContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import { VisitorReferencesUpdater } from '../Resources/Visitors/ReferencesUpdater.js'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import type { Logger } from '../Log/Controller.js'
import type { InternalController } from '../Internal/Controller.js'

export type InstanceAppliedRemappings = Record<
	string,
	{ id: string; label: string; lastUpgradeIndex?: number; oldLabel?: string }
>

export function fixupTriggerControl(
	internalModule: InternalController,
	control: ExportTriggerContentv6,
	instanceIdMap: InstanceAppliedRemappings
): TriggerModel {
	// Future: this does not feel durable

	const connectionLabelRemap: Record<string, string> = {}
	const connectionIdRemap: Record<string, string> = {}
	for (const [oldId, info] of Object.entries(instanceIdMap)) {
		if (info.oldLabel && info.label !== info.oldLabel) {
			connectionLabelRemap[info.oldLabel] = info.label
		}
		if (info.id && info.id !== oldId) {
			connectionIdRemap[oldId] = info.id
		}
	}

	const result: TriggerModel = {
		type: 'trigger',
		options: structuredClone(control.options),
		actions: [],
		condition: [],
		events: control.events,
		localVariables: [],
	}

	if (control.condition) {
		result.condition = fixupEntitiesRecursive(instanceIdMap, structuredClone(control.condition))
	}

	if (control.actions) {
		result.actions = fixupEntitiesRecursive(instanceIdMap, structuredClone(control.actions))
	}

	if (control.localVariables) {
		result.localVariables = fixupEntitiesRecursive(instanceIdMap, structuredClone(control.localVariables))
	}

	new VisitorReferencesUpdater(internalModule, connectionLabelRemap, connectionIdRemap)
		.visitEntities([], result.condition.concat(result.actions))
		.visitEvents(result.events || [])

	return result
}

export function fixupExpressionVariableControl(
	internalModule: InternalController,
	control: ExpressionVariableModel,
	instanceIdMap: InstanceAppliedRemappings
): ExpressionVariableModel {
	// Future: this does not feel durable

	const connectionLabelRemap: Record<string, string> = {}
	const connectionIdRemap: Record<string, string> = {}
	for (const [oldId, info] of Object.entries(instanceIdMap)) {
		if (info.oldLabel && info.label !== info.oldLabel) {
			connectionLabelRemap[info.oldLabel] = info.label
		}
		if (info.id && info.id !== oldId) {
			connectionIdRemap[oldId] = info.id
		}
	}

	const result: ExpressionVariableModel = {
		type: 'expression-variable',
		options: structuredClone(control.options),
		entity: null,
		localVariables: [],
	}

	if (control.entity) {
		result.entity = fixupEntitiesRecursive(instanceIdMap, [structuredClone(control.entity)])[0]
	}

	if (control.localVariables) {
		result.localVariables = fixupEntitiesRecursive(instanceIdMap, structuredClone(control.localVariables))
	}

	const visitor = new VisitorReferencesUpdater(internalModule, connectionLabelRemap, connectionIdRemap).visitEntities(
		[],
		result.localVariables
	)
	if (result.entity) visitor.visitEntities([], [result.entity])

	return result
}

export function fixupLayeredButtonControl(
	logger: Logger,
	control: ExportControlv6,
	referencesUpdater: VisitorReferencesUpdater,
	instanceIdMap: InstanceAppliedRemappings
): LayeredButtonModel {
	const result: LayeredButtonModel = {
		type: 'button-layered',
		options: structuredClone(control.options),
		style: structuredClone(control.style),
		...fixupButtonControlBase(logger, control, referencesUpdater, instanceIdMap),
	}

	referencesUpdater.visitDrawElements(result.style.layers)

	return result
}

function fixupButtonControlBase(
	logger: Logger,
	control: ExportControlv6,
	referencesUpdater: VisitorReferencesUpdater,
	instanceIdMap: InstanceAppliedRemappings
): ButtonModelBase {
	// Future: this does not feel durable

	const result: ButtonModelBase = {
		feedbacks: [],
		steps: {},
		localVariables: [],
	}

	if (control.feedbacks) {
		result.feedbacks = fixupEntitiesRecursive(instanceIdMap, structuredClone(control.feedbacks))
	}

	if (control.localVariables) {
		result.localVariables = fixupEntitiesRecursive(instanceIdMap, structuredClone(control.localVariables))
	}

	const allEntities: SomeEntityModel[] = [...result.feedbacks, ...result.localVariables]
	if (control.steps) {
		for (const [stepId, step] of Object.entries<any>(control.steps)) {
			const newStepSets: ActionSetsModel = {
				down: [],
				up: [],
				rotate_left: undefined,
				rotate_right: undefined,
			}
			result.steps[stepId] = {
				action_sets: newStepSets,
				options: structuredClone(step.options),
			}

			for (const [setId, action_set] of Object.entries<any>(step.action_sets)) {
				const setIdSafe = validateActionSetId(setId as any)
				if (setIdSafe === undefined) {
					logger.warn(`Invalid set id: ${setId}`)
					continue
				}

				const newActions = fixupEntitiesRecursive(instanceIdMap, structuredClone(action_set))

				newStepSets[setIdSafe] = newActions
				allEntities.push(...newActions)
			}
		}
	}

	referencesUpdater.visitEntities([], allEntities)

	return result
}

export function fixupEntitiesRecursive(
	instanceIdMap: InstanceAppliedRemappings,
	entities: SomeEntityModel[]
): SomeEntityModel[] {
	const newEntities: SomeEntityModel[] = []
	for (const entity of entities) {
		if (!entity) continue

		const instanceInfo = instanceIdMap[entity.connectionId]
		if (!instanceInfo) continue

		let newChildren: Record<string, SomeEntityModel[]> | undefined
		if (entity.connectionId === 'internal' && entity.children) {
			newChildren = {}
			for (const [group, childEntities] of Object.entries(entity.children)) {
				if (!childEntities) continue

				newChildren[group] = fixupEntitiesRecursive(instanceIdMap, childEntities)
			}
		}

		newEntities.push({
			...entity,
			connectionId: instanceInfo.id,
			upgradeIndex: instanceInfo.lastUpgradeIndex,
			children: newChildren,
		})
	}
	return newEntities
}
