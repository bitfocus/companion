import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { Logger } from '../Log/Controller.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { VariablesCache } from '../Variables/Util.js'

/**
 *
 */
export function ParseInternalControlReference(
	logger: Logger,
	variablesController: VariablesValues,
	pressLocation: ControlLocation | undefined,
	options: Record<string, any>,
	useVariableFields: boolean,
	injectedVariableValues?: VariablesCache
): {
	location: ControlLocation | null
	referencedVariables: string[]
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
	let referencedVariables: string[] = []

	switch (options.location_target) {
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
				const result = variablesController.parseVariables(options.location_text, pressLocation, injectedVariableValues)

				location = parseLocationString(result.text)
				referencedVariables = result.variableIds
			} else {
				location = parseLocationString(options.location_text)
			}
			break
		case 'expression':
			if (useVariableFields) {
				try {
					const result = variablesController.executeExpression(
						options.location_expression,
						pressLocation,
						'string',
						injectedVariableValues
					)

					location = parseLocationString(String(result.value))
					referencedVariables = Array.from(result.variableIds)
				} catch (error: any) {
					logger.warn(`${error.toString()}, in expression: "${options.location_expression}"`)
				}
			}
			break
	}

	return { location, referencedVariables }
}
