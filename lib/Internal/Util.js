import { oldBankIndexToXY } from '../Shared/ControlId.js'

export function ParseInternalControlReference(self, pressLocation, options, useVariableFields) {
	const parseLocationString = (str) => {
		if (!str) return null

		const parts = str.split('/') // TODO - more chars

		// TODO - this is horrible, and needs reworking to be simpler

		if (parts.length === 1 && parts[0].startsWith('b')) {
			// Legacy bank id
			const xy = oldBankIndexToXY(Number(parts[0].slice(1)))
			if (xy) {
				return {
					pageNumber: pressLocation?.pageNumber ?? null,
					column: xy[0],
					row: xy[1],
				}
			} else {
				return null
			}
		} else if (parts.length === 2) {
			if (parts[1].startsWith('b')) {
				// Legacy bank id
				const xy = oldBankIndexToXY(Number(parts[1].slice(1)))
				if (xy) {
					return {
						pageNumber: Number(parts[0]),
						column: xy[0],
						row: xy[1],
					}
				} else {
					return null
				}
			} else {
				return {
					pageNumber: pressLocation?.pageNumber ?? null,
					column: Number(parts[0]),
					row: Number(parts[1]),
				}
			}
		} else if (parts.length === 3) {
			return {
				pageNumber: Number(parts[0]),
				column: Number(parts[1]),
				row: Number(parts[2]),
			}
		} else {
			return null
		}
	}

	const injectedVariableValues = {
		'this:page': pressLocation?.pageNumber ?? null,
		'this:column': pressLocation?.column ?? null,
		'this:row': pressLocation?.row ?? null,
	}

	let location = null
	let referencedVariables = []

	switch (options.target) {
		case 'this':
			location = {
				pageNumber: pressLocation?.pageNumber ?? null,
				column: pressLocation?.column ?? null,
				row: pressLocation?.row ?? null,
			}
			break
		case 'text':
			if (useVariableFields) {
				const result = self.instance.variable.parseVariables(options.text, injectedVariableValues)

				location = parseLocationString(result.text)
				referencedVariables = result.variableIds
			} else {
				location = parseLocationString(options.text)
			}
			break
		case 'expression':
			if (useVariableFields) {
				try {
					const result = self.instance.variable.parseExpression(options.expression, 'string', injectedVariableValues)

					location = parseLocationString(result.value)
					referencedVariables = result.variableIds
				} catch (error) {
					self.logger.warn(`${error.toString()}, in expression: "${options.expression}"`)
				}
			}
			break
	}

	return { location, referencedVariables }
}
