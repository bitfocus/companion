import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { cloneDeep } from 'lodash-es'
import type {
	ExportFullv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { CompanionOptionValues } from '@companion-module/host'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Expression.js'
import type { JsonValue } from 'type-fest'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { CreateTriggerControlId, oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import { nanoid } from 'nanoid'

/**
 * These Entity types are a snapshot of the v10 definitions, to preserve how they were then
 */
type SomeEntityModelV10 = ActionEntityModelV10 | FeedbackEntityModelV10

interface ActionEntityModelV10 extends EntityModelBase {
	readonly type: 'action'
}

interface FeedbackEntityModelV10 extends EntityModelBase {
	readonly type: 'feedback'

	/** Boolean feedbacks can be inverted */
	isInverted?: boolean
	/** If in a list that produces local-variables, this entity value will be exposed under this name */
	variableName?: string
	/** When in a list that supports advanced feedbacks, this style can be set */
	style?: Partial<Record<string, any>>
}

interface EntityModelBase {
	// readonly type: EntityModelType

	id: string
	definitionId: string
	connectionId: string
	headline?: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex: number | undefined

	/**
	 * Some internal entities can have children, one or more set of them
	 */
	children?: Record<string, SomeEntityModelV10[] | undefined>
}

/**
 * do the database upgrades to convert from the v9 to the v10 format
 */
function convertDatabaseToV11(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const controls = db.getTableView('controls')
	for (const [id, control] of Object.entries(controls.all())) {
		const changed = fixupEntitiesOnControl(control)

		if (changed) controls.set(id, control)
	}
}

function fixupEntitiesOnControl(control: any): boolean {
	let changed = false

	changed = fixupEntities(control.condition) || changed
	changed = fixupEntities(control.actions) || changed
	changed = fixupEntities(control.localVariables) || changed
	changed = fixupEntities(control.feedbacks) || changed

	// Expression variable root
	if (control.entity) {
		const updatedEntity = fixupEntity(control.entity)
		if (updatedEntity) {
			control.entity = updatedEntity
			changed = true
		}
	}

	// Button actions
	for (const stepObj of Object.values<any>(control.steps ?? {})) {
		for (const actionSet of Object.values<any>(stepObj.action_sets || {})) {
			changed = fixupEntities(actionSet) || changed
		}
	}

	return changed
}

function fixupEntity(entity: SomeEntityModelV10): SomeEntityModelV10 | null {
	let changed = false

	if (entity.connectionId === 'internal') {
		if (entity.type === 'action') {
			if (entity.definitionId === 'action_recorder_set_recording') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'enable') || changed
			} else if (entity.definitionId === 'action_recorder_save_to_button') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'page') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'bank') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'step') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'set') || changed
			}

			if (
				entity.definitionId === 'button_pressrelease' ||
				entity.definitionId === 'button_pressrelease_if_expression' ||
				entity.definitionId === 'button_pressrelease_condition' ||
				entity.definitionId === 'button_pressrelease_condition_variable' ||
				entity.definitionId === 'button_press' ||
				entity.definitionId === 'button_release'
			) {
				if (entity.options.force === undefined) {
					entity.options.force = true

					changed = true
				}
			}

			if (entity.definitionId === 'button_pressrelease_condition_variable') {
				entity.definitionId = 'button_pressrelease_condition'

				// Also mangle the page & bank inputs
				entity.options.page_from_variable = true
				entity.options.bank_from_variable = true
				entity.options.page_variable = `$(${entity.options.page})`
				delete entity.options.page
				entity.options.bank_variable = `$(${entity.options.bank})`
				delete entity.options.bank

				changed = true
			}

			// Update bank -> location
			if (
				entity.options.location_target === undefined &&
				(entity.definitionId === 'button_pressrelease' ||
					entity.definitionId === 'button_press' ||
					entity.definitionId === 'button_pressrelease_if_expression' ||
					entity.definitionId === 'button_pressrelease_condition' ||
					entity.definitionId === 'button_press' ||
					entity.definitionId === 'button_release' ||
					entity.definitionId === 'button_rotate_left' ||
					entity.definitionId === 'button_rotate_right' ||
					entity.definitionId === 'button_text' ||
					entity.definitionId === 'textcolor' ||
					entity.definitionId === 'bgcolor' ||
					entity.definitionId === 'panic_bank' ||
					entity.definitionId === 'bank_current_step' ||
					entity.definitionId === 'bank_current_step_condition' ||
					entity.definitionId === 'bank_current_step_if_expression' ||
					entity.definitionId === 'bank_current_step_delta')
			) {
				const oldOptions = { ...entity.options }
				delete entity.options.bank
				delete entity.options.bank_variable
				delete entity.options.bank_from_variable
				delete entity.options.page
				delete entity.options.page_variable
				delete entity.options.page_from_variable

				if (oldOptions.bank == 0 && oldOptions.page == 0) {
					entity.options.location_target = 'this'

					changed = true
				} else {
					const xy = oldBankIndexToXY(oldOptions.bank)

					let pageNumber = oldOptions.page_from_variable ? oldOptions.page_variable : oldOptions.page
					if (pageNumber == 0) pageNumber = `$(this:page)`

					if (oldOptions.bank_from_variable || oldOptions.page_from_variable) {
						const column = xy ? xy[0] : '$(this:column)'
						const row = xy ? xy[1] : '$(this:row)'

						entity.options.location_target = 'expression'
						entity.options.location_expression = oldOptions.bank_from_variable
							? `concat(${pageNumber}, '/bank', ${oldOptions.bank_variable})`
							: `concat(${pageNumber}, '/', ${row}, '/', ${column})`
					} else {
						const buttonId = xy ? `${xy[1]}/${xy[0]}` : `$(this:row)/$(this:column)`

						entity.options.location_target = 'text'
						entity.options.location_text = `${pageNumber}/${buttonId}`
					}

					changed = true
				}
			}

			if (
				entity.definitionId === 'button_pressrelease_if_expression' ||
				entity.definitionId === 'bank_current_step_if_expression'
			) {
				const newChildAction: ActionEntityModelV10 = {
					type: 'action',
					id: nanoid(),
					definitionId: entity.definitionId.slice(0, -'_if_expression'.length),
					connectionId: 'internal',
					options: {
						...entity.options,
					},
					upgradeIndex: undefined,
				}
				delete newChildAction.options.expression

				const newExpressionFeedback: FeedbackEntityModelV10 = {
					type: 'feedback',
					id: nanoid(),
					definitionId: 'check_expression',
					connectionId: 'internal',
					options: {
						expression: entity.options.expression,
					},
					upgradeIndex: undefined,
				}

				// Ensure the new children are also upgraded
				fixupEntity(newChildAction)
				fixupEntity(newExpressionFeedback)

				return {
					type: 'action',
					id: entity.id,
					definitionId: 'logic_if',
					connectionId: 'internal',
					options: {}, // No options, no need to recurse
					children: {
						condition: [newExpressionFeedback],
						actions: [newChildAction],
						else_actions: [],
					},
					upgradeIndex: undefined,
				} satisfies ActionEntityModelV10
			} else if (
				entity.definitionId === 'button_pressrelease_condition' ||
				entity.definitionId === 'button_press_condition' ||
				entity.definitionId === 'button_release_condition' ||
				entity.definitionId === 'bank_current_step_condition'
			) {
				const newChildAction: ActionEntityModelV10 = {
					type: 'action',
					id: nanoid(),
					definitionId: entity.definitionId.slice(0, -'_condition'.length),
					connectionId: 'internal',
					options: {
						...entity.options,
					},
					upgradeIndex: undefined,
				}
				delete newChildAction.options.variable
				delete newChildAction.options.op
				delete newChildAction.options.value

				const newExpressionFeedback: FeedbackEntityModelV10 = {
					type: 'feedback',
					id: nanoid(),
					definitionId: 'variable_value',
					connectionId: 'internal',
					options: {
						variable: entity.options.variable,
						op: entity.options.op,
						value: entity.options.value,
					},
					upgradeIndex: undefined,
				}

				// Ensure the new children are also upgraded
				fixupEntity(newChildAction)
				fixupEntity(newExpressionFeedback)

				return {
					type: 'action',
					id: entity.id,
					definitionId: 'logic_if',
					connectionId: 'internal',
					options: {}, // No options, no need to recurse
					children: {
						condition: [newExpressionFeedback],
						actions: [newChildAction],
						else_actions: [],
					},
					upgradeIndex: undefined,
				} satisfies ActionEntityModelV10
			}

			if (entity.definitionId === 'panic_page' && !isExpressionOrValue(entity.options.page)) {
				convertOldSplitOptionToExpression(
					entity.options,
					{
						useVariables: 'page_from_variable',
						variable: 'page_variable',
						simple: 'page',
						result: 'page',
					},
					true
				)
				changed = true
			} else if (
				entity.definitionId === 'button_pressrelease' ||
				entity.definitionId === 'button_press' ||
				entity.definitionId === 'button_release' ||
				entity.definitionId === 'button_rotate_left' ||
				entity.definitionId === 'button_rotate_right' ||
				entity.definitionId === 'panic_bank'
			) {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
			} else if (entity.definitionId === 'button_text') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'label') || changed
			} else if (entity.definitionId === 'bgcolor' || entity.definitionId === 'textcolor') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'color') || changed
			} else if (entity.definitionId === 'bank_current_step_delta') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'amount') || changed
			} else if (entity.definitionId === 'bank_current_step') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed

				if (!isExpressionOrValue(entity.options.step)) {
					convertOldSplitOptionToExpression(
						entity.options,
						{
							useVariables: 'step_from_expression',
							variable: 'step_expression',
							simple: 'step',
							result: 'step',
						},
						true
					)
					changed = true
				}
			}

			const variableRegex = /^\$\(([^:$)]+):([^)$]+)\)$/
			const wrapValue = (val: string | number) => {
				if (!isNaN(Number(val))) {
					return Number(val)
				} else if (typeof val === 'string' && val.trim().match(variableRegex)) {
					return val.trim()
				} else {
					return `parseVariables("${val}")`
				}
			}

			// Consolidation for use expressions
			if (entity.definitionId === 'custom_variable_math_operation') {
				let op = '???'
				let reverse = false
				switch (entity.options.operation) {
					case 'plus':
						op = '+'
						break
					case 'minus':
						op = '-'
						break
					case 'minus_opposite':
						op = '-'
						reverse = true
						break
					case 'multiply':
						op = '*'
						break
					case 'divide':
						op = '/'
						break
					case 'divide_opposite':
						op = '/'
						reverse = true
						break
				}

				entity.definitionId = 'custom_variable_set_expression'

				const parts = [`$(${entity.options.variable})`, op, wrapValue(entity.options.value)]
				if (reverse) parts.reverse()

				entity.options.expression = parts.join(' ')
				entity.options.name = entity.options.result
				delete entity.options.variable
				delete entity.options.operation
				delete entity.options.value
				delete entity.options.result

				changed = true
			} else if (entity.definitionId === 'custom_variable_math_int_operation') {
				entity.definitionId = 'custom_variable_set_expression'
				entity.options.expression = `fromRadix($(${entity.options.variable}), ${entity.options.radix || 2})`
				entity.options.name = entity.options.result
				delete entity.options.variable
				delete entity.options.radix
				delete entity.options.result

				changed = true
			} else if (entity.definitionId === 'custom_variable_string_trim_operation') {
				entity.definitionId = 'custom_variable_set_expression'
				entity.options.expression = `trim($(${entity.options.variable}))`
				entity.options.name = entity.options.result
				delete entity.options.variable
				delete entity.options.result

				changed = true
			} else if (entity.definitionId === 'custom_variable_string_concat_operation') {
				entity.definitionId = 'custom_variable_set_expression'

				const wrappedValue =
					entity.options.value.indexOf('$(') !== -1 ? `\${${wrapValue(entity.options.value)}}` : entity.options.value
				const wrappedVariable = `\${$(${entity.options.variable})}`

				entity.options.expression =
					entity.options.order === 'variable_value'
						? `\`${wrappedVariable}${wrappedValue}\``
						: `\`${wrappedValue}${wrappedVariable}\``

				entity.options.name = entity.options.result
				delete entity.options.variable
				delete entity.options.value
				delete entity.options.order
				delete entity.options.result

				changed = true
			} else if (entity.definitionId === 'custom_variable_string_substring_operation') {
				entity.definitionId = 'custom_variable_set_expression'

				entity.options.expression = `substr($(${entity.options.variable}), ${wrapValue(
					entity.options.start
				)}, ${wrapValue(entity.options.end)})`

				entity.options.name = entity.options.result
				delete entity.options.variable
				delete entity.options.start
				delete entity.options.end
				delete entity.options.result

				changed = true
			} else if (entity.definitionId === 'custom_variable_set_via_jsonpath') {
				entity.definitionId = 'custom_variable_set_expression'
				entity.options.expression = `jsonpath($(custom:${entity.options.jsonResultDataVariable}), "${entity.options.jsonPath?.replaceAll('"', '\\"')}")`

				entity.options.name = entity.options.targetVariable

				delete entity.options.targetVariable
				delete entity.options.jsonResultDataVariable
				delete entity.options.jsonPath

				changed = true
			}

			// Conversion to auto-expressions
			if (
				entity.definitionId === 'custom_variable_sync_to_default' ||
				entity.definitionId === 'custom_variable_reset_to_default'
			) {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed
			} else if (entity.definitionId === 'custom_variable_set_value') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'value') || changed
			} else if (entity.definitionId === 'custom_variable_set_expression') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed

				// Rename to the combined action
				entity.definitionId = 'custom_variable_set_value'
				entity.options.value = {
					isExpression: true,
					value: entity.options.expression,
				} satisfies ExpressionOrValue<any>
				delete entity.options.expression

				changed = true
			} else if (entity.definitionId === 'custom_variable_create_value') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'value') || changed

				// Rename to the combined action
				entity.definitionId = 'custom_variable_set_value'
				entity.options.create = true

				changed = true
			} else if (entity.definitionId === 'custom_variable_store_variable') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed

				// Rename to the combined action
				entity.definitionId = 'custom_variable_set_value'
				entity.options.create = false
				entity.options.value = {
					isExpression: true,
					value: `$(${entity.options.variable})`,
				} satisfies ExpressionOrValue<any>
				delete entity.options.variable

				changed = true
			}

			// Upgrade an action. This check is not the safest, but it should be ok
			if (entity.options.controller === 'emulator') {
				// Hope that the default emulator still exists
				entity.options.controller = 'emulator:emulator'

				changed = true
			}

			if (
				!entity.options.surfaceId &&
				(entity.definitionId === 'set_brightness' ||
					entity.definitionId === 'set_page' ||
					entity.definitionId === 'inc_page' ||
					entity.definitionId === 'dec_page' ||
					entity.definitionId === 'lockout_device' ||
					entity.definitionId === 'unlockout_device' ||
					entity.definitionId === 'surface_set_position' ||
					entity.definitionId === 'surface_adjust_position')
			) {
				changed = true

				convertOldSplitOptionToExpression(
					entity.options,
					{
						useVariables: 'controller_from_variable',
						simple: 'controller',
						variable: 'controller_variable',
						result: 'surfaceId',
					},
					false
				)
			}

			if (entity.definitionId === 'set_brightness') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'brightness') || changed
			}

			if (
				(entity.definitionId === 'set_page' || entity.definitionId === 'set_page_byindex') &&
				entity.options.page_from_variable !== undefined
			) {
				changed = true

				convertOldSplitOptionToExpression(
					entity.options,
					{
						useVariables: 'page_from_variable',
						simple: 'page',
						variable: 'page_variable',
						result: 'page',
					},
					true
				)
			}

			if (entity.definitionId === 'set_page_byindex' && entity.options.controller_from_variable !== undefined) {
				changed = true

				convertOldSplitOptionToExpression(
					entity.options,
					{
						useVariables: 'controller_from_variable',
						simple: 'controller',
						variable: 'controller_variable',
						result: 'surfaceIndex',
					},
					true
				)
			}

			if (entity.definitionId === 'surface_set_position') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'x_offset') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'y_offset') || changed
			}
			if (entity.definitionId === 'surface_adjust_position') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'x_adjustment') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'y_adjustment') || changed
			}

			if (entity.definitionId === 'custom_log') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'message') || changed
			} else if (entity.definitionId === 'exec') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'path') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'timeout') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'targetVariable') || changed
			}

			if (entity.definitionId === 'trigger_enabled' && !isNaN(Number(entity.options.trigger_id))) {
				entity.options.trigger_id = CreateTriggerControlId(entity.options.trigger_id)

				changed = true
			}

			if (entity.definitionId === 'local_variable_set_value') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'value') || changed
			} else if (entity.definitionId === 'local_variable_set_expression') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed

				// Rename to the combined action
				entity.definitionId = 'local_variable_set_value'
				entity.options.value = {
					isExpression: true,
					value: entity.options.expression,
				} satisfies ExpressionOrValue<any>
				delete entity.options.expression

				changed = true
			} else if (
				entity.definitionId === 'local_variable_reset_to_default' ||
				entity.definitionId === 'local_variable_sync_to_default'
			) {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'name') || changed
			}
		} else if (entity.type === 'feedback') {
			if (entity.definitionId === 'logic_and') {
				entity.definitionId = 'logic_operator'
				entity.options = { operation: 'and' }

				changed = true
			} else if (entity.definitionId === 'logic_or') {
				entity.definitionId = 'logic_operator'
				entity.options = { operation: 'or' }

				changed = true
			} else if (entity.definitionId === 'logic_xor') {
				entity.definitionId = 'logic_operator'
				entity.options = { operation: 'xor' }

				changed = true
			}

			if (entity.options.bank !== undefined) {
				if (entity.options.bank == 0 && entity.options.page == 0) {
					entity.options.location_target = 'this'

					delete entity.options.bank
					delete entity.options.page
					changed = true
				} else {
					const xy = oldBankIndexToXY(entity.options.bank)

					let pageNumber = entity.options.page
					if (pageNumber == 0) pageNumber = `$(this:page)`

					const buttonId = xy ? `${xy[1]}/${xy[0]}` : `$(this:row)/$(this:column)`

					entity.options.location_target = 'text'
					entity.options.location_text = `${pageNumber}/${buttonId}`

					delete entity.options.bank
					delete entity.options.page
					changed = true
				}
			}

			if (entity.definitionId === 'bank_style' || entity.definitionId === 'bank_pushed') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
			} else if (entity.definitionId === 'bank_current_step') {
				changed = convertOldLocationToExpressionOrValue(entity.options) || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'step') || changed
			}

			if (entity.definitionId === 'surface_on_page') {
				changed = convertSimplePropertyToExpressionValue(entity.options, 'surfaceId', 'controller', 'self') || changed
				changed = convertSimplePropertyToExpressionValue(entity.options, 'page') || changed
			}
		}
	}

	// TODO ensure everything is now an expression

	return changed ? entity : null
}

