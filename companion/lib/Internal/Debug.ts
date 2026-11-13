import { EventEmitter } from 'node:events'
import { FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { CompanionFeedbackButtonStyleResult } from '@companion-module/base'
import type { JsonValue } from '@companion-module/host'
import { isPackaged } from '../Resources/Util.js'
import type {
	ActionForInternalExecution,
	FeedbackForInternalExecution,
	InternalActionDefinition,
	InternalActionResult,
	InternalFeedbackDefinition,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
} from './Types.js'

const CHOICES = [
	{ id: 'one', label: 'One' },
	{ id: 'two', label: 'Two' },
	{ id: 'three', label: 'Three' },
]

/** One option of each kind of input field, to exercise the ui for them */
const ALL_FIELDS: SomeCompanionInputField[] = [
	{ type: 'static-text', label: 'Static text', id: 'static', value: 'Some static text' },
	{ type: 'textinput', label: 'Text input', id: 'textinput', default: '' },
	{ type: 'expression', label: 'Expression', id: 'expression', default: '' },
	{ type: 'number', label: 'Number', id: 'number', default: 5, min: 0, max: 100 },
	{ type: 'number', label: 'Number range', id: 'number_range', default: 5, min: 0, max: 100, range: true },
	{ type: 'checkbox', label: 'Checkbox', id: 'checkbox', default: false },
	{ type: 'checkbox', label: 'Toggle', id: 'toggle', default: false, displayToggle: true },
	{ type: 'colorpicker', label: 'Colour', id: 'color', default: 0xff0000, enableAlpha: false, returnType: 'number' },
	{
		type: 'colorpicker',
		label: 'Colour with alpha',
		id: 'color_alpha',
		default: 'rgba(255, 0, 0, 1)',
		enableAlpha: true,
		returnType: 'string',
	},
	{ type: 'dropdown', label: 'Dropdown', id: 'dropdown', default: 'one', choices: CHOICES },
	{
		type: 'dropdown',
		label: 'Dropdown custom',
		id: 'dropdown_custom',
		default: 'one',
		choices: CHOICES,
		allowCustom: true,
	},
	{ type: 'multidropdown', label: 'Multi dropdown', id: 'multidropdown', default: ['one'], choices: CHOICES },
	{ type: 'custom-variable', label: 'Custom variable (module)', id: 'module_custom_variable' },
	{ type: 'internal:variable', label: 'Variable', id: 'variable', supportsLocal: true, disableAutoExpression: true },
	{ type: 'internal:variable_value', label: 'Variable value', id: 'variable_value', default: '1' },
	{ type: 'internal:custom_variable', label: 'Custom variable', id: 'custom_variable', includeNone: true },
	{
		type: 'internal:trigger',
		label: 'Trigger',
		id: 'trigger',
		includeSelf: 'abort',
		default: 'self',
		disableAutoExpression: true,
	},
	{ type: 'internal:trigger_collection', label: 'Trigger collection', id: 'trigger_collection' },
	{ type: 'internal:connection_id', label: 'Connection', id: 'connection_id', multiple: false },
	{ type: 'internal:connection_collection', label: 'Connection collection', id: 'connection_collection' },
	{
		type: 'internal:surface_serial',
		label: 'Surface',
		id: 'surface_serial',
		default: 'self',
		includeSelf: true,
		listMode: 'surfaces',
	},
	{
		type: 'internal:outbound_surface_id',
		label: 'Outbound surface',
		id: 'outbound_surface_id',
		disableAutoExpression: true,
	},
	{ type: 'internal:page', label: 'Page', id: 'page', includeStartup: false, includeDirection: false, default: 0 },
	{ type: 'internal:time', label: 'Time', id: 'time' },
	{ type: 'internal:date', label: 'Date', id: 'date' },
	{ type: 'internal:horizontal-alignment', label: 'Horizontal alignment', id: 'halign', default: 'center' },
	{ type: 'internal:vertical-alignment', label: 'Vertical alignment', id: 'valign', default: 'center' },
	{ type: 'internal:text-styles', label: 'Text styles', id: 'text_styles', default: [] },
	{ type: 'internal:image-file', label: 'Image', id: 'image', default: null },
	{
		type: 'internal:table',
		label: 'Table',
		id: 'table',
		default: [],
		columns: [
			{ type: 'textinput', label: 'Name', id: 'name', default: '' },
			{ type: 'number', label: 'Count', id: 'count', default: 0, min: 0, max: 10 },
		],
	},
	{
		type: 'internal:list',
		label: 'List',
		id: 'list',
		default: [],
		fields: [
			{ type: 'textinput', label: 'Name', id: 'name', default: '' },
			{ type: 'checkbox', label: 'Enabled', id: 'enabled', default: false },
		],
	},
]

/**
 * Entities for developing and testing Companion, which are only offered when running from source
 */
export class InternalDebug extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	getActionDefinitions(): Record<string, InternalActionDefinition> {
		if (isPackaged()) return {}

		return {
			debug_action_result: {
				label: '(Debug) Action Result',
				description: 'Return a provided expression/JSON blob as the action result, for testing store-result targets',
				options: [
					{
						type: 'expression',
						label: 'Expression',
						id: 'expression',
						default: '{}',
						disableAutoExpression: true,
						allowInvalidValues: true,
					},
				],
				actionHasResult: true,
				optionsSupportExpressions: true,
			},
			debug_all_fields: {
				label: '(Debug) All Option Fields',
				description: 'Has an option of each kind of input field, and does nothing',
				options: ALL_FIELDS,
				optionsSupportExpressions: true,
			},
		}
	}

	executeAction(action: ActionForInternalExecution): InternalActionResult {
		switch (action.definitionId) {
			case 'debug_action_result':
				// The expression option is already evaluated (optionsSupportExpressions), so its value is the result.
				return { result: action.options.expression as JsonValue }
			case 'debug_all_fields':
				return { result: undefined }
			default:
				return null
		}
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		if (isPackaged()) return {}

		return {
			debug_expression_value: {
				feedbackType: FeedbackEntitySubType.Advanced,
				label: '(Debug) Evaluate Expression',
				description: 'Evaluate an expression and use the result as the feedback value',
				feedbackStyle: undefined,
				showInvert: false,
				options: [
					{
						type: 'expression',
						label: 'Expression',
						id: 'expression',
						default: '{}',
						disableAutoExpression: true,
						allowInvalidValues: true,
					},
				],
				optionsSupportExpressions: true,
			},
			debug_all_fields: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: '(Debug) All Option Fields',
				description: 'Has an option of each kind of input field, and is always false',
				feedbackStyle: undefined,
				showInvert: true,
				options: ALL_FIELDS,
				optionsSupportExpressions: true,
			},
		}
	}

	executeFeedback(feedback: FeedbackForInternalExecution): boolean | CompanionFeedbackButtonStyleResult | void {
		switch (feedback.definitionId) {
			case 'debug_expression_value': {
				const value = feedback.options.expression
				// Advanced feedbacks must return a style object
				return typeof value === 'object' && value !== null ? (value as CompanionFeedbackButtonStyleResult) : {}
			}
			case 'debug_all_fields':
				return false
			default:
				return
		}
	}
}
