import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import LogController, { type Logger } from '../Log/Controller.js'
import type { ParseVariablesResult } from '../Variables/Util.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { FeedbackEntityModelExt } from './Types.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'

/**
 *
 */
export function ParseInternalControlReference(
	logger: Logger,
	parser: VariablesAndExpressionParser,
	pressLocation: ControlLocation | undefined,
	options: Record<string, any>,
	useVariableFields: boolean
): {
	location: ControlLocation | null
	referencedVariables: ReadonlySet<string>
} {
	const sanitisePageNumber = (pageNumber: number): number | null => {
		return pageNumber == 0 ? (pressLocation?.pageNumber ?? null) : pageNumber
	}
	const parseBankString = (pageNumber: number, str: string): ControlLocation | null => {
		// Legacy bank id
		const bankIndex = Number(str.trim())
		const xy = oldBankIndexToXY(bankIndex)
		if (xy) {
			return {
				pageNumber: pageNumber,
				column: xy[0],
				row: xy[1],
			}
		} else if (bankIndex === 0 && pressLocation) {
			return {
				pageNumber: pageNumber,
				column: pressLocation.column,
				row: pressLocation.row,
			}
		} else {
			return null
		}
	}

	const parseLocationString = (str: string | undefined): ControlLocation | null => {
		if (!str) return null

		const parts = str.split('/') // TODO - more chars

		// TODO - this is horrible, and needs reworking to be simpler

		if (parts.length === 1 && parts[0].startsWith('bank')) {
			return pressLocation ? parseBankString(pressLocation.pageNumber, parts[0].slice(4)) : null
		} else if (parts.length === 2) {
			if (parts[1].startsWith('bank')) {
				const safePageNumber = sanitisePageNumber(Number(parts[0]))
				if (safePageNumber === null) return null
				return parseBankString(safePageNumber, parts[1].slice(4))
			} else {
				return pressLocation
					? {
							pageNumber: pressLocation.pageNumber,
							column: Number(parts[1]),
							row: Number(parts[0]),
						}
					: null
			}
		} else if (parts.length === 3) {
			const safePageNumber = sanitisePageNumber(Number(parts[0]))
			if (safePageNumber === null) return null
			return {
				pageNumber: safePageNumber,
				column: Number(parts[2]),
				row: Number(parts[1]),
			}
		} else {
			return null
		}
	}

	let location: ControlLocation | null = null
	let referencedVariables: ReadonlySet<string> = new Set<string>()

	let locationTarget = options.location_target
	if (locationTarget?.startsWith('this:')) locationTarget = 'this'

	switch (locationTarget) {
		case 'this':
			location = pressLocation
				? {
						pageNumber: pressLocation.pageNumber,
						column: pressLocation.column,
						row: pressLocation.row,
					}
				: null
			break
		case 'text':
			if (useVariableFields) {
				const result = parser.parseVariables(options.location_text)

				location = parseLocationString(result.text)
				referencedVariables = result.variableIds
			} else {
				location = parseLocationString(options.location_text)
			}
			break
		case 'expression':
			if (useVariableFields) {
				const result = parser.executeExpression(options.location_expression, 'string')
				if (result.ok) {
					location = parseLocationString(String(result.value))
				} else {
					logger.warn(`${result.error}, in expression: "${options.location_expression}"`)
				}
				referencedVariables = result.variableIds
			}
			break
	}

	return { location, referencedVariables }
}

export const CHOICES_DYNAMIC_LOCATION: SomeCompanionInputField[] = [
	{
		type: 'dropdown',
		label: 'Target',
		id: 'location_target',
		default: 'this',
		choices: [
			{ id: 'this', label: 'This button' },
			{ id: 'text', label: 'From text' },
			{ id: 'expression', label: 'From expression' },
		],
	},
	{
		type: 'textinput',
		label: 'Location (text with variables)',
		tooltip: 'eg 1/0/0 or $(this:page)/$(this:row)/$(this:column)',
		id: 'location_text',
		default: '$(this:page)/$(this:row)/$(this:column)',
		isVisibleUi: {
			type: 'expression',
			fn: '$(options:location_target) == "text"',
		},
		useVariables: {
			local: true,
		},
	},
	{
		type: 'textinput',
		label: 'Location (expression)',
		tooltip: 'eg `1/0/0` or `${$(this:page) + 1}/${$(this:row)}/${$(this:column)}`',
		id: 'location_expression',
		default: `concat($(this:page), '/', $(this:row), '/', $(this:column))`,
		isVisibleUi: {
			type: 'expression',
			fn: '$(options:location_target) == "expression"',
		},
		useVariables: {
			local: true,
		},
		isExpression: true,
	},
]

export class InternalModuleUtils {
	readonly #logger = LogController.createLogger('Internal/InternalModuleUtils')

	readonly #controlsController: ControlsController

	constructor(controlsController: ControlsController) {
		this.#controlsController = controlsController
	}

	/**
	 * Parse and execute an expression in a string
	 * @param str - String containing the expression to parse
	 * @param extras
	 * @param requiredType - Fail if the result is not of specified type
	 * @param injectedVariableValues - Inject some variable values
	 * @returns result of the expression
	 */
	executeExpressionForInternalActionOrFeedback(
		str: string,
		extras: RunActionExtras | FeedbackEntityModelExt,
		requiredType?: string
		// injectedVariableValues?: CompanionVariableValues
	): ExecuteExpressionResult {
		const injectedVariableValuesComplete = {
			...('id' in extras ? {} : this.#getInjectedVariablesForLocation(extras)),
			// ...injectedVariableValues,
		}

		const parser = this.#controlsController.createVariablesAndExpressionParser(
			extras.controlId,
			injectedVariableValuesComplete
		)

		return parser.executeExpression(String(str), requiredType)
	}

	/**
	 * Parse the variables in a string
	 * @param str - String to parse variables in
	 * @param extras
	 * @param injectedVariableValues - Inject some variable values
	 * @returns with variables replaced with values
	 */
	parseVariablesForInternalActionOrFeedback(
		str: string,
		extras: RunActionExtras | FeedbackEntityModelExt
		// injectedVariableValues?: VariablesCache
	): ParseVariablesResult {
		const injectedVariableValuesComplete = {
			...('id' in extras ? {} : this.#getInjectedVariablesForLocation(extras)),
			// ...injectedVariableValues,
		}

		const parser = this.#controlsController.createVariablesAndExpressionParser(
			extras.controlId,
			injectedVariableValuesComplete
		)

		return parser.parseVariables(str)
	}

	/**
	 *
	 */
	parseInternalControlReferenceForActionOrFeedback(
		extras: RunActionExtras | FeedbackEntityModelExt,
		options: Record<string, any>,
		useVariableFields: boolean
	): {
		location: ControlLocation | null
		referencedVariables: ReadonlySet<string>
	} {
		const injectedVariableValuesComplete = {
			...('id' in extras ? {} : this.#getInjectedVariablesForLocation(extras)),
			// ...injectedVariableValues,
		}

		const parser = this.#controlsController.createVariablesAndExpressionParser(
			extras.controlId,
			injectedVariableValuesComplete
		)

		return ParseInternalControlReference(this.#logger, parser, extras.location, options, useVariableFields)
	}

	/**
	 * Variables to inject based on an internal action
	 */
	#getInjectedVariablesForLocation(extras: RunActionExtras): CompanionVariableValues {
		return {
			// Doesn't need to be reactive, it's only for an action
			'$(this:surface_id)': extras.surfaceId,
		}
	}
}