function convertOldLocationToExpressionOrValue(options: CompanionOptionValues): boolean {
	if (options.location) return false

	if (options.location_target === 'this:only-this-run') {
		options.location = {
			isExpression: false,
			value: 'this-run',
		} satisfies ExpressionOrValue<string>
	} else if (options.location_target === 'this:all-runs') {
		options.location = {
			isExpression: false,
			value: 'this-all-runs',
		} satisfies ExpressionOrValue<string>
	} else if (options.location_target === 'this') {
		options.location = {
			isExpression: false,
			value: '$(this:location)',
		} satisfies ExpressionOrValue<string>
	} else if (options.location_target === 'expression') {
		options.location = {
			isExpression: true,
			value: stringifyVariableValue(options.location_expression) || '',
		} satisfies ExpressionOrValue<string>
	} else {
		options.location = {
			isExpression: false,
			value: options.location_text || '',
		} satisfies ExpressionOrValue<JsonValue>
	}

	delete options.location_target
	delete options.location_text
	delete options.location_expression
	return true
}

function convertOldSplitOptionToExpression(
	options: CompanionOptionValues,
	keys: {
		useVariables: string
		simple: string
		variable: string
		result: string
	},
	variableIsExpression: boolean
): void {
	if (options[keys.useVariables]) {
		if (variableIsExpression) {
			options[keys.result] = {
				isExpression: true,
				value: stringifyVariableValue(options[keys.variable]) || '',
			} satisfies ExpressionOrValue<string>
		} else {
			const variableName = stringifyVariableValue(options[keys.variable])
			options[keys.result] = {
				isExpression: true,
				value: !variableName ? '' : `parseVariables(\`${variableName}\`)`,
			} satisfies ExpressionOrValue<string>
		}
	} else {
		options[keys.result] = {
			isExpression: false,
			value: options[keys.simple] || '',
		} satisfies ExpressionOrValue<JsonValue>
	}

	delete options[keys.useVariables]
	delete options[keys.variable]
	if (keys.simple !== keys.result) delete options[keys.simple]
}

