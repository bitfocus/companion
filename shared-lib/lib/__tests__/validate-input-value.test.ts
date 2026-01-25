import { describe, it, expect } from 'vitest'
import { validateInputValue } from '../ValidateInputValue.js'
import type {
	CompanionInputFieldStaticTextExtended,
	CompanionInputFieldTextInputExtended,
	CompanionInputFieldSecretExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldColorExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldMultiDropdownExtended,
	CompanionInputFieldCustomVariableExtended,
	CompanionInputFieldBonjourDeviceExtended,
	InternalInputFieldTime,
} from '../Model/Options.js'

describe('validateInputValue', () => {
	describe('static-text', () => {
		const definition: CompanionInputFieldStaticTextExtended = {
			id: 'test',
			type: 'static-text',
			label: 'Test',
			value: 'static text',
		}

		it('should always return undefined (not editable)', () => {
			expect(validateInputValue(definition, undefined)).toBeUndefined()
			expect(validateInputValue(definition, 'anything')).toBeUndefined()
			expect(validateInputValue(definition, 123)).toBeUndefined()
		})
	})

	describe('textinput', () => {
		describe('required validation', () => {
			const requiredDefinition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				minLength: 1,
			}

			it('should return error when required and value is undefined', () => {
				expect(validateInputValue(requiredDefinition, undefined)).toBe('A value must be provided')
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(requiredDefinition, '')).toBe('Value must be at least 1 characters long')
			})

			it('should return undefined when required and value is provided', () => {
				expect(validateInputValue(requiredDefinition, 'hello')).toBeUndefined()
			})
		})

		describe('non-required validation', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
			}

			it('should return error when value is undefined (textinput always requires a value)', () => {
				expect(validateInputValue(definition, undefined)).toBe('A value must be provided')
			})

			it('should return undefined when value is empty string and no minLength', () => {
				expect(validateInputValue(definition, '')).toBeUndefined()
			})
		})

		describe('expression validation', () => {
			const expressionDefinition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				isExpression: true,
			}

			it('should return undefined for valid expression', () => {
				expect(validateInputValue(expressionDefinition, '1 + 2')).toBeUndefined()
				expect(validateInputValue(expressionDefinition, '$(internal:a) + 1')).toBeUndefined()
			})

			it('should return error for invalid expression', () => {
				// Unclosed parentheses
				expect(validateInputValue(expressionDefinition, '(((')).toBe('Expression is not valid')
				// Unclosed string
				expect(validateInputValue(expressionDefinition, '"unclosed')).toBe('Expression is not valid')
			})
		})

		describe('regex validation', () => {
			const regexDefinition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				regex: '/^[a-z]+$/i',
			}

			it('should return undefined when value matches regex', () => {
				expect(validateInputValue(regexDefinition, 'hello')).toBeUndefined()
				expect(validateInputValue(regexDefinition, 'WORLD')).toBeUndefined()
			})

			it('should return error when value does not match regex', () => {
				expect(validateInputValue(regexDefinition, '123')).toBe('Value does not match regex: /^[a-z]+$/i')
				expect(validateInputValue(regexDefinition, 'hello123')).toBe('Value does not match regex: /^[a-z]+$/i')
			})
		})

		describe('type coercion', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				regex: '/^\\d+$/',
			}

			it('should coerce number to string for validation', () => {
				expect(validateInputValue(definition, 123)).toBeUndefined()
			})

			it('should coerce boolean to string for validation', () => {
				const boolRegex: CompanionInputFieldTextInputExtended = {
					id: 'test',
					type: 'textinput',
					label: 'Test',
					regex: '/^(true|false)$/',
				}
				expect(validateInputValue(boolRegex, true)).toBeUndefined()
				expect(validateInputValue(boolRegex, false)).toBeUndefined()
			})
		})
	})

	describe('secret-text', () => {
		describe('required validation', () => {
			const requiredDefinition: CompanionInputFieldSecretExtended = {
				id: 'test',
				type: 'secret-text',
				label: 'Test',
				minLength: 1,
			}

			it('should return error when required and value is undefined', () => {
				expect(validateInputValue(requiredDefinition, undefined)).toBe('A value must be provided')
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(requiredDefinition, '')).toBe('Value must be at least 1 characters long')
			})

			it('should return undefined when required and value is provided', () => {
				expect(validateInputValue(requiredDefinition, 'secret')).toBeUndefined()
			})
		})

		describe('regex validation', () => {
			const regexDefinition: CompanionInputFieldSecretExtended = {
				id: 'test',
				type: 'secret-text',
				label: 'Test',
				regex: '/^[A-Z0-9]{8}$/',
			}

			it('should return undefined when value matches regex', () => {
				expect(validateInputValue(regexDefinition, 'ABCD1234')).toBeUndefined()
			})

			it('should return error when value does not match regex', () => {
				expect(validateInputValue(regexDefinition, 'short')).toBe('Value does not match regex: /^[A-Z0-9]{8}$/')
			})
		})
	})

	describe('number', () => {
		const definition: CompanionInputFieldNumberExtended = {
			id: 'test',
			type: 'number',
			label: 'Test',
			default: 0,
			min: 0,
			max: 100,
		}

		describe('non-required validation', () => {
			it('should return error when required and value is undefined', () => {
				expect(validateInputValue(definition, undefined)).toBe('A value must be provided')
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(definition, '')).toBe('A value must be provided')
			})

			it('should return undefined when required and value is 0', () => {
				expect(validateInputValue(definition, 0)).toBeUndefined()
			})
		})

		describe('type coercion', () => {
			it('should accept number type directly', () => {
				expect(validateInputValue(definition, 50)).toBeUndefined()
			})

			it('should coerce string to number', () => {
				expect(validateInputValue(definition, '50')).toBeUndefined()
			})

			it('should return error for non-numeric string', () => {
				expect(validateInputValue(definition, 'abc')).toBe('Value must be a number')
			})

			it('should return error for NaN', () => {
				expect(validateInputValue(definition, NaN)).toBe('Value must be a number')
			})
		})

		describe('range validation', () => {
			it('should return undefined for value within range', () => {
				expect(validateInputValue(definition, 0)).toBeUndefined()
				expect(validateInputValue(definition, 50)).toBeUndefined()
				expect(validateInputValue(definition, 100)).toBeUndefined()
			})

			it('should return error when value is below min', () => {
				expect(validateInputValue(definition, -1)).toBe('Value must be greater than or equal to 0')
			})

			it('should return error when value is above max', () => {
				expect(validateInputValue(definition, 101)).toBe('Value must be less than or equal to 100')
			})
		})

		describe('min/max boundary cases', () => {
			const noMinDefinition: CompanionInputFieldNumberExtended = {
				id: 'test',
				type: 'number',
				label: 'Test',
				default: 0,
				min: undefined as unknown as number,
				max: 100,
			}

			const noMaxDefinition: CompanionInputFieldNumberExtended = {
				id: 'test',
				type: 'number',
				label: 'Test',
				default: 0,
				min: 0,
				max: undefined as unknown as number,
			}

			it('should not check min when undefined', () => {
				expect(validateInputValue(noMinDefinition, -1000)).toBeUndefined()
			})

			it('should not check max when undefined', () => {
				expect(validateInputValue(noMaxDefinition, 1000)).toBeUndefined()
			})
		})
	})

	describe('checkbox', () => {
		const definition: CompanionInputFieldCheckboxExtended = {
			id: 'test',
			type: 'checkbox',
			label: 'Test',
			default: false,
		}

		it('should return undefined for boolean values', () => {
			expect(validateInputValue(definition, true)).toBeUndefined()
			expect(validateInputValue(definition, false)).toBeUndefined()
		})

		it('should return undefined when value is undefined', () => {
			expect(validateInputValue(definition, undefined)).toBeUndefined()
		})

		it('should return error for non-boolean values', () => {
			expect(validateInputValue(definition, 'true')).toBe('Value must be a boolean')
			expect(validateInputValue(definition, 1)).toBe('Value must be a boolean')
			expect(validateInputValue(definition, 0)).toBe('Value must be a boolean')
			expect(validateInputValue(definition, null)).toBe('Value must be a boolean')
		})
	})

	describe('colorpicker', () => {
		describe('returnType: number', () => {
			const numberDefinition: CompanionInputFieldColorExtended = {
				id: 'test',
				type: 'colorpicker',
				label: 'Test',
				default: 0,
				returnType: 'number',
			}

			it('should return undefined for number values', () => {
				expect(validateInputValue(numberDefinition, 16777215)).toBeUndefined()
				expect(validateInputValue(numberDefinition, 0)).toBeUndefined()
			})

			it('should return undefined for numeric strings', () => {
				expect(validateInputValue(numberDefinition, '16777215')).toBeUndefined()
			})

			it('should return error for non-numeric strings', () => {
				expect(validateInputValue(numberDefinition, '#ffffff')).toBe('Value must be a number')
			})

			it('should return undefined when value is undefined', () => {
				expect(validateInputValue(numberDefinition, undefined)).toBeUndefined()
			})
		})

		describe('returnType: string (default)', () => {
			const stringDefinition: CompanionInputFieldColorExtended = {
				id: 'test',
				type: 'colorpicker',
				label: 'Test',
				default: '#000000',
			}

			it('should return undefined for string values', () => {
				expect(validateInputValue(stringDefinition, '#ffffff')).toBeUndefined()
				expect(validateInputValue(stringDefinition, 'rgb(255,255,255)')).toBeUndefined()
			})

			it('should return undefined for number values', () => {
				expect(validateInputValue(stringDefinition, 16777215)).toBeUndefined()
			})

			it('should return error for invalid types', () => {
				expect(validateInputValue(stringDefinition, true)).toBe('Value must be a string or number')
				expect(validateInputValue(stringDefinition, ['#fff'])).toBe('Value must be a string or number')
				expect(validateInputValue(stringDefinition, { color: '#fff' })).toBe('Value must be a string or number')
			})

			it('should return undefined when value is undefined', () => {
				expect(validateInputValue(stringDefinition, undefined)).toBeUndefined()
			})
		})
	})

	describe('dropdown', () => {
		const definition: CompanionInputFieldDropdownExtended = {
			id: 'test',
			type: 'dropdown',
			label: 'Test',
			default: 'option1',
			choices: [
				{ id: 'option1', label: 'Option 1' },
				{ id: 'option2', label: 'Option 2' },
				{ id: 123, label: 'Numeric Option' },
			],
		}

		it('should return error when value is undefined (strict validation)', () => {
			expect(validateInputValue(definition, undefined)).toBe('Value is not in the list of choices')
			expect(validateInputValue(definition, 'option1')).toBeUndefined()
			expect(validateInputValue(definition, 'option2')).toBeUndefined()
		})

		it('should return error when value is not in choices', () => {
			expect(validateInputValue(definition, 'option3')).toBe('Value is not in the list of choices')
		})

		describe('numeric choice ids', () => {
			it('should match number value to numeric choice id', () => {
				expect(validateInputValue(definition, 123)).toBeUndefined()
			})

			it('should not match string value to numeric choice id (strict type check)', () => {
				expect(validateInputValue(definition, '123')).toBe('Value is not in the list of choices')
			})
		})

		describe('allowCustom', () => {
			const customDefinition: CompanionInputFieldDropdownExtended = {
				...definition,
				allowCustom: true,
			}

			it('should return undefined for custom values when allowCustom is true', () => {
				expect(validateInputValue(customDefinition, 'custom_value')).toBeUndefined()
			})

			describe('with regex', () => {
				const customWithRegex: CompanionInputFieldDropdownExtended = {
					...definition,
					allowCustom: true,
					regex: '/^custom_/',
				}

				it('should return undefined when custom value matches regex', () => {
					expect(validateInputValue(customWithRegex, 'custom_value')).toBeUndefined()
				})

				it('should return error when custom value does not match regex', () => {
					expect(validateInputValue(customWithRegex, 'invalid_value')).toBe('Value does not match regex: /^custom_/')
				})

				it('should return undefined for choice values even if they do not match regex', () => {
					expect(validateInputValue(customWithRegex, 'option1')).toBeUndefined()
				})
			})
		})
	})

	describe('multidropdown', () => {
		const definition: CompanionInputFieldMultiDropdownExtended = {
			id: 'test',
			type: 'multidropdown',
			label: 'Test',
			default: [],
			choices: [
				{ id: 'option1', label: 'Option 1' },
				{ id: 'option2', label: 'Option 2' },
				{ id: 'option3', label: 'Option 3' },
				{ id: 123, label: 'Numeric Option' },
			],
		}

		it('should return undefined when value is undefined', () => {
			expect(validateInputValue(definition, undefined)).toBeUndefined()
		})

		it('should return error when value is not an array', () => {
			expect(validateInputValue(definition, 'option1')).toBe('Value must be an array')
			expect(validateInputValue(definition, 123)).toBe('Value must be an array')
			expect(validateInputValue(definition, { option1: true })).toBe('Value must be an array')
		})

		it('should return undefined for empty array', () => {
			expect(validateInputValue(definition, [])).toBeUndefined()
		})

		it('should return undefined when all values are in choices', () => {
			expect(validateInputValue(definition, ['option1'])).toBeUndefined()
			expect(validateInputValue(definition, ['option1', 'option2'])).toBeUndefined()
			expect(validateInputValue(definition, ['option1', 'option2', 'option3'])).toBeUndefined()
		})

		it('should return error when any value is not in choices', () => {
			expect(validateInputValue(definition, ['option1', 'invalid'])).toBe('Value is not in the list of choices')
		})

		describe('numeric choice ids', () => {
			it('should match number value to numeric choice id', () => {
				expect(validateInputValue(definition, [123])).toBeUndefined()
				expect(validateInputValue(definition, ['option1', 123])).toBeUndefined()
			})

			it('should not match string value to numeric choice id (strict type check)', () => {
				expect(validateInputValue(definition, ['123'])).toBe('Value is not in the list of choices')
			})
		})

		describe('minSelection/maxSelection', () => {
			const constrainedDefinition: CompanionInputFieldMultiDropdownExtended = {
				...definition,
				minSelection: 1,
				maxSelection: 2,
			}

			it('should return error when selection count is below minSelection', () => {
				expect(validateInputValue(constrainedDefinition, [])).toBe('Must select at least 1 items')
			})

			it('should return error when selection count is above maxSelection', () => {
				expect(validateInputValue(constrainedDefinition, ['option1', 'option2', 'option3'])).toBe(
					'Must select at most 2 items'
				)
			})

			it('should return undefined when selection count is within range', () => {
				expect(validateInputValue(constrainedDefinition, ['option1'])).toBeUndefined()
				expect(validateInputValue(constrainedDefinition, ['option1', 'option2'])).toBeUndefined()
			})
		})

		describe('allowCustom', () => {
			const customDefinition: CompanionInputFieldMultiDropdownExtended = {
				...definition,
				allowCustom: true,
			}

			it('should return undefined for custom values when allowCustom is true', () => {
				expect(validateInputValue(customDefinition, ['custom_value'])).toBeUndefined()
				expect(validateInputValue(customDefinition, ['option1', 'custom_value'])).toBeUndefined()
			})

			describe('with regex', () => {
				const customWithRegex: CompanionInputFieldMultiDropdownExtended = {
					...definition,
					allowCustom: true,
					regex: '/^custom_/',
				}

				it('should return undefined when custom value matches regex', () => {
					expect(validateInputValue(customWithRegex, ['custom_value'])).toBeUndefined()
				})

				it('should return error when custom value does not match regex', () => {
					expect(validateInputValue(customWithRegex, ['invalid_value'])).toBe('Value does not match regex: /^custom_/')
				})

				it('should return undefined for choice values even if they do not match regex', () => {
					expect(validateInputValue(customWithRegex, ['option1'])).toBeUndefined()
				})
			})
		})
	})

	describe('bonjour-device', () => {
		const definition: CompanionInputFieldBonjourDeviceExtended = {
			id: 'test',
			type: 'bonjour-device',
			label: 'Test',
		}

		it('should always return undefined', () => {
			expect(validateInputValue(definition, undefined)).toBeUndefined()
			expect(validateInputValue(definition, 'device-id')).toBeUndefined()
			expect(validateInputValue(definition, 123)).toBeUndefined()
		})
	})

	describe('custom-variable', () => {
		const definition: CompanionInputFieldCustomVariableExtended = {
			id: 'test',
			type: 'custom-variable',
			label: 'Test',
		}

		it('should always return undefined', () => {
			expect(validateInputValue(definition, undefined)).toBeUndefined()
			expect(validateInputValue(definition, 'var-name')).toBeUndefined()
			expect(validateInputValue(definition, 123)).toBeUndefined()
		})
	})

	describe('internal fields', () => {
		const internalTypes = [
			'internal:connection_id',
			'internal:connection_collection',
			'internal:custom_variable',
			'internal:date',
			'internal:page',
			'internal:surface_serial',
			'internal:time',
			'internal:variable',
			'internal:trigger',
			'internal:trigger_collection',
		] as const

		it.each(internalTypes)('should always return undefined for %s', (type) => {
			const definition: InternalInputFieldTime = {
				id: 'test',
				type: type as 'internal:time',
				label: 'Test',
			}

			expect(validateInputValue(definition, undefined)).toBeUndefined()
			expect(validateInputValue(definition, 'any-value')).toBeUndefined()
			expect(validateInputValue(definition, 123)).toBeUndefined()
		})
	})

	describe('edge cases', () => {
		it('should handle null value for textinput', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				regex: '/^.+$/',
			}
			// null triggers the undefined/null check before regex validation
			expect(validateInputValue(definition, null)).toBe('A value must be provided')
		})

		it('should not coerce object values for dropdown comparison (strict type check)', () => {
			// Objects are compared by reference using isEqual, not coerced to strings
			const definition: CompanionInputFieldDropdownExtended = {
				id: 'test',
				type: 'dropdown',
				label: 'Test',
				default: 'option1',
				choices: [{ id: '{"some":"object"}', label: 'Object String' }],
			}
			expect(validateInputValue(definition, { some: 'object' })).toBe('Value is not in the list of choices')
		})

		it('should handle array value in textinput', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
			}
			expect(validateInputValue(definition, [1, 2, 3])).toBeUndefined()
		})
	})
})
