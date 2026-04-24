import { describe, expect, it } from 'vitest'
import type {
	CompanionInputFieldBonjourDeviceExtended,
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldColorExtended,
	CompanionInputFieldCustomVariableExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldExpressionExtended,
	CompanionInputFieldMultiDropdownExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldSecretExtended,
	CompanionInputFieldStaticTextExtended,
	CompanionInputFieldTextInputExtended,
	InternalInputFieldTime,
} from '../Model/Options.js'
import { validateInputValue } from '../ValidateInputValue.js'

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
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 'anything')).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: undefined,
				validationError: undefined,
				validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(requiredDefinition, '')).toEqual({
					sanitisedValue: '',
					validationError: 'Value must be at least 1 characters long',
					validationWarnings: [],
				})
			})

			it('should return undefined when required and value is provided', () => {
				expect(validateInputValue(requiredDefinition, 'hello')).toEqual({
					sanitisedValue: 'hello',
					validationError: undefined,
					validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should return undefined when value is empty string and no minLength', () => {
				expect(validateInputValue(definition, '')).toEqual({
					sanitisedValue: '',
					validationError: undefined,
					validationWarnings: [],
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
					validationWarnings: [],
				})
				expect(validateInputValue(expressionDefinition, '$(internal:a) + 1')).toEqual({
					sanitisedValue: '$(internal:a) + 1',
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return error for invalid expression', () => {
				// Unclosed parentheses
				expect(validateInputValue(expressionDefinition, '(((')).toEqual({
					sanitisedValue: '(((',
					validationError: 'Expression is not valid',
					validationWarnings: [],
				})
				// Unclosed string
				expect(validateInputValue(expressionDefinition, '"unclosed')).toEqual({
					sanitisedValue: '"unclosed',
					validationError: 'Expression is not valid',
					validationWarnings: [],
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
					validationWarnings: [],
				})
				expect(validateInputValue(regexDefinition, 'WORLD')).toEqual({
					sanitisedValue: 'WORLD',
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return error when value does not match regex', () => {
				expect(validateInputValue(regexDefinition, '123')).toEqual({
					sanitisedValue: '123',
					validationError: 'Value does not match regex: /^[a-z]+$/i',
					validationWarnings: [],
				})
				expect(validateInputValue(regexDefinition, 'hello123')).toEqual({
					sanitisedValue: 'hello123',
					validationError: 'Value does not match regex: /^[a-z]+$/i',
					validationWarnings: [],
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
					validationWarnings: [],
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
					validationWarnings: [],
				})
				expect(validateInputValue(boolRegex, false)).toEqual({
					sanitisedValue: 'false',
					validationError: undefined,
					validationWarnings: [],
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
					validationWarnings: [],
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
					validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(requiredDefinition, '')).toEqual({
					sanitisedValue: '',
					validationError: 'Value must be at least 1 characters long',
					validationWarnings: [],
				})
			})

			it('should return undefined when required and value is provided', () => {
				expect(validateInputValue(requiredDefinition, 'secret')).toEqual({
					sanitisedValue: 'secret',
					validationError: undefined,
					validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should return error when value does not match regex', () => {
				expect(validateInputValue(regexDefinition, 'short')).toEqual({
					sanitisedValue: 'short',
					validationError: 'Value does not match regex: /^[A-Z0-9]{8}$/',
					validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should return error when required and value is empty string', () => {
				expect(validateInputValue(definition, '')).toEqual({
					sanitisedValue: '',
					validationError: 'A value must be provided',
					validationWarnings: [],
				})
			})

			// Potential bug: null is treated as missing value
			it('should return error when required and value is null', () => {
				expect(validateInputValue(definition, null)).toEqual({
					sanitisedValue: null,
					validationError: 'A value must be provided',
					validationWarnings: [],
				})
			})

			it('should return undefined when required and value is 0', () => {
				expect(validateInputValue(definition, 0)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: [],
				})
			})
		})

		describe('type coercion', () => {
			it('should accept number type directly', () => {
				expect(validateInputValue(definition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should coerce string to number', () => {
				expect(validateInputValue(definition, '50')).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return error for non-numeric string', () => {
				expect(validateInputValue(definition, 'abc')).toEqual({
					sanitisedValue: 'abc',
					validationError: 'Value must be a number',
					validationWarnings: [],
				})
			})

			it('should return error for NaN', () => {
				expect(validateInputValue(definition, NaN)).toEqual({
					sanitisedValue: NaN,
					validationError: 'Value must be a number',
					validationWarnings: [],
				})
			})

			it('should coerce boolean to number', () => {
				expect(validateInputValue(definition, true)).toEqual({
					sanitisedValue: 1,
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(definition, false)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: [],
				})
			})
		})

		describe('range validation', () => {
			it('should return undefined for value within range', () => {
				expect(validateInputValue(definition, 0)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(definition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(definition, 100)).toEqual({
					sanitisedValue: 100,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return error when value is below min', () => {
				expect(validateInputValue(definition, -1)).toEqual({
					sanitisedValue: -1,
					validationError: 'Value must be greater than or equal to 0',
					validationWarnings: [],
				})
			})

			it('should return error when value is above max', () => {
				expect(validateInputValue(definition, 101)).toEqual({
					sanitisedValue: 101,
					validationError: 'Value must be less than or equal to 100',
					validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should not check max when undefined', () => {
				expect(validateInputValue(noMaxDefinition, 1000)).toEqual({
					sanitisedValue: 1000,
					validationError: undefined,
					validationWarnings: [],
				})
			})
		})

		describe('clampValues', () => {
			const definition: CompanionInputFieldNumberExtended = {
				id: 'test',
				type: 'number',
				label: 'Test',
				default: 0,
				min: 0,
				max: 100,
				clampValues: true,
			}

			it('should clamp value below min to min and return validationWarning', () => {
				expect(validateInputValue(definition, -10)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: ['Value was clamped to 0'],
				})
			})

			it('should clamp value above max to max and return validationWarning', () => {
				expect(validateInputValue(definition, 150)).toEqual({
					sanitisedValue: 100,
					validationError: undefined,
					validationWarnings: ['Value was clamped to 100'],
				})
			})

			it('should not clamp values within range', () => {
				expect(validateInputValue(definition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should not clamp when allowInvalidValues is also set (allowInvalidValues takes priority)', () => {
				const clampAndAllowInvalid: CompanionInputFieldNumberExtended = {
					...definition,
					allowInvalidValues: true,
				}
				expect(validateInputValue(clampAndAllowInvalid, -10)).toEqual({
					sanitisedValue: -10,
					validationError: undefined,
					validationWarnings: ['Value is below 0'],
				})
				expect(validateInputValue(clampAndAllowInvalid, 150)).toEqual({
					sanitisedValue: 150,
					validationError: undefined,
					validationWarnings: ['Value is above 100'],
				})
			})

			it('should return error when clampValues is not set (default behavior)', () => {
				const noClampDefinition: CompanionInputFieldNumberExtended = {
					id: 'test',
					type: 'number',
					label: 'Test',
					default: 0,
					min: 0,
					max: 100,
				}
				expect(validateInputValue(noClampDefinition, -10)).toEqual({
					sanitisedValue: -10,
					validationError: 'Value must be greater than or equal to 0',
					validationWarnings: [],
				})
				expect(validateInputValue(noClampDefinition, 150)).toEqual({
					sanitisedValue: 150,
					validationError: 'Value must be less than or equal to 100',
					validationWarnings: [],
				})
			})

			it('should clamp when only min is defined', () => {
				const minOnlyDefinition: CompanionInputFieldNumberExtended = {
					id: 'test',
					type: 'number',
					label: 'Test',
					default: 0,
					min: 0,
					max: undefined as unknown as number,
					clampValues: true,
				}
				expect(validateInputValue(minOnlyDefinition, -5)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: ['Value was clamped to 0'],
				})
				expect(validateInputValue(minOnlyDefinition, 1000)).toEqual({
					sanitisedValue: 1000,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should clamp when only max is defined', () => {
				const maxOnlyDefinition: CompanionInputFieldNumberExtended = {
					id: 'test',
					type: 'number',
					label: 'Test',
					default: 0,
					min: undefined as unknown as number,
					max: 100,
					clampValues: true,
				}
				expect(validateInputValue(maxOnlyDefinition, -1000)).toEqual({
					sanitisedValue: -1000,
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(maxOnlyDefinition, 200)).toEqual({
					sanitisedValue: 100,
					validationError: undefined,
					validationWarnings: ['Value was clamped to 100'],
				})
			})

			it('should still return error for non-numeric values even with clampValues', () => {
				expect(validateInputValue(definition, 'abc')).toEqual({
					sanitisedValue: 'abc',
					validationError: 'Value must be a number',
					validationWarnings: [],
				})
			})

			it('should still return error for missing values even with clampValues', () => {
				expect(validateInputValue(definition, undefined)).toEqual({
					sanitisedValue: undefined,
					validationError: 'A value must be provided',
					validationWarnings: [],
				})
			})

			it('should clamp coerced string values', () => {
				expect(validateInputValue(definition, '150')).toEqual({
					sanitisedValue: 100,
					validationError: undefined,
					validationWarnings: ['Value was clamped to 100'],
				})
				expect(validateInputValue(definition, '-5')).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: ['Value was clamped to 0'],
				})
			})

			it('should collect both min and max clamp warnings when range is inverted (min > max)', () => {
				// With an inverted range, a value below min gets clamped to min, and then that
				// clamped value may exceed max, triggering a second clamp. Both warnings are collected
				// because clamping at min does not short-circuit the max check.
				const invertedDefinition: CompanionInputFieldNumberExtended = {
					id: 'test',
					type: 'number',
					label: 'Test',
					default: 50,
					min: 100,
					max: 0,
					clampValues: true,
				}
				expect(validateInputValue(invertedDefinition, 50)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: ['Value was clamped to 100', 'Value was clamped to 0'],
				})
			})
		})

		describe('allowInvalidValues', () => {
			const definition: CompanionInputFieldNumberExtended = {
				id: 'test',
				type: 'number',
				label: 'Test',
				default: 0,
				min: 0,
				max: 100,
				allowInvalidValues: true,
			}

			it('should allow value below min with a warning', () => {
				expect(validateInputValue(definition, -10)).toEqual({
					sanitisedValue: -10,
					validationError: undefined,
					validationWarnings: ['Value is below 0'],
				})
			})

			it('should allow value above max with a warning', () => {
				expect(validateInputValue(definition, 150)).toEqual({
					sanitisedValue: 150,
					validationError: undefined,
					validationWarnings: ['Value is above 100'],
				})
			})

			it('should allow value within range with no warning', () => {
				expect(validateInputValue(definition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should collect both below and above warnings when both bounds are exceeded (inverted range)', () => {
				const invertedDefinition: CompanionInputFieldNumberExtended = {
					id: 'test',
					type: 'number',
					label: 'Test',
					default: 50,
					min: 100,
					max: 0,
					allowInvalidValues: true,
				}
				// Value 50 is below min (100) and above max (0): both warnings collected
				expect(validateInputValue(invertedDefinition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: ['Value is below 100', 'Value is above 0'],
				})
			})
		})

		describe('asInteger', () => {
			const definition: CompanionInputFieldNumberExtended = {
				id: 'test',
				type: 'number',
				label: 'Test',
				default: 0,
				min: 0,
				max: 100,
				asInteger: true,
			}

			it('should round a float to the nearest integer and warn', () => {
				expect(validateInputValue(definition, 50.6)).toEqual({
					sanitisedValue: 51,
					validationError: undefined,
					validationWarnings: ['Value was rounded to nearest integer'],
				})
				expect(validateInputValue(definition, 50.4)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: ['Value was rounded to nearest integer'],
				})
			})

			it('should not warn for an already-integer value', () => {
				expect(validateInputValue(definition, 50)).toEqual({
					sanitisedValue: 50,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should round before checking range bounds', () => {
				// 100.4 rounds to 100, which is at the boundary — no range error
				expect(validateInputValue(definition, 100.4)).toEqual({
					sanitisedValue: 100,
					validationError: undefined,
					validationWarnings: ['Value was rounded to nearest integer'],
				})
				// 100.6 rounds to 101, which exceeds max — range error
				expect(validateInputValue(definition, 100.6)).toEqual({
					sanitisedValue: 101,
					validationError: 'Value must be less than or equal to 100',
					validationWarnings: ['Value was rounded to nearest integer'],
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
				validationWarnings: [],
			})
			expect(validateInputValue(definition, false)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
				validationWarnings: [],
			})
		})

		it('should return undefined when value is undefined and coerce to false', () => {
			// Sanitised value is coerced to false
			expect(validateInputValue(definition, undefined)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
				validationWarnings: [],
			})
		})

		it('should coerce for non-boolean values', () => {
			expect(validateInputValue(definition, 'true')).toEqual({
				sanitisedValue: true,
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 1)).toEqual({
				sanitisedValue: true,
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 0)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, null)).toEqual({
				sanitisedValue: false,
				validationError: undefined,
				validationWarnings: [],
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
				enableAlpha: false,
			}

			it('should return undefined for number values', () => {
				expect(validateInputValue(numberDefinition, 16777215)).toEqual({
					sanitisedValue: 16777215,
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(numberDefinition, 0)).toEqual({
					sanitisedValue: 0,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return undefined for numeric strings', () => {
				expect(validateInputValue(numberDefinition, '16777215')).toEqual({
					sanitisedValue: '16777215',
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return error for non-numeric strings', () => {
				expect(validateInputValue(numberDefinition, '#ffffff')).toEqual({
					sanitisedValue: '#ffffff',
					validationError: 'Value must be a number',
					validationWarnings: [],
				})
			})

			it('should return error when value is undefined', () => {
				expect(validateInputValue(numberDefinition, undefined)).toEqual({
					sanitisedValue: undefined,
					validationError: 'Value must be a number',
					validationWarnings: [],
				})
			})
		})

		describe('returnType: string', () => {
			const stringDefinition: CompanionInputFieldColorExtended = {
				id: 'test',
				type: 'colorpicker',
				label: 'Test',
				default: '#000000',
				enableAlpha: false,
				returnType: 'string',
			}

			it('should return undefined for string values', () => {
				expect(validateInputValue(stringDefinition, '#ffffff')).toEqual({
					sanitisedValue: '#ffffff',
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(stringDefinition, 'rgb(255,255,255)')).toEqual({
					sanitisedValue: 'rgb(255,255,255)',
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return undefined for number values', () => {
				expect(validateInputValue(stringDefinition, 16777215)).toEqual({
					sanitisedValue: 16777215,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should return error for invalid types', () => {
				expect(validateInputValue(stringDefinition, true)).toEqual({
					sanitisedValue: true,
					validationError: 'Value must be a string or number',
					validationWarnings: [],
				})
				expect(validateInputValue(stringDefinition, ['#fff'])).toEqual({
					sanitisedValue: ['#fff'],
					validationError: 'Value must be a string or number',
					validationWarnings: [],
				})
				expect(validateInputValue(stringDefinition, { color: '#fff' })).toEqual({
					sanitisedValue: { color: '#fff' },
					validationError: 'Value must be a string or number',
					validationWarnings: [],
				})
			})

			it('should return error when value is undefined', () => {
				expect(validateInputValue(stringDefinition, undefined)).toEqual({
					sanitisedValue: undefined,
					validationError: 'Value must be a string or number',
					validationWarnings: [],
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
				validationWarnings: [],
			})
		})

		it('should return undefined when value is in choices', () => {
			expect(validateInputValue(definition, 'option1')).toEqual({
				sanitisedValue: 'option1',
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 'option2')).toEqual({
				sanitisedValue: 'option2',
				validationError: undefined,
				validationWarnings: [],
			})
		})

		it('should return error when value is not in choices', () => {
			expect(validateInputValue(definition, 'option3')).toEqual({
				sanitisedValue: 'option3',
				validationError: 'Value is not in the list of choices',
				validationWarnings: [],
			})
		})

		describe('numeric choice ids', () => {
			it('should match number value to numeric choice id', () => {
				expect(validateInputValue(definition, 123)).toEqual({
					sanitisedValue: 123,
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should match string value to numeric choice id via loose comparison', () => {
				expect(validateInputValue(definition, '123')).toEqual({
					sanitisedValue: 123,
					validationError: undefined,
					validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should stringify non-choice values when allowCustom is true', () => {
				expect(validateInputValue(customDefinition, 999)).toEqual({
					sanitisedValue: '999',
					validationError: undefined,
					validationWarnings: [],
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
						validationWarnings: [],
					})
				})

				it('should return error when custom value does not match regex', () => {
					expect(validateInputValue(customWithRegex, 'invalid_value')).toEqual({
						sanitisedValue: 'invalid_value',
						validationError: 'Value does not match regex: /^custom_/',
						validationWarnings: [],
					})
				})

				it('should return undefined for choice values even if they do not match regex', () => {
					expect(validateInputValue(customWithRegex, 'option1')).toEqual({
						sanitisedValue: 'option1',
						validationError: undefined,
						validationWarnings: [],
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
				validationWarnings: [],
			})
		})

		it('should return error when value is not an array and cannot be coerced', () => {
			expect(validateInputValue(definition, { option1: true })).toEqual({
				sanitisedValue: { option1: true },
				validationError: 'Value must be an array',
				validationWarnings: [],
			})
			expect(validateInputValue(definition, '')).toEqual({
				sanitisedValue: '',
				validationError: 'Value must be an array',
				validationWarnings: [],
			})
		})

		describe('non-array coercion', () => {
			it('should coerce a non-empty string into an array with a warning', () => {
				expect(validateInputValue(definition, 'option1')).toEqual({
					sanitisedValue: ['option1'],
					validationError: undefined,
					validationWarnings: ['Value was coerced into an array'],
				})
			})

			it('should coerce a number into an array with a warning', () => {
				expect(validateInputValue(definition, 123)).toEqual({
					sanitisedValue: [123],
					validationError: undefined,
					validationWarnings: ['Value was coerced into an array'],
				})
			})

			it('should coerce a boolean into an array with a warning and then validate the value', () => {
				expect(validateInputValue(definition, true)).toEqual({
					sanitisedValue: [true],
					validationError: 'The following selected values are not valid: true',
					validationWarnings: ['Value was coerced into an array'],
				})
			})

			it('should coerce a string not in choices into an error with a warning', () => {
				expect(validateInputValue(definition, 'invalid')).toEqual({
					sanitisedValue: ['invalid'],
					validationError: 'The following selected values are not valid: invalid',
					validationWarnings: ['Value was coerced into an array'],
				})
			})
		})

		it('should return undefined for empty array', () => {
			expect(validateInputValue(definition, [])).toEqual({
				sanitisedValue: [],
				validationError: undefined,
				validationWarnings: [],
			})
		})

		it('should return undefined when all values are in choices', () => {
			expect(validateInputValue(definition, ['option1'])).toEqual({
				sanitisedValue: ['option1'],
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, ['option1', 'option2'])).toEqual({
				sanitisedValue: ['option1', 'option2'],
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, ['option1', 'option2', 'option3'])).toEqual({
				sanitisedValue: ['option1', 'option2', 'option3'],
				validationError: undefined,
				validationWarnings: [],
			})
		})

		it('should return error when any value is not in choices', () => {
			expect(validateInputValue(definition, ['option1', 'invalid'])).toEqual({
				sanitisedValue: ['option1', 'invalid'],
				validationError: 'The following selected values are not valid: invalid',
				validationWarnings: [],
			})
		})

		describe('numeric choice ids', () => {
			it('should match number value to numeric choice id', () => {
				expect(validateInputValue(definition, [123])).toEqual({
					sanitisedValue: [123],
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(definition, ['option1', 123])).toEqual({
					sanitisedValue: ['option1', 123],
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should match string value to numeric choice id (loose type check)', () => {
				expect(validateInputValue(definition, ['123'])).toEqual({
					sanitisedValue: [123],
					validationError: undefined,
					validationWarnings: [],
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
					validationWarnings: [],
				})
			})

			it('should return error when selection count is above maxSelection', () => {
				expect(validateInputValue(constrainedDefinition, ['option1', 'option2', 'option3'])).toEqual({
					sanitisedValue: ['option1', 'option2', 'option3'],
					validationError: 'Must select at most 2 items',
					validationWarnings: [],
				})
			})

			it('should return undefined when selection count is within range', () => {
				expect(validateInputValue(constrainedDefinition, ['option1'])).toEqual({
					sanitisedValue: ['option1'],
					validationError: undefined,
					validationWarnings: [],
				})
				expect(validateInputValue(constrainedDefinition, ['option1', 'option2'])).toEqual({
					sanitisedValue: ['option1', 'option2'],
					validationError: undefined,
					validationWarnings: [],
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
					validationWarnings: [],
				})
				expect(validateInputValue(customDefinition, ['option1', 'custom_value'])).toEqual({
					sanitisedValue: ['option1', 'custom_value'],
					validationError: undefined,
					validationWarnings: [],
				})
			})

			it('should stringify custom non-choice values', () => {
				expect(validateInputValue(customDefinition, [999])).toEqual({
					sanitisedValue: ['999'],
					validationError: undefined,
					validationWarnings: [],
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
						validationWarnings: [],
					})
				})

				it('should return error when custom value does not match regex', () => {
					// Multidropdown returns original value when invalid
					expect(validateInputValue(customWithRegex, ['invalid_value'])).toEqual({
						sanitisedValue: ['invalid_value'],
						validationError: 'The following selected values are not valid: invalid_value',
						validationWarnings: [],
					})
				})

				it('should return undefined for choice values even if they do not match regex', () => {
					expect(validateInputValue(customWithRegex, ['option1'])).toEqual({
						sanitisedValue: ['option1'],
						validationError: undefined,
						validationWarnings: [],
					})
				})

				// Multidropdown returns original value array when any value is invalid
				it('should correctly report multiple invalid values', () => {
					expect(validateInputValue(customWithRegex, ['invalid1', 'option1', 'invalid2'])).toEqual({
						sanitisedValue: ['invalid1', 'option1', 'invalid2'],
						validationError: 'The following selected values are not valid: invalid1, invalid2',
						validationWarnings: [],
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
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 'device-id')).toEqual({
				sanitisedValue: 'device-id',
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: 123,
				validationError: undefined,
				validationWarnings: [],
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
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 'var-name')).toEqual({
				sanitisedValue: 'var-name',
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: 123,
				validationError: undefined,
				validationWarnings: [],
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
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 'any-value')).toEqual({
				sanitisedValue: 'any-value',
				validationError: undefined,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 123)).toEqual({
				sanitisedValue: 123,
				validationError: undefined,
				validationWarnings: [],
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
				validationWarnings: [],
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
				validationWarnings: [],
			})
			expect(validateInputValue(definition, Infinity)).toEqual({
				sanitisedValue: Infinity,
				validationError: undefined,
				validationWarnings: [],
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
				validationWarnings: [],
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
				validationWarnings: [],
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
				validationWarnings: [],
			})
		})
	})
})
