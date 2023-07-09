import { oldBankIndexToXY } from '../Shared/ControlId.js'

export function ParseInternalControlReference(self, pressLocation, options, useVariableFields) {
	const sanitisePageNumber = (pageNumber) => {
		return pageNumber == 0 ? pressLocation?.pageNumber ?? null : pageNumber
	}
	const parseBankString = (pageNumber, str) => {
		// Legacy bank id
		const bankIndex = Number(str.trim())
		const xy = oldBankIndexToXY(bankIndex)
		if (xy) {
			return {
				pageNumber: pageNumber,
				column: xy[0],
				row: xy[1],
			}
		} else if (bankIndex === 0) {
			return {
				pageNumber: pageNumber,
				column: pressLocation?.column,
				row: pressLocation?.row,
			}
		} else {
			return null
		}
	}
	const parseLocationString = (str) => {
		if (!str) return null

		const parts = str.split('/') // TODO - more chars

		// TODO - this is horrible, and needs reworking to be simpler

		if (parts.length === 1 && parts[0].startsWith('bank')) {
			return parseBankString(pressLocation?.pageNumber ?? null, parts[0].slice(4))
		} else if (parts.length === 2) {
			if (parts[1].startsWith('bank')) {
				return parseBankString(sanitisePageNumber(Number(parts[0])), parts[1].slice(4))
			} else {
				return {
					pageNumber: pressLocation?.pageNumber ?? null,
					column: Number(parts[0]),
					row: Number(parts[1]),
				}
			}
		} else if (parts.length === 3) {
			return {
				pageNumber: sanitisePageNumber(Number(parts[0])),
				column: Number(parts[1]),
				row: Number(parts[2]),
			}
		} else {
			return null
		}
	}

	const injectedVariableValues = {
		'$(this:page)': pressLocation?.pageNumber ?? null,
		'$(this:column)': pressLocation?.column ?? null,
		'$(this:row)': pressLocation?.row ?? null,
	}

	let location = null
	let referencedVariables = []

	switch (options.location_target) {
		case 'this':
			location = {
				pageNumber: pressLocation?.pageNumber ?? null,
				column: pressLocation?.column ?? null,
				row: pressLocation?.row ?? null,
			}
			break
		case 'text':
			if (useVariableFields) {
				const result = self.instance.variable.parseVariables(options.location_text, injectedVariableValues)

				location = parseLocationString(result.text)
				referencedVariables = result.variableIds
			} else {
				location = parseLocationString(options.location_text)
			}
			break
		case 'expression':
			if (useVariableFields) {
				try {
					const result = self.instance.variable.parseExpression(
						options.location_expression,
						'string',
						injectedVariableValues
					)

					console.log('parsed', result, injectedVariableValues)

					location = parseLocationString(result.value)
					referencedVariables = result.variableIds
				} catch (error) {
					self.logger.warn(`${error.toString()}, in expression: "${options.location_expression}"`)
				}
			}
			break
	}

	return { location, referencedVariables }
}
