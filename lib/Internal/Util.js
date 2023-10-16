import { oldBankIndexToXY } from '../Shared/ControlId.js'

/**
 *
 * @param {*} self
 * @param {import('../Resources/Util.js').ControlLocation | undefined} pressLocation
 * @param {Record<string, any>} options
 * @param {boolean} useVariableFields
 * @returns {{ location: import('../Resources/Util.js').ControlLocation | null, referencedVariables: string[] }}
 */
export function ParseInternalControlReference(self, pressLocation, options, useVariableFields) {
	/**
	 * @param {number} pageNumber
	 * @returns {number | null}
	 */
	const sanitisePageNumber = (pageNumber) => {
		return pageNumber == 0 ? pressLocation?.pageNumber ?? null : pageNumber
	}
	/**
	 * @param {number} pageNumber
	 * @param {string} str
	 * @returns {import('../Resources/Util.js').ControlLocation | null}
	 */
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

	/**
	 * @param {string | undefined} str
	 * @returns {import('../Resources/Util.js').ControlLocation | null}
	 */
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
					column: Number(parts[1]),
					row: Number(parts[0]),
				}
			}
		} else if (parts.length === 3) {
			return {
				pageNumber: sanitisePageNumber(Number(parts[0])),
				column: Number(parts[2]),
				row: Number(parts[1]),
			}
		} else {
			return null
		}
	}

	/** @type {import('@companion-module/base').CompanionVariableValues} */
	const injectedVariableValues = {
		'$(this:page)': pressLocation?.pageNumber,
		'$(this:column)': pressLocation?.column,
		'$(this:row)': pressLocation?.row,
	}

	/** @type {import('../Resources/Util.js').ControlLocation | null} */
	let location = null
	/** @type {string[]} */
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

					location = parseLocationString(result.value)
					referencedVariables = result.variableIds
				} catch (/** @type {any} */ error) {
					self.logger.warn(`${error.toString()}, in expression: "${options.location_expression}"`)
				}
			}
			break
	}

	return { location, referencedVariables }
}
