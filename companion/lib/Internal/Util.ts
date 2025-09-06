import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ExpressionOrValue, isExpressionOrValue, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'

export function ParseLocationString(
	str: string | undefined,
	pressLocation: ControlLocation | undefined
): ControlLocation | null {
	if (!str) return null

	str = str.trim().toLowerCase()

	// Special case handling for local special modes
	if (str.startsWith('this')) return pressLocation ?? null

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

export const CHOICES_LOCATION: SomeCompanionInputField = {
	type: 'textinput',
	label: 'Location',
	description: 'eg 1/0/0 or $(this:page)/$(this:row)/$(this:column)',
	expressionDescription: 'eg `1/0/0` or `${$(this:page) + 1}/${$(this:row)}/${$(this:column)}`',
	id: 'location',
	default: '$(this:page)/$(this:row)/$(this:column)',
	useVariables: {
		local: true,
	},
}

export function convertOldLocationToExpressionOrValue(options: Record<string, any>): boolean {
	if (options.location) return false

	if (options.location_target === 'this:only-this-run') {
		options.location = {
			isExpression: false,
			value: 'this-run',
		} satisfies ExpressionOrValue<any>
	} else if (options.location_target === 'this:all-runs') {
		options.location = {
			isExpression: false,
			value: 'this-all-runs',
		} satisfies ExpressionOrValue<any>
	} else if (options.location_target === 'this') {
		options.location = {
			isExpression: false,
			value: '$(this:location)',
		} satisfies ExpressionOrValue<any>
	} else if (options.location_target === 'expression') {
		options.location = {
			isExpression: true,
			value: options.location_expression || '',
		} satisfies ExpressionOrValue<any>
	} else {
		options.location = {
			isExpression: false,
			value: options.location_text || '',
		} satisfies ExpressionOrValue<any>
	}

	delete options.location_target
	delete options.location_text
	delete options.location_expression
	return true
}

export function convertOldSplitOptionToExpression(
	options: Record<string, any>,
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
				value: options[keys.variable] || '',
			} satisfies ExpressionOrValue<string>
		} else {
			options[keys.result] = {
				isExpression: true,
				value: options[keys.variable] === undefined ? '' : `parseVariables(\`${options[keys.variable]}\`)`,
			} satisfies ExpressionOrValue<string>
		}
	} else {
		options[keys.result] = {
			isExpression: false,
			value: options[keys.simple] || '',
		} satisfies ExpressionOrValue<string>
	}

	delete options[keys.useVariables]
	delete options[keys.variable]
	if (keys.simple !== keys.result) delete options[keys.simple]
}

export function convertSimplePropertyToExpresionValue(
	options: Record<string, any>,
	key: string,
	oldKey?: string,
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
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