function convertSimplePropertyToExpressionValue(
	options: CompanionOptionValues,
	key: string,
	oldKey?: string,
	defaultValue?: any
): boolean {
	if (!isExpressionOrValue(options[key])) {
		options[key] = {
			isExpression: false,
			value: options[oldKey ?? key] ?? defaultValue,
		} satisfies ExpressionOrValue<any>
		if (oldKey) delete options[oldKey]

		return true
	} else {
		return false
	}
}

function fixupEntities(entities: SomeEntityModelV10[] | undefined): boolean {
	if (!entities || !Array.isArray(entities)) return false

	let changed = false

	for (let i = 0; i < entities.length; i++) {
		const updatedEntity = fixupEntity(entities[i])
		if (updatedEntity) {
			entities[i] = updatedEntity
			changed = true
		}
	}

	return changed
}

function convertImportToV11(obj: SomeExportv6): SomeExportv6 {
	if (obj.type == 'full') {
		const newObj: ExportFullv6 = {
			...cloneDeep(obj),
			version: 11,
		}

		for (const page of Object.values(newObj.pages ?? {})) {
			for (const row of Object.values(page?.controls ?? {})) {
				for (const control of Object.values(row ?? {})) {
					fixupEntitiesOnControl(control)
				}
			}
		}

		for (const trigger of Object.values(newObj.triggers ?? {})) {
			fixupEntitiesOnControl(trigger)
		}
		for (const expressionVar of Object.values(newObj.expressionVariables ?? {})) {
			fixupEntitiesOnControl(expressionVar)
		}

		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = {
			...cloneDeep(obj),
			version: 11,
		}

		for (const row of Object.values(newObj.page?.controls ?? {})) {
			for (const control of Object.values(row ?? {})) {
				fixupEntitiesOnControl(control)
			}
		}

		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = {
			...cloneDeep(obj),
			version: 11,
		}

		for (const trigger of Object.values(newObj.triggers ?? {})) {
			fixupEntitiesOnControl(trigger)
		}

		return newObj
	} else {
		// No change
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV11,
	upgradeImport: convertImportToV11,
}
