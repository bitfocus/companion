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
	InternalInputFieldList,
	InternalInputFieldTable,
	InternalInputFieldTime,
} from '../Model/Options.js'
import { validateInputValue } from '../ValidateInputValue.js'

describe('validateInputValue', () => {
	// The field types below are companion-owned: they are not covered by the host validation primitives,
	// so their behaviour is tested in full here.

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

	describe('expression', () => {
		const definition: CompanionInputFieldExpressionExtended = {
			id: 'test',
			type: 'expression',
			label: 'Test',
		}

		it('should return valid for a valid expression', () => {
			expect(validateInputValue(definition, '1 + 2')).toEqual({
				sanitisedValue: '1 + 2',
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, '$(internal:a) + 1')).toEqual({
				sanitisedValue: '$(internal:a) + 1',
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should return error for an invalid expression', () => {
			// Unclosed parentheses
			expect(validateInputValue(definition, '(((')).toEqual({
				sanitisedValue: '(((',
				validationError: 'Expression is not valid',
				validity: false,
				validationWarnings: [],
			})
			// Unclosed string
			expect(validateInputValue(definition, '"unclosed')).toEqual({
				sanitisedValue: '"unclosed',
				validationError: 'Expression is not valid',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should skip validation when skipValidateExpression is set', () => {
			// The expression has already been parsed elsewhere, so an invalid one is passed through untouched
			expect(validateInputValue(definition, '(((', { skipValidateExpression: true })).toEqual({
				sanitisedValue: '(((',
				validationError: undefined,
				validationWarnings: [],
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

	describe('internal:table', () => {
		const definition: InternalInputFieldTable = {
			id: 'test',
			type: 'internal:table',
			label: 'Test',
			columns: [
				{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0 },
				{
					id: 'color',
					type: 'colorpicker',
					label: 'Color',
					default: 0x00ff00,
					enableAlpha: false,
					returnType: 'number',
				},
			],
			default: [],
		}

		it('should return error when value is not an array', () => {
			expect(validateInputValue(definition, 'not-an-array')).toEqual({
				sanitisedValue: 'not-an-array',
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 42)).toEqual({
				sanitisedValue: 42,
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, { value: 0, color: 0 })).toEqual({
				sanitisedValue: { value: 0, color: 0 },
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should return empty array for empty input', () => {
			expect(validateInputValue(definition, [])).toEqual({
				sanitisedValue: [],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should return error when a row is not an object', () => {
			expect(validateInputValue(definition, ['not-a-row'])).toEqual({
				sanitisedValue: ['not-a-row'],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, [42])).toEqual({
				sanitisedValue: [42],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, [[]])).toEqual({
				sanitisedValue: [[]],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should validate and sanitise a valid row', () => {
			expect(validateInputValue(definition, [{ value: 50, color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: 50, color: 0x00ff00 }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should validate multiple valid rows', () => {
			expect(
				validateInputValue(definition, [
					{ value: 0, color: 0x00ff00 },
					{ value: 66, color: 0xffff00 },
					{ value: 85, color: 0xff0000 },
				])
			).toEqual({
				sanitisedValue: [
					{ value: 0, color: 0x00ff00 },
					{ value: 66, color: 0xffff00 },
					{ value: 85, color: 0xff0000 },
				],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should return error with row/column context when a cell value is invalid', () => {
			expect(validateInputValue(definition, [{ value: 150, color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: 150, color: 0x00ff00 }],
				validationError: 'Row 0, column "Value": Value must be less than or equal to 100',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should report the failing row index correctly', () => {
			expect(
				validateInputValue(definition, [
					{ value: 0, color: 0x00ff00 },
					{ value: -5, color: 0xffff00 },
				])
			).toEqual({
				sanitisedValue: [
					{ value: 0, color: 0x00ff00 },
					{ value: -5, color: 0xffff00 },
				],
				validationError: 'Row 1, column "Value": Value must be greater than or equal to 0',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should propagate column warnings with row/column context', () => {
			const clampDef: InternalInputFieldTable = {
				...definition,
				columns: [
					{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0, clampValues: true },
					{
						id: 'color',
						type: 'colorpicker',
						label: 'Color',
						default: 0x00ff00,
						enableAlpha: false,
						returnType: 'number',
					},
				],
			}
			expect(validateInputValue(clampDef, [{ value: 150, color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: 100, color: 0x00ff00 }],
				validationError: undefined,
				validity: true,
				validationWarnings: ['Row 0, column "Value": Value was clamped to 100'],
			})
		})

		it('should coerce string cell values using the column definition', () => {
			expect(validateInputValue(definition, [{ value: '75', color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: 75, color: 0x00ff00 }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should return error when value is null', () => {
			expect(validateInputValue(definition, null)).toEqual({
				sanitisedValue: null,
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should return error when a row is null', () => {
			expect(validateInputValue(definition, [null])).toEqual({
				sanitisedValue: [null],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should return error when a required cell is missing', () => {
			expect(validateInputValue(definition, [{}])).toEqual({
				sanitisedValue: [{}],
				validationError: 'Row 0, column "Value": A value must be provided',
				validity: false,
				validationWarnings: [],
			})
		})
	})

	describe('internal:list', () => {
		const definition: InternalInputFieldList = {
			id: 'test',
			type: 'internal:list',
			label: 'Test',
			fields: [
				{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0 },
				{
					id: 'color',
					type: 'colorpicker',
					label: 'Color',
					default: 0x00ff00,
					enableAlpha: false,
					returnType: 'number',
				},
			],
			default: [],
		}

		// Helpers for building ExpressionOrValue cells
		const val = <T>(v: T) => ({ isExpression: false as const, value: v })
		const expr = (v: string) => ({ isExpression: true as const, value: v })

		it('should return error when value is not an array', () => {
			expect(validateInputValue(definition, 'not-an-array')).toEqual({
				sanitisedValue: 'not-an-array',
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, 42)).toEqual({
				sanitisedValue: 42,
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, null)).toEqual({
				sanitisedValue: null,
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, { value: 0, color: 0 })).toEqual({
				sanitisedValue: { value: 0, color: 0 },
				validationError: 'Value must be an array',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should return empty array for empty input', () => {
			expect(validateInputValue(definition, [])).toEqual({
				sanitisedValue: [],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should return error when a row is not an object', () => {
			expect(validateInputValue(definition, ['not-a-row'])).toEqual({
				sanitisedValue: ['not-a-row'],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, [42])).toEqual({
				sanitisedValue: [42],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, [null])).toEqual({
				sanitisedValue: [null],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
			expect(validateInputValue(definition, [[]])).toEqual({
				sanitisedValue: [[]],
				validationError: 'Row 0 must be an object',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should auto-wrap bare JsonValue cells into ExpressionOrValue', () => {
			expect(validateInputValue(definition, [{ value: 50, color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: val(50), color: val(0x00ff00) }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should accept and sanitise ExpressionOrValue-wrapped static cells', () => {
			expect(validateInputValue(definition, [{ value: val(50), color: val(0x00ff00) }])).toEqual({
				sanitisedValue: [{ value: val(50), color: val(0x00ff00) }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should pass expression cells through without value validation', () => {
			const row = { value: expr('$(internal:time_s)'), color: val(0x00ff00) }
			expect(validateInputValue(definition, [row])).toEqual({
				sanitisedValue: [{ value: expr('$(internal:time_s)'), color: val(0x00ff00) }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should pass all-expression rows through', () => {
			const row = { value: expr('$(a:b)'), color: expr('$(c:d)') }
			expect(validateInputValue(definition, [row])).toEqual({
				sanitisedValue: [{ value: expr('$(a:b)'), color: expr('$(c:d)') }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should return error when an expression cell has a non-string value', () => {
			const row = { value: { isExpression: true, value: 123 }, color: val(0x00ff00) }
			expect(validateInputValue(definition, [row])).toEqual({
				sanitisedValue: [row],
				validationError: 'Row 0, field "Value": Expression must be a string',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should return error with row/field context when a cell value is invalid', () => {
			expect(validateInputValue(definition, [{ value: 150, color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: 150, color: 0x00ff00 }],
				validationError: 'Row 0, field "Value": Value must be less than or equal to 100',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should report the failing row index correctly', () => {
			expect(
				validateInputValue(definition, [
					{ value: val(0), color: val(0x00ff00) },
					{ value: -5, color: 0xffff00 },
				])
			).toEqual({
				sanitisedValue: [
					{ value: val(0), color: val(0x00ff00) },
					{ value: -5, color: 0xffff00 },
				],
				validationError: 'Row 1, field "Value": Value must be greater than or equal to 0',
				validity: false,
				validationWarnings: [],
			})
		})

		it('should propagate field warnings with row/field context', () => {
			const clampDef: InternalInputFieldList = {
				...definition,
				fields: [
					{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0, clampValues: true },
					{
						id: 'color',
						type: 'colorpicker',
						label: 'Color',
						default: 0x00ff00,
						enableAlpha: false,
						returnType: 'number',
					},
				],
			}
			expect(validateInputValue(clampDef, [{ value: 150, color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: val(100), color: val(0x00ff00) }],
				validationError: undefined,
				validity: true,
				validationWarnings: ['Row 0, field "Value": Value was clamped to 100'],
			})
		})

		it('should coerce string cell values via the field definition', () => {
			expect(validateInputValue(definition, [{ value: '75', color: 0x00ff00 }])).toEqual({
				sanitisedValue: [{ value: val(75), color: val(0x00ff00) }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should validate multiple valid rows', () => {
			expect(
				validateInputValue(definition, [
					{ value: val(0), color: val(0x00ff00) },
					{ value: val(66), color: val(0xffff00) },
					{ value: val(85), color: val(0xff0000) },
				])
			).toEqual({
				sanitisedValue: [
					{ value: val(0), color: val(0x00ff00) },
					{ value: val(66), color: val(0xffff00) },
					{ value: val(85), color: val(0xff0000) },
				],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should handle mixed bare and wrapped cells in the same row', () => {
			expect(validateInputValue(definition, [{ value: 50, color: val(0x00ff00) }])).toEqual({
				sanitisedValue: [{ value: val(50), color: val(0x00ff00) }],
				validationError: undefined,
				validity: true,
				validationWarnings: [],
			})
		})

		it('should return error when a required cell is missing', () => {
			expect(validateInputValue(definition, [{}])).toEqual({
				sanitisedValue: [{}],
				validationError: 'Row 0, field "Value": A value must be provided',
				validity: false,
				validationWarnings: [],
			})
		})
	})

	// These field types delegate to the validators in `@companion-module/host`, which owns the accuracy
	// tests for them (see host `validate/__tests__/primitives.spec.ts`). We only check the wiring here:
	// that each type is routed to the right primitive and that the field-definition properties are
	// mapped into its options.
	describe('delegates to host primitives', () => {
		describe('textinput / secret-text', () => {
			it('threads minLength through to the text validator', () => {
				const definition: CompanionInputFieldTextInputExtended = {
					id: 'test',
					type: 'textinput',
					label: 'Test',
					minLength: 3,
				}
				expect(validateInputValue(definition, 'ab')).toMatchObject({
					sanitisedValue: 'ab',
					validationError: 'Value must be at least 3 characters long',
					validity: false,
				})
				expect(validateInputValue(definition, 'abc')).toMatchObject({ validationError: undefined, validity: true })
			})

			it('threads regex through to the text validator', () => {
				const definition: CompanionInputFieldTextInputExtended = {
					id: 'test',
					type: 'textinput',
					label: 'Test',
					regex: '/^\\d+$/',
				}
				expect(validateInputValue(definition, '123')).toMatchObject({ sanitisedValue: '123', validity: true })
				expect(validateInputValue(definition, 'abc')).toMatchObject({ validity: false })
			})

			it('routes secret-text to the same text validator', () => {
				const definition: CompanionInputFieldSecretExtended = {
					id: 'test',
					type: 'secret-text',
					label: 'Test',
					minLength: 1,
				}
				expect(validateInputValue(definition, '')).toMatchObject({
					validationError: 'Value must be at least 1 characters long',
					validity: false,
				})
				expect(validateInputValue(definition, 'secret')).toMatchObject({ sanitisedValue: 'secret', validity: true })
			})

			it('short-circuits textinput with disableSanitisation, skipping the primitive', () => {
				const definition: CompanionInputFieldTextInputExtended = {
					id: 'test',
					type: 'textinput',
					label: 'Test',
					regex: '/^\\d+$/',
					disableSanitisation: true,
				}
				// disableSanitisation is companion-specific: the value is passed through unchecked and unknown
				const result = validateInputValue(definition, 'not-a-number')
				expect(result.sanitisedValue).toBe('not-a-number')
				expect(result.validationError).toBeUndefined()
				expect(result.validity).toBeUndefined()
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

			it('threads min/max through to the number validator', () => {
				expect(validateInputValue(definition, 50)).toMatchObject({ sanitisedValue: 50, validity: true })
				expect(validateInputValue(definition, -1)).toMatchObject({
					validationError: 'Value must be greater than or equal to 0',
					validity: false,
				})
				expect(validateInputValue(definition, 101)).toMatchObject({
					validationError: 'Value must be less than or equal to 100',
					validity: false,
				})
			})

			it('threads clampValues through to the number validator', () => {
				const clampDef: CompanionInputFieldNumberExtended = { ...definition, clampValues: true }
				expect(validateInputValue(clampDef, 150)).toMatchObject({
					sanitisedValue: 100,
					validationWarnings: ['Value was clamped to 100'],
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

			it('coerces to boolean via the checkbox validator', () => {
				expect(validateInputValue(definition, 'true')).toMatchObject({ sanitisedValue: true })
				expect(validateInputValue(definition, 0)).toMatchObject({ sanitisedValue: false })
			})
		})

		describe('colorpicker', () => {
			it('routes returnType number to a color number', () => {
				const definition: CompanionInputFieldColorExtended = {
					id: 'test',
					type: 'colorpicker',
					label: 'Test',
					default: 0,
					returnType: 'number',
					enableAlpha: false,
				}
				expect(validateInputValue(definition, '#ff0000')).toMatchObject({ sanitisedValue: 0xff0000, validity: true })
			})

			it('routes returnType string to a css string', () => {
				const definition: CompanionInputFieldColorExtended = {
					id: 'test',
					type: 'colorpicker',
					label: 'Test',
					default: '#000000',
					returnType: 'string',
					enableAlpha: false,
				}
				expect(validateInputValue(definition, 16777215)).toMatchObject({
					sanitisedValue: 'rgba(255, 255, 255, 1)',
					validity: true,
				})
			})

			it('threads enableAlpha: false so alpha is stripped', () => {
				const definition: CompanionInputFieldColorExtended = {
					id: 'test',
					type: 'colorpicker',
					label: 'Test',
					default: 0,
					returnType: 'number',
					enableAlpha: false,
				}
				expect(validateInputValue(definition, 'rgba(255, 0, 0, 0.5)')).toMatchObject({
					sanitisedValue: 0xff0000,
					validity: true,
				})
			})

			it('threads enableAlpha: true so alpha is packed', () => {
				const definition: CompanionInputFieldColorExtended = {
					id: 'test',
					type: 'colorpicker',
					label: 'Test',
					default: 0,
					returnType: 'number',
					enableAlpha: true,
				}
				// rgba(255,0,0,0.5) -> alpha byte 128 (0x80) in the top bits
				expect(validateInputValue(definition, 'rgba(255, 0, 0, 0.5)')).toMatchObject({
					sanitisedValue: 0xff0000 + 0x80 * 0x1000000,
					validity: true,
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
					{ id: 123, label: 'Numeric Option' },
				],
			}

			it('threads choices through to the dropdown validator', () => {
				expect(validateInputValue(definition, 'option1')).toMatchObject({ sanitisedValue: 'option1', validity: true })
				expect(validateInputValue(definition, '123')).toMatchObject({ sanitisedValue: 123, validity: true })
				expect(validateInputValue(definition, 'nope')).toMatchObject({
					validationError: 'Value is not in the list of choices',
					validity: false,
				})
			})

			it('threads allowCustom through to the dropdown validator', () => {
				const customDef: CompanionInputFieldDropdownExtended = { ...definition, allowCustom: true }
				expect(validateInputValue(customDef, 'custom_value')).toMatchObject({
					sanitisedValue: 'custom_value',
					validity: true,
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
				],
			}

			it('threads choices through to the multidropdown validator', () => {
				expect(validateInputValue(definition, ['option1', 'option2'])).toMatchObject({
					sanitisedValue: ['option1', 'option2'],
					validity: true,
				})
				expect(validateInputValue(definition, ['nope'])).toMatchObject({
					validationError: 'The following selected values are not valid: nope',
					validity: false,
				})
			})

			it('threads minSelection/maxSelection through to the multidropdown validator', () => {
				const constrainedDef: CompanionInputFieldMultiDropdownExtended = {
					...definition,
					minSelection: 1,
					maxSelection: 2,
				}
				expect(validateInputValue(constrainedDef, [])).toMatchObject({
					validationError: 'Must select at least 1 items',
					validity: false,
				})
				expect(validateInputValue(constrainedDef, ['option1', 'option2', 'option1'])).toMatchObject({
					validationError: 'Must select at most 2 items',
					validity: false,
				})
				expect(validateInputValue(constrainedDef, ['option1'])).toMatchObject({ validity: true })
			})
		})
	})
})
