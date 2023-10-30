import { oldBankIndexToXY } from '../Shared/ControlId.js'

/**
 *
 * @param {import('winston').Logger} logger
 * @param {import('../Instance/Variable.js').default} variablesController
 * @param {import('../Resources/Util.js').ControlLocation | undefined} pressLocation
 * @param {Record<string, any>} options
 * @param {boolean} useVariableFields
 * @returns {{ location: import('../Resources/Util.js').ControlLocation | null, referencedVariables: string[] }}
 */
export function ParseInternalControlReference(logger, variablesController, pressLocation, options, useVariableFields) {
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

	/**
	 * @param {string | undefined} str
	 * @returns {import('../Resources/Util.js').ControlLocation | null}
	 */
	const parseLocationString = (str) => {
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
				const result = variablesController.parseVariables(options.location_text, injectedVariableValues)

				location = parseLocationString(result.text)
				referencedVariables = result.variableIds
			} else {
				location = parseLocationString(options.location_text)
			}
			break
		case 'expression':
			if (useVariableFields) {
				try {
					const result = variablesController.parseExpression(
						options.location_expression,
						'string',
						injectedVariableValues
					)

					location = parseLocationString(String(result.value))
					referencedVariables = Array.from(result.variableIds)
				} catch (/** @type {any} */ error) {
					logger.warn(`${error.toString()}, in expression: "${options.location_expression}"`)
				}
			}
			break
	}

	return { location, referencedVariables }
}
