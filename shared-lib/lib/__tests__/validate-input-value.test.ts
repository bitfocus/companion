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
	CompanionInputFieldExpressionExtended,
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
			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
			})
			expect(validateInputValue(definition, 'anything')).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
			})
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
				expect(validateInputValue(requiredDefinition, undefined)).toEqual({
					sanitisedValue: '',
					validationError: 'Value must be at least 1 characters long',
				})
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(requiredDefinition, '')).toEqual({
					sanitisedValue: '',
					validationError: 'Value must be at least 1 characters long',
				})
			})

			it('should return undefined when required and value is provided', () => {
				expect(validateInputValue(requiredDefinition, 'hello')).toEqual({
					sanitisedValue: 'hello',
					validationError: undefined,
				})
			})
		})

		describe('non-required validation', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
			}

			it('should return undefined when value is undefined', () => {
				expect(validateInputValue(definition, undefined)).toEqual({
					sanitisedValue: '',
					validationError: undefined,
				})
			})

			it('should return undefined when value is empty string and no minLength', () => {
				expect(validateInputValue(definition, '')).toEqual({
					sanitisedValue: '',
					validationError: undefined,
				})
			})
		})

		describe('expression validation', () => {
			const expressionDefinition: CompanionInputFieldExpressionExtended = {
				id: 'test',
				type: 'expression',
				label: 'Test',
			}

			it('should return undefined for valid expression', () => {
				expect(validateInputValue(expressionDefinition, '1 + 2')).toEqual({
					sanitisedValue: '1 + 2',
					validationError: undefined,
				})
				expect(validateInputValue(expressionDefinition, '$(internal:a) + 1')).toEqual({
					sanitisedValue: '$(internal:a) + 1',
					validationError: undefined,
				})
			})

			it('should return error for invalid expression', () => {
				// Unclosed parentheses
				expect(validateInputValue(expressionDefinition, '(((')).toEqual({
					sanitisedValue: '(((',
					validationError: 'Expression is not valid',
				})
				// Unclosed string
				expect(validateInputValue(expressionDefinition, '"unclosed')).toEqual({
					sanitisedValue: '"unclosed',
					validationError: 'Expression is not valid',
				})
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
				expect(validateInputValue(regexDefinition, 'hello')).toEqual({
					sanitisedValue: 'hello',
					validationError: undefined,
				})
				expect(validateInputValue(regexDefinition, 'WORLD')).toEqual({
					sanitisedValue: 'WORLD',
					validationError: undefined,
				})
			})

			it('should return error when value does not match regex', () => {
				expect(validateInputValue(regexDefinition, '123')).toEqual({
					sanitisedValue: '123',
					validationError: 'Value does not match regex: /^[a-z]+$/i',
				})
				expect(validateInputValue(regexDefinition, 'hello123')).toEqual({
					sanitisedValue: 'hello123',
					validationError: 'Value does not match regex: /^[a-z]+$/i',
				})
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
				expect(validateInputValue(definition, 123)).toEqual({
					sanitisedValue: '123',
					validationError: undefined,
				})
			})

			it('should coerce boolean to string for validation', () => {
				const boolRegex: CompanionInputFieldTextInputExtended = {
					id: 'test',
					type: 'textinput',
					label: 'Test',
					regex: '/^(true|false)$/',
				}
				expect(validateInputValue(boolRegex, true)).toEqual({
					sanitisedValue: 'true',
					validationError: undefined,
				})
				expect(validateInputValue(boolRegex, false)).toEqual({
					sanitisedValue: 'false',
					validationError: undefined,
				})
			})

			it('should coerce array to string', () => {
				const arrayTest: CompanionInputFieldTextInputExtended = {
					id: 'test',
					type: 'textinput',
					label: 'Test',
				}
				// Arrays are stringified using JSON.stringify (note the format [1,2,3] not 1,2,3)
				expect(validateInputValue(arrayTest, [1, 2, 3])).toEqual({
					sanitisedValue: '[1,2,3]',
					validationError: undefined,
				})
			})

			it('should coerce null to empty string', () => {
				const nullTest: CompanionInputFieldTextInputExtended = {
					id: 'test',
					type: 'textinput',
					label: 'Test',
					regex: '/^.+$/', // Requires at least one character
				}
				expect(validateInputValue(nullTest, null)).toEqual({
					sanitisedValue: '',
					validationError: 'Value does not match regex: /^.+$/',
				})
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
				expect(validateInputValue(requiredDefinition, undefined)).toEqual({
					sanitisedValue: '',
					validationError: 'Value must be at least 1 characters long',
				})
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(requiredDefinition, '')).toEqual({
					sanitisedValue: '',
					validationError: 'Value must be at least 1 characters long',
				})
			})

			it('should return undefined when required and value is provided', () => {
				expect(validateInputValue(requiredDefinition, 'secret')).toEqual({
					sanitisedValue: 'secret',
					validationError: undefined,
				})
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
				expect(validateInputValue(regexDefinition, 'ABCD1234')).toEqual({
					sanitisedValue: 'ABCD1234',
					validationError: undefined,
				})
			})

			it('should return error when value does not match regex', () => {
				expect(validateInputValue(regexDefinition, 'short')).toEqual({
					sanitisedValue: 'short',
					validationError: 'Value does not match regex: /^[A-Z0-9]{8}$/',
				})
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
				expect(validateInputValue(definition, undefined)).toEqual({
					sanitisedValue: undefined,
					validationError: 'A value must be provided',
				})
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(definition, '')).toEqual({
					sanitisedValue: '',
					validationError: 'A value must be provided',
				})
			})

			// Potential bug: null is treated as missing value
			it('should return error when required and value is null', () => {
				expect(validateInputValue(definition, null)).toEqual({
					sanitisedValue: null,
					validationError: 'A value must be provided',
				})
			})

			it('should return undefined when required and value is 0', () => {
				expect(validateInputValue(definition, 0)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
				})
			})
		})

		describe('type coercion', () => {
			it('should accept number type directly', () => {
				expect(validateInputValue(definition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
				})
			})

			it('should coerce string to number', () => {
				expect(validateInputValue(definition, '50')).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
				})
			})

			it('should return error for non-numeric string', () => {
				expect(validateInputValue(definition, 'abc')).toEqual({
					sanitisedValue: 'abc',
					validationError: 'Value must be a number',
				})
			})

			it('should return error for NaN', () => {
				expect(validateInputValue(definition, NaN)).toEqual({
					sanitisedValue: NaN,
					validationError: 'Value must be a number',
				})
			})

			it('should coerce boolean to number', () => {
				expect(validateInputValue(definition, true)).toEqual({
					sanitisedValue: 1,
					validationError: undefined,
				})
				expect(validateInputValue(definition, false)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
				})
			})
		})

		describe('range validation', () => {
			it('should return undefined for value within range', () => {
				expect(validateInputValue(definition, 0)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
				})
				expect(validateInputValue(definition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
				})
				expect(validateInputValue(definition, 100)).toEqual({
					sanitisedValue: 100,
					validationError: undefined,
				})
			})

			it('should return error when value is below min', () => {
				expect(validateInputValue(definition, -1)).toEqual({
					sanitisedValue: -1,
					validationError: 'Value must be greater than or equal to 0',
				})
			})

			it('should return error when value is above max', () => {
				expect(validateInputValue(definition, 101)).toEqual({
					sanitisedValue: 101,
					validationError: 'Value must be less than or equal to 100',
				})
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
				expect(validateInputValue(noMinDefinition, -1000)).toEqual({
					sanitisedValue: -1000,
					validationError: undefined,
				})
			})

			it('should not check max when undefined', () => {
				expect(validateInputValue(noMaxDefinition, 1000)).toEqual({
					sanitisedValue: 1000,
					validationError: undefined,
				})
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
			expect(validateInputValue(definition, true)).toEqual({
				sanitisedValue: true,
				validationError: undefined,
			})
			expect(validateInputValue(definition, false)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
			})
		})

		it('should return undefined when value is undefined and coerce to false', () => {
			// Sanitised value is coerced to false
			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
			})
		})

		it('should coerce for non-boolean values', () => {
			expect(validateInputValue(definition, 'true')).toEqual({
				sanitisedValue: true,
				validationError: undefined,
			})
			expect(validateInputValue(definition, 1)).toEqual({
				sanitisedValue: true,
				validationError: undefined,
			})
			expect(validateInputValue(definition, 0)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
			})
			expect(validateInputValue(definition, null)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
			})
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
				expect(validateInputValue(numberDefinition, 16777215)).toEqual({
					sanitisedValue: 16777215,
					validationError: undefined,
				})
				expect(validateInputValue(numberDefinition, 0)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
				})
			})

			it('should return undefined for numeric strings', () => {
				expect(validateInputValue(numberDefinition, '16777215')).toEqual({
					sanitisedValue: '16777215',
					validationError: undefined,
				})
			})

			it('should return error for non-numeric strings', () => {
				expect(validateInputValue(numberDefinition, '#ffffff')).toEqual({
					sanitisedValue: '#ffffff',
					validationError: 'Value must be a number',
				})
			})

			it('should return error when value is undefined', () => {
				expect(validateInputValue(numberDefinition, undefined)).toEqual({
					sanitisedValue: undefined,
					validationError: 'Value must be a number',
				})
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
				expect(validateInputValue(stringDefinition, '#ffffff')).toEqual({
					sanitisedValue: '#ffffff',
					validationError: undefined,
				})
				expect(validateInputValue(stringDefinition, 'rgb(255,255,255)')).toEqual({
					sanitisedValue: 'rgb(255,255,255)',
					validationError: undefined,
				})
			})

			it('should return undefined for number values', () => {
				expect(validateInputValue(stringDefinition, 16777215)).toEqual({
					sanitisedValue: 16777215,
					validationError: undefined,
				})
			})

			it('should return error for invalid types', () => {
				expect(validateInputValue(stringDefinition, true)).toEqual({
					sanitisedValue: true,
					validationError: 'Value must be a string or number',
				})
				expect(validateInputValue(stringDefinition, ['#fff'])).toEqual({
					sanitisedValue: ['#fff'],
					validationError: 'Value must be a string or number',
				})
				expect(validateInputValue(stringDefinition, { color: '#fff' })).toEqual({
					sanitisedValue: { color: '#fff' },
					validationError: 'Value must be a string or number',
				})
			})

			it('should return error when value is undefined', () => {
				expect(validateInputValue(stringDefinition, undefined)).toEqual({
					sanitisedValue: undefined,
					validationError: 'Value must be a string or number',
				})
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
			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: '',
				validationError: 'Value is not in the list of choices',
			})
		})

		it('should return undefined when value is in choices', () => {
			expect(validateInputValue(definition, 'option1')).toEqual({
				sanitisedValue: 'option1',
				validationError: undefined,
			})
			expect(validateInputValue(definition, 'option2')).toEqual({
				sanitisedValue: 'option2',
				validationError: undefined,
			})
		})

		it('should return error when value is not in choices', () => {
			expect(validateInputValue(definition, 'option3')).toEqual({
				sanitisedValue: 'option3',
				validationError: 'Value is not in the list of choices',
			})
		})

		describe('numeric choice ids', () => {
			it('should match number value to numeric choice id', () => {
				expect(validateInputValue(definition, 123)).toEqual({
					sanitisedValue: 123,
					validationError: undefined,
				})
			})

			it('should match string value to numeric choice id via loose comparison', () => {
				expect(validateInputValue(definition, '123')).toEqual({
					sanitisedValue: 123,
					validationError: undefined,
				})
			})
		})

		describe('allowCustom', () => {
			const customDefinition: CompanionInputFieldDropdownExtended = {
				...definition,
				allowCustom: true,
			}

			it('should return undefined for custom values when allowCustom is true', () => {
				expect(validateInputValue(customDefinition, 'custom_value')).toEqual({
					sanitisedValue: 'custom_value',
					validationError: undefined,
				})
			})

			it('should stringify non-choice values when allowCustom is true', () => {
				expect(validateInputValue(customDefinition, 999)).toEqual({
					sanitisedValue: '999',
					validationError: undefined,
				})
			})

			describe('with regex', () => {
				const customWithRegex: CompanionInputFieldDropdownExtended = {
					...definition,
					allowCustom: true,
					regex: '/^custom_/',
				}

				it('should return undefined when custom value matches regex', () => {
					expect(validateInputValue(customWithRegex, 'custom_value')).toEqual({
						sanitisedValue: 'custom_value',
						validationError: undefined,
					})
				})

				it('should return error when custom value does not match regex', () => {
					expect(validateInputValue(customWithRegex, 'invalid_value')).toEqual({
						sanitisedValue: 'invalid_value',
						validationError: 'Value does not match regex: /^custom_/',
					})
				})

				it('should return undefined for choice values even if they do not match regex', () => {
					expect(validateInputValue(customWithRegex, 'option1')).toEqual({
						sanitisedValue: 'option1',
						validationError: undefined,
					})
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

		it('should return undefined when value is undefined and sanitise to empty array', () => {
			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: [],
				validationError: undefined,
			})
		})

		it('should return error when value is not an array', () => {
			expect(validateInputValue(definition, 'option1')).toEqual({
				sanitisedValue: 'option1',
				validationError: 'Value must be an array',
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: 123,
				validationError: 'Value must be an array',
			})
			expect(validateInputValue(definition, { option1: true })).toEqual({
				sanitisedValue: { option1: true },
				validationError: 'Value must be an array',
			})
		})

		it('should return undefined for empty array', () => {
			expect(validateInputValue(definition, [])).toEqual({
				sanitisedValue: [],
				validationError: undefined,
			})
		})

		it('should return undefined when all values are in choices', () => {
			expect(validateInputValue(definition, ['option1'])).toEqual({
				sanitisedValue: ['option1'],
				validationError: undefined,
			})
			expect(validateInputValue(definition, ['option1', 'option2'])).toEqual({
				sanitisedValue: ['option1', 'option2'],
				validationError: undefined,
			})
			expect(validateInputValue(definition, ['option1', 'option2', 'option3'])).toEqual({
				sanitisedValue: ['option1', 'option2', 'option3'],
				validationError: undefined,
			})
		})

		it('should return error when any value is not in choices', () => {
			expect(validateInputValue(definition, ['option1', 'invalid'])).toEqual({
				sanitisedValue: ['option1', 'invalid'],
				validationError: 'The following selected values are not valid: invalid',
			})
		})

		describe('numeric choice ids', () => {
			it('should match number value to numeric choice id', () => {
				expect(validateInputValue(definition, [123])).toEqual({
					sanitisedValue: [123],
					validationError: undefined,
				})
				expect(validateInputValue(definition, ['option1', 123])).toEqual({
					sanitisedValue: ['option1', 123],
					validationError: undefined,
				})
			})

			it('should match string value to numeric choice id (loose type check)', () => {
				expect(validateInputValue(definition, ['123'])).toEqual({
					sanitisedValue: [123],
					validationError: undefined,
				})
			})
		})

		describe('minSelection/maxSelection', () => {
			const constrainedDefinition: CompanionInputFieldMultiDropdownExtended = {
				...definition,
				minSelection: 1,
				maxSelection: 2,
			}

			it('should return error when selection count is below minSelection', () => {
				expect(validateInputValue(constrainedDefinition, [])).toEqual({
					sanitisedValue: [],
					validationError: 'Must select at least 1 items',
				})
			})

			it('should return error when selection count is above maxSelection', () => {
				expect(validateInputValue(constrainedDefinition, ['option1', 'option2', 'option3'])).toEqual({
					sanitisedValue: ['option1', 'option2', 'option3'],
					validationError: 'Must select at most 2 items',
				})
			})

			it('should return undefined when selection count is within range', () => {
				expect(validateInputValue(constrainedDefinition, ['option1'])).toEqual({
					sanitisedValue: ['option1'],
					validationError: undefined,
				})
				expect(validateInputValue(constrainedDefinition, ['option1', 'option2'])).toEqual({
					sanitisedValue: ['option1', 'option2'],
					validationError: undefined,
				})
			})
		})

		describe('allowCustom', () => {
			const customDefinition: CompanionInputFieldMultiDropdownExtended = {
				...definition,
				allowCustom: true,
			}

			it('should return undefined for custom values when allowCustom is true', () => {
				expect(validateInputValue(customDefinition, ['custom_value'])).toEqual({
					sanitisedValue: ['custom_value'],
					validationError: undefined,
				})
				expect(validateInputValue(customDefinition, ['option1', 'custom_value'])).toEqual({
					sanitisedValue: ['option1', 'custom_value'],
					validationError: undefined,
				})
			})

			it('should stringify custom non-choice values', () => {
				expect(validateInputValue(customDefinition, [999])).toEqual({
					sanitisedValue: ['999'],
					validationError: undefined,
				})
			})

			describe('with regex', () => {
				const customWithRegex: CompanionInputFieldMultiDropdownExtended = {
					...definition,
					allowCustom: true,
					regex: '/^custom_/',
				}

				it('should return undefined when custom value matches regex', () => {
					expect(validateInputValue(customWithRegex, ['custom_value'])).toEqual({
						sanitisedValue: ['custom_value'],
						validationError: undefined,
					})
				})

				it('should return error when custom value does not match regex', () => {
					// Multidropdown returns original value when invalid
					expect(validateInputValue(customWithRegex, ['invalid_value'])).toEqual({
						sanitisedValue: ['invalid_value'],
						validationError: 'The following selected values are not valid: invalid_value',
					})
				})

				it('should return undefined for choice values even if they do not match regex', () => {
					expect(validateInputValue(customWithRegex, ['option1'])).toEqual({
						sanitisedValue: ['option1'],
						validationError: undefined,
					})
				})

				// Multidropdown returns original value array when any value is invalid
				it('should correctly report multiple invalid values', () => {
					expect(validateInputValue(customWithRegex, ['invalid1', 'option1', 'invalid2'])).toEqual({
						sanitisedValue: ['invalid1', 'option1', 'invalid2'],
						validationError: 'The following selected values are not valid: invalid1, invalid2',
					})
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
			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
			})
			expect(validateInputValue(definition, 'device-id')).toEqual({
				sanitisedValue: 'device-id',
				validationError: undefined,
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: 123,
				validationError: undefined,
			})
		})
	})

	describe('custom-variable', () => {
		const definition: CompanionInputFieldCustomVariableExtended = {
			id: 'test',
			type: 'custom-variable',
			label: 'Test',
		}

		it('should always return undefined', () => {
			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
			})
			expect(validateInputValue(definition, 'var-name')).toEqual({
				sanitisedValue: 'var-name',
				validationError: undefined,
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: 123,
				validationError: undefined,
			})
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

			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
			})
			expect(validateInputValue(definition, 'any-value')).toEqual({
				sanitisedValue: 'any-value',
				validationError: undefined,
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: 123,
				validationError: undefined,
			})
		})
	})

	describe('sanitization edge cases and potential bugs', () => {
		it('should handle object values in dropdown', () => {
			const definition: CompanionInputFieldDropdownExtended = {
				id: 'test',
				type: 'dropdown',
				label: 'Test',
				default: 'option1',
				choices: [{ id: '{"some":"object"}', label: 'Object String' }],
			}
			// Objects are stringified using JSON.stringify, not toString
			expect(validateInputValue(definition, { some: 'object' })).toEqual({
				sanitisedValue: '{"some":"object"}',
				validationError: 'Value is not in the list of choices',
			})
		})

		it('should handle very large numbers', () => {
			const definition: CompanionInputFieldNumberExtended = {
				id: 'test',
				type: 'number',
				label: 'Test',
				default: 0,
				min: -Infinity,
				max: Infinity,
			}
			expect(validateInputValue(definition, Number.MAX_SAFE_INTEGER)).toEqual({
				sanitisedValue: Number.MAX_SAFE_INTEGER,
				validationError: undefined,
			})
			expect(validateInputValue(definition, Infinity)).toEqual({
				sanitisedValue: Infinity,
				validationError: undefined,
			})
		})

		it('should handle empty regex pattern', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				regex: '',
			}
			// Empty regex should be ignored
			expect(validateInputValue(definition, 'anything')).toEqual({
				sanitisedValue: 'anything',
				validationError: undefined,
			})
		})

		it('should handle invalid regex pattern', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				regex: 'invalid-regex', // Not in /pattern/flags format
			}
			// Invalid regex should be ignored (compileRegex returns null)
			expect(validateInputValue(definition, 'anything')).toEqual({
				sanitisedValue: 'anything',
				validationError: undefined,
			})
		})

		it('should handle malformed regex with unclosed bracket', () => {
			const definition: CompanionInputFieldTextInputExtended = {
				id: 'test',
				type: 'textinput',
				label: 'Test',
				regex: '/[unclosed/', // Malformed pattern
			}
			// Malformed regex compilation fails, returns null, so no validation
			expect(validateInputValue(definition, 'anything')).toEqual({
				sanitisedValue: 'anything',
				validationError: undefined,
			})
		})
	})
})
