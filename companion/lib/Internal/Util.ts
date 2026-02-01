import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CompanionFieldVariablesSupport, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'

export function ParseLocationString(
	str: string | null | undefined,
	pressLocation: ControlLocation | undefined
): ControlLocation | null {
	if (!str) return null

	str = str.trim().toLowerCase()

	// Special case handling for local special modes
	if (str.startsWith('this')) return pressLocation ?? null

	const parseNumber = (str: string): number | null => {
		// Reject empty strings (Number("") === 0 which is misleading)
		if (str.trim() === '') return null
		const num = Number(str)
		if (isNaN(num)) return null
		return num
	}

	const sanitisePageNumber = (pageNumber: number | null): number | null => {
		if (pageNumber === null || pageNumber < 0) return null
		return pageNumber === 0 ? (pressLocation?.pageNumber ?? null) : pageNumber
	}
	const parseBankString = (pageNumber: number, str: string): ControlLocation | null => {
		// Legacy bank id
		const bankIndex = parseNumber(str)
		const xy = bankIndex !== null && oldBankIndexToXY(bankIndex)
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

	const parts = str.split('/')

	if (parts.length === 1 && parts[0].startsWith('bank')) {
		// Handle backwards compatibility for bank numbers
		return pressLocation ? parseBankString(pressLocation.pageNumber, parts[0].slice(4)) : null
	} else if (parts.length === 2) {
		if (parts[1].startsWith('bank')) {
			// Handle backwards compatibility for bank numbers
			const safePageNumber = sanitisePageNumber(parseNumber(parts[0]))
			if (safePageNumber === null) return null

			return parseBankString(safePageNumber, parts[1].slice(4))
		} else if (pressLocation) {
			// Standard column/row
			const row = parseNumber(parts[0])
			const column = parseNumber(parts[1])

			if (row === null || column === null) return null

			return {
				pageNumber: pressLocation.pageNumber,
				column,
				row,
			}
		} else {
			return null
		}
	} else if (parts.length === 3) {
		const safePageNumber = sanitisePageNumber(parseNumber(parts[0]))
		if (safePageNumber === null) return null

		const row = parseNumber(parts[1])
		const column = parseNumber(parts[2])

		if (row === null || column === null) return null

		return {
			pageNumber: safePageNumber,
			column,
			row,
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
	useVariables: CompanionFieldVariablesSupport.InternalParser,
}
