'use strict'
export const validate = validate20
export default validate20
const schema31 = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	title: 'Satellite Config Fields',
	description:
		'Schema describing an array of custom config field definitions for a satellite device. These fields are rendered in the Companion UI surface settings panel and the stored values are pushed back to the device via DEVICE-CONFIG.',
	type: 'array',
	items: { $ref: '#/$defs/configField' },
	$defs: {
		commonFields: {
			type: 'object',
			properties: {
				id: {
					description: 'Unique identifier for the field. Used as the key in the DEVICE-CONFIG JSON object.',
					type: 'string',
				},
				label: { description: 'Human-readable label shown in the UI.', type: 'string' },
				description: {
					description: 'Optional longer description shown in the UI to explain the field.',
					type: 'string',
				},
				tooltip: { description: 'Optional tooltip text shown on hover.', type: 'string' },
				isVisibleExpression: {
					description:
						'Optional expression that controls field visibility. When provided, the field is only shown when the expression evaluates to true.',
					type: 'string',
				},
			},
			required: ['id', 'label'],
		},
		staticTextField: {
			allOf: [
				{ $ref: '#/$defs/commonFields' },
				{
					type: 'object',
					properties: {
						type: { const: 'static-text' },
						value: { description: 'Static text content to display.', type: 'string' },
					},
					required: ['type', 'value'],
					additionalProperties: false,
				},
			],
		},
		textInputField: {
			allOf: [
				{ $ref: '#/$defs/commonFields' },
				{
					type: 'object',
					properties: {
						type: { const: 'textinput' },
						default: { description: 'Default value.', type: 'string' },
						regex: { description: 'Optional regex pattern the value must match.', type: 'string' },
						multiline: { description: 'Whether the input is a multiline text area.', type: 'boolean' },
					},
					required: ['type'],
					additionalProperties: false,
				},
			],
		},
		dropdownChoice: {
			type: 'object',
			properties: {
				id: { description: 'The value stored when this choice is selected.', type: ['string', 'number'] },
				label: { description: 'Human-readable label for the choice.', type: 'string' },
			},
			required: ['id', 'label'],
			additionalProperties: false,
		},
		dropdownField: {
			allOf: [
				{ $ref: '#/$defs/commonFields' },
				{
					type: 'object',
					properties: {
						type: { const: 'dropdown' },
						choices: {
							description: 'List of selectable choices.',
							type: 'array',
							items: { $ref: '#/$defs/dropdownChoice' },
							minItems: 1,
						},
						default: { description: 'Default selected choice id.', type: ['string', 'number'] },
						allowCustom: {
							description: 'Whether the user can type a custom value not in the choices list.',
							type: 'boolean',
						},
					},
					required: ['type', 'choices'],
					additionalProperties: false,
				},
			],
		},
		numberField: {
			allOf: [
				{ $ref: '#/$defs/commonFields' },
				{
					type: 'object',
					properties: {
						type: { const: 'number' },
						min: { description: 'Minimum allowed value.', type: 'number' },
						max: { description: 'Maximum allowed value.', type: 'number' },
						default: { description: 'Default value.', type: 'number' },
						step: { description: 'Step increment for the input.', type: 'number' },
					},
					required: ['type', 'min', 'max'],
					additionalProperties: false,
				},
			],
		},
		checkboxField: {
			allOf: [
				{ $ref: '#/$defs/commonFields' },
				{
					type: 'object',
					properties: {
						type: { const: 'checkbox' },
						default: { description: 'Default checked state.', type: 'boolean' },
					},
					required: ['type'],
					additionalProperties: false,
				},
			],
		},
		configField: {
			oneOf: [
				{ $ref: '#/$defs/staticTextField' },
				{ $ref: '#/$defs/textInputField' },
				{ $ref: '#/$defs/dropdownField' },
				{ $ref: '#/$defs/numberField' },
				{ $ref: '#/$defs/checkboxField' },
			],
		},
	},
}
const schema32 = {
	oneOf: [
		{ $ref: '#/$defs/staticTextField' },
		{ $ref: '#/$defs/textInputField' },
		{ $ref: '#/$defs/dropdownField' },
		{ $ref: '#/$defs/numberField' },
		{ $ref: '#/$defs/checkboxField' },
	],
}
const schema33 = {
	allOf: [
		{ $ref: '#/$defs/commonFields' },
		{
			type: 'object',
			properties: {
				type: { const: 'static-text' },
				value: { description: 'Static text content to display.', type: 'string' },
			},
			required: ['type', 'value'],
			additionalProperties: false,
		},
	],
}
const schema34 = {
	type: 'object',
	properties: {
		id: {
			description: 'Unique identifier for the field. Used as the key in the DEVICE-CONFIG JSON object.',
			type: 'string',
		},
		label: { description: 'Human-readable label shown in the UI.', type: 'string' },
		description: { description: 'Optional longer description shown in the UI to explain the field.', type: 'string' },
		tooltip: { description: 'Optional tooltip text shown on hover.', type: 'string' },
		isVisibleExpression: {
			description:
				'Optional expression that controls field visibility. When provided, the field is only shown when the expression evaluates to true.',
			type: 'string',
		},
	},
	required: ['id', 'label'],
}
function validate22(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}
) {
	let vErrors = null
	let errors = 0
	const evaluated0 = validate22.evaluated
	if (evaluated0.dynamicProps) {
		evaluated0.props = undefined
	}
	if (evaluated0.dynamicItems) {
		evaluated0.items = undefined
	}
	const _errs0 = errors
	const _errs1 = errors
	if (errors === _errs1) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0
			if ((data.id === undefined && (missing0 = 'id')) || (data.label === undefined && (missing0 = 'label'))) {
				validate22.errors = [
					{
						instancePath,
						schemaPath: '#/$defs/commonFields/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message: "must have required property '" + missing0 + "'",
					},
				]
				return false
			} else {
				if (data.id !== undefined) {
					const _errs3 = errors
					if (typeof data.id !== 'string') {
						validate22.errors = [
							{
								instancePath: instancePath + '/id',
								schemaPath: '#/$defs/commonFields/properties/id/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						]
						return false
					}
					var valid2 = _errs3 === errors
				} else {
					var valid2 = true
				}
				if (valid2) {
					if (data.label !== undefined) {
						const _errs5 = errors
						if (typeof data.label !== 'string') {
							validate22.errors = [
								{
									instancePath: instancePath + '/label',
									schemaPath: '#/$defs/commonFields/properties/label/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							]
							return false
						}
						var valid2 = _errs5 === errors
					} else {
						var valid2 = true
					}
					if (valid2) {
						if (data.description !== undefined) {
							const _errs7 = errors
							if (typeof data.description !== 'string') {
								validate22.errors = [
									{
										instancePath: instancePath + '/description',
										schemaPath: '#/$defs/commonFields/properties/description/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								]
								return false
							}
							var valid2 = _errs7 === errors
						} else {
							var valid2 = true
						}
						if (valid2) {
							if (data.tooltip !== undefined) {
								const _errs9 = errors
								if (typeof data.tooltip !== 'string') {
									validate22.errors = [
										{
											instancePath: instancePath + '/tooltip',
											schemaPath: '#/$defs/commonFields/properties/tooltip/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								var valid2 = _errs9 === errors
							} else {
								var valid2 = true
							}
							if (valid2) {
								if (data.isVisibleExpression !== undefined) {
									const _errs11 = errors
									if (typeof data.isVisibleExpression !== 'string') {
										validate22.errors = [
											{
												instancePath: instancePath + '/isVisibleExpression',
												schemaPath: '#/$defs/commonFields/properties/isVisibleExpression/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										]
										return false
									}
									var valid2 = _errs11 === errors
								} else {
									var valid2 = true
								}
							}
						}
					}
				}
			}
		} else {
			validate22.errors = [
				{
					instancePath,
					schemaPath: '#/$defs/commonFields/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			]
			return false
		}
	}
	var valid0 = _errs0 === errors
	if (valid0) {
		const _errs13 = errors
		if (errors === _errs13) {
			if (data && typeof data == 'object' && !Array.isArray(data)) {
				let missing1
				if ((data.type === undefined && (missing1 = 'type')) || (data.value === undefined && (missing1 = 'value'))) {
					validate22.errors = [
						{
							instancePath,
							schemaPath: '#/allOf/1/required',
							keyword: 'required',
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'",
						},
					]
					return false
				} else {
					const _errs15 = errors
					for (const key0 in data) {
						if (!(key0 === 'type' || key0 === 'value')) {
							validate22.errors = [
								{
									instancePath,
									schemaPath: '#/allOf/1/additionalProperties',
									keyword: 'additionalProperties',
									params: { additionalProperty: key0 },
									message: 'must NOT have additional properties',
								},
							]
							return false
							break
						}
					}
					if (_errs15 === errors) {
						if (data.type !== undefined) {
							const _errs16 = errors
							if ('static-text' !== data.type) {
								validate22.errors = [
									{
										instancePath: instancePath + '/type',
										schemaPath: '#/allOf/1/properties/type/const',
										keyword: 'const',
										params: { allowedValue: 'static-text' },
										message: 'must be equal to constant',
									},
								]
								return false
							}
							var valid3 = _errs16 === errors
						} else {
							var valid3 = true
						}
						if (valid3) {
							if (data.value !== undefined) {
								const _errs17 = errors
								if (typeof data.value !== 'string') {
									validate22.errors = [
										{
											instancePath: instancePath + '/value',
											schemaPath: '#/allOf/1/properties/value/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								var valid3 = _errs17 === errors
							} else {
								var valid3 = true
							}
						}
					}
				}
			} else {
				validate22.errors = [
					{
						instancePath,
						schemaPath: '#/allOf/1/type',
						keyword: 'type',
						params: { type: 'object' },
						message: 'must be object',
					},
				]
				return false
			}
		}
		var valid0 = _errs13 === errors
	}
	validate22.errors = vErrors
	return errors === 0
}
validate22.evaluated = { props: true, dynamicProps: false, dynamicItems: false }
const schema35 = {
	allOf: [
		{ $ref: '#/$defs/commonFields' },
		{
			type: 'object',
			properties: {
				type: { const: 'textinput' },
				default: { description: 'Default value.', type: 'string' },
				regex: { description: 'Optional regex pattern the value must match.', type: 'string' },
				multiline: { description: 'Whether the input is a multiline text area.', type: 'boolean' },
			},
			required: ['type'],
			additionalProperties: false,
		},
	],
}
function validate24(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}
) {
	let vErrors = null
	let errors = 0
	const evaluated0 = validate24.evaluated
	if (evaluated0.dynamicProps) {
		evaluated0.props = undefined
	}
	if (evaluated0.dynamicItems) {
		evaluated0.items = undefined
	}
	const _errs0 = errors
	const _errs1 = errors
	if (errors === _errs1) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0
			if ((data.id === undefined && (missing0 = 'id')) || (data.label === undefined && (missing0 = 'label'))) {
				validate24.errors = [
					{
						instancePath,
						schemaPath: '#/$defs/commonFields/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message: "must have required property '" + missing0 + "'",
					},
				]
				return false
			} else {
				if (data.id !== undefined) {
					const _errs3 = errors
					if (typeof data.id !== 'string') {
						validate24.errors = [
							{
								instancePath: instancePath + '/id',
								schemaPath: '#/$defs/commonFields/properties/id/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						]
						return false
					}
					var valid2 = _errs3 === errors
				} else {
					var valid2 = true
				}
				if (valid2) {
					if (data.label !== undefined) {
						const _errs5 = errors
						if (typeof data.label !== 'string') {
							validate24.errors = [
								{
									instancePath: instancePath + '/label',
									schemaPath: '#/$defs/commonFields/properties/label/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							]
							return false
						}
						var valid2 = _errs5 === errors
					} else {
						var valid2 = true
					}
					if (valid2) {
						if (data.description !== undefined) {
							const _errs7 = errors
							if (typeof data.description !== 'string') {
								validate24.errors = [
									{
										instancePath: instancePath + '/description',
										schemaPath: '#/$defs/commonFields/properties/description/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								]
								return false
							}
							var valid2 = _errs7 === errors
						} else {
							var valid2 = true
						}
						if (valid2) {
							if (data.tooltip !== undefined) {
								const _errs9 = errors
								if (typeof data.tooltip !== 'string') {
									validate24.errors = [
										{
											instancePath: instancePath + '/tooltip',
											schemaPath: '#/$defs/commonFields/properties/tooltip/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								var valid2 = _errs9 === errors
							} else {
								var valid2 = true
							}
							if (valid2) {
								if (data.isVisibleExpression !== undefined) {
									const _errs11 = errors
									if (typeof data.isVisibleExpression !== 'string') {
										validate24.errors = [
											{
												instancePath: instancePath + '/isVisibleExpression',
												schemaPath: '#/$defs/commonFields/properties/isVisibleExpression/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										]
										return false
									}
									var valid2 = _errs11 === errors
								} else {
									var valid2 = true
								}
							}
						}
					}
				}
			}
		} else {
			validate24.errors = [
				{
					instancePath,
					schemaPath: '#/$defs/commonFields/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			]
			return false
		}
	}
	var valid0 = _errs0 === errors
	if (valid0) {
		const _errs13 = errors
		if (errors === _errs13) {
			if (data && typeof data == 'object' && !Array.isArray(data)) {
				let missing1
				if (data.type === undefined && (missing1 = 'type')) {
					validate24.errors = [
						{
							instancePath,
							schemaPath: '#/allOf/1/required',
							keyword: 'required',
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'",
						},
					]
					return false
				} else {
					const _errs15 = errors
					for (const key0 in data) {
						if (!(key0 === 'type' || key0 === 'default' || key0 === 'regex' || key0 === 'multiline')) {
							validate24.errors = [
								{
									instancePath,
									schemaPath: '#/allOf/1/additionalProperties',
									keyword: 'additionalProperties',
									params: { additionalProperty: key0 },
									message: 'must NOT have additional properties',
								},
							]
							return false
							break
						}
					}
					if (_errs15 === errors) {
						if (data.type !== undefined) {
							const _errs16 = errors
							if ('textinput' !== data.type) {
								validate24.errors = [
									{
										instancePath: instancePath + '/type',
										schemaPath: '#/allOf/1/properties/type/const',
										keyword: 'const',
										params: { allowedValue: 'textinput' },
										message: 'must be equal to constant',
									},
								]
								return false
							}
							var valid3 = _errs16 === errors
						} else {
							var valid3 = true
						}
						if (valid3) {
							if (data.default !== undefined) {
								const _errs17 = errors
								if (typeof data.default !== 'string') {
									validate24.errors = [
										{
											instancePath: instancePath + '/default',
											schemaPath: '#/allOf/1/properties/default/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								var valid3 = _errs17 === errors
							} else {
								var valid3 = true
							}
							if (valid3) {
								if (data.regex !== undefined) {
									const _errs19 = errors
									if (typeof data.regex !== 'string') {
										validate24.errors = [
											{
												instancePath: instancePath + '/regex',
												schemaPath: '#/allOf/1/properties/regex/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										]
										return false
									}
									var valid3 = _errs19 === errors
								} else {
									var valid3 = true
								}
								if (valid3) {
									if (data.multiline !== undefined) {
										const _errs21 = errors
										if (typeof data.multiline !== 'boolean') {
											validate24.errors = [
												{
													instancePath: instancePath + '/multiline',
													schemaPath: '#/allOf/1/properties/multiline/type',
													keyword: 'type',
													params: { type: 'boolean' },
													message: 'must be boolean',
												},
											]
											return false
										}
										var valid3 = _errs21 === errors
									} else {
										var valid3 = true
									}
								}
							}
						}
					}
				}
			} else {
				validate24.errors = [
					{
						instancePath,
						schemaPath: '#/allOf/1/type',
						keyword: 'type',
						params: { type: 'object' },
						message: 'must be object',
					},
				]
				return false
			}
		}
		var valid0 = _errs13 === errors
	}
	validate24.errors = vErrors
	return errors === 0
}
validate24.evaluated = { props: true, dynamicProps: false, dynamicItems: false }
const schema37 = {
	allOf: [
		{ $ref: '#/$defs/commonFields' },
		{
			type: 'object',
			properties: {
				type: { const: 'dropdown' },
				choices: {
					description: 'List of selectable choices.',
					type: 'array',
					items: { $ref: '#/$defs/dropdownChoice' },
					minItems: 1,
				},
				default: { description: 'Default selected choice id.', type: ['string', 'number'] },
				allowCustom: {
					description: 'Whether the user can type a custom value not in the choices list.',
					type: 'boolean',
				},
			},
			required: ['type', 'choices'],
			additionalProperties: false,
		},
	],
}
const schema39 = {
	type: 'object',
	properties: {
		id: { description: 'The value stored when this choice is selected.', type: ['string', 'number'] },
		label: { description: 'Human-readable label for the choice.', type: 'string' },
	},
	required: ['id', 'label'],
	additionalProperties: false,
}
function validate26(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}
) {
	let vErrors = null
	let errors = 0
	const evaluated0 = validate26.evaluated
	if (evaluated0.dynamicProps) {
		evaluated0.props = undefined
	}
	if (evaluated0.dynamicItems) {
		evaluated0.items = undefined
	}
	const _errs0 = errors
	const _errs1 = errors
	if (errors === _errs1) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0
			if ((data.id === undefined && (missing0 = 'id')) || (data.label === undefined && (missing0 = 'label'))) {
				validate26.errors = [
					{
						instancePath,
						schemaPath: '#/$defs/commonFields/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message: "must have required property '" + missing0 + "'",
					},
				]
				return false
			} else {
				if (data.id !== undefined) {
					const _errs3 = errors
					if (typeof data.id !== 'string') {
						validate26.errors = [
							{
								instancePath: instancePath + '/id',
								schemaPath: '#/$defs/commonFields/properties/id/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						]
						return false
					}
					var valid2 = _errs3 === errors
				} else {
					var valid2 = true
				}
				if (valid2) {
					if (data.label !== undefined) {
						const _errs5 = errors
						if (typeof data.label !== 'string') {
							validate26.errors = [
								{
									instancePath: instancePath + '/label',
									schemaPath: '#/$defs/commonFields/properties/label/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							]
							return false
						}
						var valid2 = _errs5 === errors
					} else {
						var valid2 = true
					}
					if (valid2) {
						if (data.description !== undefined) {
							const _errs7 = errors
							if (typeof data.description !== 'string') {
								validate26.errors = [
									{
										instancePath: instancePath + '/description',
										schemaPath: '#/$defs/commonFields/properties/description/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								]
								return false
							}
							var valid2 = _errs7 === errors
						} else {
							var valid2 = true
						}
						if (valid2) {
							if (data.tooltip !== undefined) {
								const _errs9 = errors
								if (typeof data.tooltip !== 'string') {
									validate26.errors = [
										{
											instancePath: instancePath + '/tooltip',
											schemaPath: '#/$defs/commonFields/properties/tooltip/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								var valid2 = _errs9 === errors
							} else {
								var valid2 = true
							}
							if (valid2) {
								if (data.isVisibleExpression !== undefined) {
									const _errs11 = errors
									if (typeof data.isVisibleExpression !== 'string') {
										validate26.errors = [
											{
												instancePath: instancePath + '/isVisibleExpression',
												schemaPath: '#/$defs/commonFields/properties/isVisibleExpression/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										]
										return false
									}
									var valid2 = _errs11 === errors
								} else {
									var valid2 = true
								}
							}
						}
					}
				}
			}
		} else {
			validate26.errors = [
				{
					instancePath,
					schemaPath: '#/$defs/commonFields/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			]
			return false
		}
	}
	var valid0 = _errs0 === errors
	if (valid0) {
		const _errs13 = errors
		if (errors === _errs13) {
			if (data && typeof data == 'object' && !Array.isArray(data)) {
				let missing1
				if (
					(data.type === undefined && (missing1 = 'type')) ||
					(data.choices === undefined && (missing1 = 'choices'))
				) {
					validate26.errors = [
						{
							instancePath,
							schemaPath: '#/allOf/1/required',
							keyword: 'required',
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'",
						},
					]
					return false
				} else {
					const _errs15 = errors
					for (const key0 in data) {
						if (!(key0 === 'type' || key0 === 'choices' || key0 === 'default' || key0 === 'allowCustom')) {
							validate26.errors = [
								{
									instancePath,
									schemaPath: '#/allOf/1/additionalProperties',
									keyword: 'additionalProperties',
									params: { additionalProperty: key0 },
									message: 'must NOT have additional properties',
								},
							]
							return false
							break
						}
					}
					if (_errs15 === errors) {
						if (data.type !== undefined) {
							const _errs16 = errors
							if ('dropdown' !== data.type) {
								validate26.errors = [
									{
										instancePath: instancePath + '/type',
										schemaPath: '#/allOf/1/properties/type/const',
										keyword: 'const',
										params: { allowedValue: 'dropdown' },
										message: 'must be equal to constant',
									},
								]
								return false
							}
							var valid3 = _errs16 === errors
						} else {
							var valid3 = true
						}
						if (valid3) {
							if (data.choices !== undefined) {
								let data6 = data.choices
								const _errs17 = errors
								if (errors === _errs17) {
									if (Array.isArray(data6)) {
										if (data6.length < 1) {
											validate26.errors = [
												{
													instancePath: instancePath + '/choices',
													schemaPath: '#/allOf/1/properties/choices/minItems',
													keyword: 'minItems',
													params: { limit: 1 },
													message: 'must NOT have fewer than 1 items',
												},
											]
											return false
										} else {
											var valid4 = true
											const len0 = data6.length
											for (let i0 = 0; i0 < len0; i0++) {
												let data7 = data6[i0]
												const _errs19 = errors
												const _errs20 = errors
												if (errors === _errs20) {
													if (data7 && typeof data7 == 'object' && !Array.isArray(data7)) {
														let missing2
														if (
															(data7.id === undefined && (missing2 = 'id')) ||
															(data7.label === undefined && (missing2 = 'label'))
														) {
															validate26.errors = [
																{
																	instancePath: instancePath + '/choices/' + i0,
																	schemaPath: '#/$defs/dropdownChoice/required',
																	keyword: 'required',
																	params: { missingProperty: missing2 },
																	message: "must have required property '" + missing2 + "'",
																},
															]
															return false
														} else {
															const _errs22 = errors
															for (const key1 in data7) {
																if (!(key1 === 'id' || key1 === 'label')) {
																	validate26.errors = [
																		{
																			instancePath: instancePath + '/choices/' + i0,
																			schemaPath: '#/$defs/dropdownChoice/additionalProperties',
																			keyword: 'additionalProperties',
																			params: { additionalProperty: key1 },
																			message: 'must NOT have additional properties',
																		},
																	]
																	return false
																	break
																}
															}
															if (_errs22 === errors) {
																if (data7.id !== undefined) {
																	let data8 = data7.id
																	const _errs23 = errors
																	if (typeof data8 !== 'string' && !(typeof data8 == 'number' && isFinite(data8))) {
																		validate26.errors = [
																			{
																				instancePath: instancePath + '/choices/' + i0 + '/id',
																				schemaPath: '#/$defs/dropdownChoice/properties/id/type',
																				keyword: 'type',
																				params: { type: schema39.properties.id.type },
																				message: 'must be string,number',
																			},
																		]
																		return false
																	}
																	var valid6 = _errs23 === errors
																} else {
																	var valid6 = true
																}
																if (valid6) {
																	if (data7.label !== undefined) {
																		const _errs25 = errors
																		if (typeof data7.label !== 'string') {
																			validate26.errors = [
																				{
																					instancePath: instancePath + '/choices/' + i0 + '/label',
																					schemaPath: '#/$defs/dropdownChoice/properties/label/type',
																					keyword: 'type',
																					params: { type: 'string' },
																					message: 'must be string',
																				},
																			]
																			return false
																		}
																		var valid6 = _errs25 === errors
																	} else {
																		var valid6 = true
																	}
																}
															}
														}
													} else {
														validate26.errors = [
															{
																instancePath: instancePath + '/choices/' + i0,
																schemaPath: '#/$defs/dropdownChoice/type',
																keyword: 'type',
																params: { type: 'object' },
																message: 'must be object',
															},
														]
														return false
													}
												}
												var valid4 = _errs19 === errors
												if (!valid4) {
													break
												}
											}
										}
									} else {
										validate26.errors = [
											{
												instancePath: instancePath + '/choices',
												schemaPath: '#/allOf/1/properties/choices/type',
												keyword: 'type',
												params: { type: 'array' },
												message: 'must be array',
											},
										]
										return false
									}
								}
								var valid3 = _errs17 === errors
							} else {
								var valid3 = true
							}
							if (valid3) {
								if (data.default !== undefined) {
									let data10 = data.default
									const _errs27 = errors
									if (typeof data10 !== 'string' && !(typeof data10 == 'number' && isFinite(data10))) {
										validate26.errors = [
											{
												instancePath: instancePath + '/default',
												schemaPath: '#/allOf/1/properties/default/type',
												keyword: 'type',
												params: { type: schema37.allOf[1].properties.default.type },
												message: 'must be string,number',
											},
										]
										return false
									}
									var valid3 = _errs27 === errors
								} else {
									var valid3 = true
								}
								if (valid3) {
									if (data.allowCustom !== undefined) {
										const _errs29 = errors
										if (typeof data.allowCustom !== 'boolean') {
											validate26.errors = [
												{
													instancePath: instancePath + '/allowCustom',
													schemaPath: '#/allOf/1/properties/allowCustom/type',
													keyword: 'type',
													params: { type: 'boolean' },
													message: 'must be boolean',
												},
											]
											return false
										}
										var valid3 = _errs29 === errors
									} else {
										var valid3 = true
									}
								}
							}
						}
					}
				}
			} else {
				validate26.errors = [
					{
						instancePath,
						schemaPath: '#/allOf/1/type',
						keyword: 'type',
						params: { type: 'object' },
						message: 'must be object',
					},
				]
				return false
			}
		}
		var valid0 = _errs13 === errors
	}
	validate26.errors = vErrors
	return errors === 0
}
validate26.evaluated = { props: true, dynamicProps: false, dynamicItems: false }
const schema40 = {
	allOf: [
		{ $ref: '#/$defs/commonFields' },
		{
			type: 'object',
			properties: {
				type: { const: 'number' },
				min: { description: 'Minimum allowed value.', type: 'number' },
				max: { description: 'Maximum allowed value.', type: 'number' },
				default: { description: 'Default value.', type: 'number' },
				step: { description: 'Step increment for the input.', type: 'number' },
			},
			required: ['type', 'min', 'max'],
			additionalProperties: false,
		},
	],
}
function validate28(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}
) {
	let vErrors = null
	let errors = 0
	const evaluated0 = validate28.evaluated
	if (evaluated0.dynamicProps) {
		evaluated0.props = undefined
	}
	if (evaluated0.dynamicItems) {
		evaluated0.items = undefined
	}
	const _errs0 = errors
	const _errs1 = errors
	if (errors === _errs1) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0
			if ((data.id === undefined && (missing0 = 'id')) || (data.label === undefined && (missing0 = 'label'))) {
				validate28.errors = [
					{
						instancePath,
						schemaPath: '#/$defs/commonFields/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message: "must have required property '" + missing0 + "'",
					},
				]
				return false
			} else {
				if (data.id !== undefined) {
					const _errs3 = errors
					if (typeof data.id !== 'string') {
						validate28.errors = [
							{
								instancePath: instancePath + '/id',
								schemaPath: '#/$defs/commonFields/properties/id/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						]
						return false
					}
					var valid2 = _errs3 === errors
				} else {
					var valid2 = true
				}
				if (valid2) {
					if (data.label !== undefined) {
						const _errs5 = errors
						if (typeof data.label !== 'string') {
							validate28.errors = [
								{
									instancePath: instancePath + '/label',
									schemaPath: '#/$defs/commonFields/properties/label/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							]
							return false
						}
						var valid2 = _errs5 === errors
					} else {
						var valid2 = true
					}
					if (valid2) {
						if (data.description !== undefined) {
							const _errs7 = errors
							if (typeof data.description !== 'string') {
								validate28.errors = [
									{
										instancePath: instancePath + '/description',
										schemaPath: '#/$defs/commonFields/properties/description/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								]
								return false
							}
							var valid2 = _errs7 === errors
						} else {
							var valid2 = true
						}
						if (valid2) {
							if (data.tooltip !== undefined) {
								const _errs9 = errors
								if (typeof data.tooltip !== 'string') {
									validate28.errors = [
										{
											instancePath: instancePath + '/tooltip',
											schemaPath: '#/$defs/commonFields/properties/tooltip/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								var valid2 = _errs9 === errors
							} else {
								var valid2 = true
							}
							if (valid2) {
								if (data.isVisibleExpression !== undefined) {
									const _errs11 = errors
									if (typeof data.isVisibleExpression !== 'string') {
										validate28.errors = [
											{
												instancePath: instancePath + '/isVisibleExpression',
												schemaPath: '#/$defs/commonFields/properties/isVisibleExpression/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										]
										return false
									}
									var valid2 = _errs11 === errors
								} else {
									var valid2 = true
								}
							}
						}
					}
				}
			}
		} else {
			validate28.errors = [
				{
					instancePath,
					schemaPath: '#/$defs/commonFields/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			]
			return false
		}
	}
	var valid0 = _errs0 === errors
	if (valid0) {
		const _errs13 = errors
		if (errors === _errs13) {
			if (data && typeof data == 'object' && !Array.isArray(data)) {
				let missing1
				if (
					(data.type === undefined && (missing1 = 'type')) ||
					(data.min === undefined && (missing1 = 'min')) ||
					(data.max === undefined && (missing1 = 'max'))
				) {
					validate28.errors = [
						{
							instancePath,
							schemaPath: '#/allOf/1/required',
							keyword: 'required',
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'",
						},
					]
					return false
				} else {
					const _errs15 = errors
					for (const key0 in data) {
						if (!(key0 === 'type' || key0 === 'min' || key0 === 'max' || key0 === 'default' || key0 === 'step')) {
							validate28.errors = [
								{
									instancePath,
									schemaPath: '#/allOf/1/additionalProperties',
									keyword: 'additionalProperties',
									params: { additionalProperty: key0 },
									message: 'must NOT have additional properties',
								},
							]
							return false
							break
						}
					}
					if (_errs15 === errors) {
						if (data.type !== undefined) {
							const _errs16 = errors
							if ('number' !== data.type) {
								validate28.errors = [
									{
										instancePath: instancePath + '/type',
										schemaPath: '#/allOf/1/properties/type/const',
										keyword: 'const',
										params: { allowedValue: 'number' },
										message: 'must be equal to constant',
									},
								]
								return false
							}
							var valid3 = _errs16 === errors
						} else {
							var valid3 = true
						}
						if (valid3) {
							if (data.min !== undefined) {
								let data6 = data.min
								const _errs17 = errors
								if (!(typeof data6 == 'number' && isFinite(data6))) {
									validate28.errors = [
										{
											instancePath: instancePath + '/min',
											schemaPath: '#/allOf/1/properties/min/type',
											keyword: 'type',
											params: { type: 'number' },
											message: 'must be number',
										},
									]
									return false
								}
								var valid3 = _errs17 === errors
							} else {
								var valid3 = true
							}
							if (valid3) {
								if (data.max !== undefined) {
									let data7 = data.max
									const _errs19 = errors
									if (!(typeof data7 == 'number' && isFinite(data7))) {
										validate28.errors = [
											{
												instancePath: instancePath + '/max',
												schemaPath: '#/allOf/1/properties/max/type',
												keyword: 'type',
												params: { type: 'number' },
												message: 'must be number',
											},
										]
										return false
									}
									var valid3 = _errs19 === errors
								} else {
									var valid3 = true
								}
								if (valid3) {
									if (data.default !== undefined) {
										let data8 = data.default
										const _errs21 = errors
										if (!(typeof data8 == 'number' && isFinite(data8))) {
											validate28.errors = [
												{
													instancePath: instancePath + '/default',
													schemaPath: '#/allOf/1/properties/default/type',
													keyword: 'type',
													params: { type: 'number' },
													message: 'must be number',
												},
											]
											return false
										}
										var valid3 = _errs21 === errors
									} else {
										var valid3 = true
									}
									if (valid3) {
										if (data.step !== undefined) {
											let data9 = data.step
											const _errs23 = errors
											if (!(typeof data9 == 'number' && isFinite(data9))) {
												validate28.errors = [
													{
														instancePath: instancePath + '/step',
														schemaPath: '#/allOf/1/properties/step/type',
														keyword: 'type',
														params: { type: 'number' },
														message: 'must be number',
													},
												]
												return false
											}
											var valid3 = _errs23 === errors
										} else {
											var valid3 = true
										}
									}
								}
							}
						}
					}
				}
			} else {
				validate28.errors = [
					{
						instancePath,
						schemaPath: '#/allOf/1/type',
						keyword: 'type',
						params: { type: 'object' },
						message: 'must be object',
					},
				]
				return false
			}
		}
		var valid0 = _errs13 === errors
	}
	validate28.errors = vErrors
	return errors === 0
}
validate28.evaluated = { props: true, dynamicProps: false, dynamicItems: false }
const schema42 = {
	allOf: [
		{ $ref: '#/$defs/commonFields' },
		{
			type: 'object',
			properties: { type: { const: 'checkbox' }, default: { description: 'Default checked state.', type: 'boolean' } },
			required: ['type'],
			additionalProperties: false,
		},
	],
}
function validate30(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}
) {
	let vErrors = null
	let errors = 0
	const evaluated0 = validate30.evaluated
	if (evaluated0.dynamicProps) {
		evaluated0.props = undefined
	}
	if (evaluated0.dynamicItems) {
		evaluated0.items = undefined
	}
	const _errs0 = errors
	const _errs1 = errors
	if (errors === _errs1) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0
			if ((data.id === undefined && (missing0 = 'id')) || (data.label === undefined && (missing0 = 'label'))) {
				validate30.errors = [
					{
						instancePath,
						schemaPath: '#/$defs/commonFields/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message: "must have required property '" + missing0 + "'",
					},
				]
				return false
			} else {
				if (data.id !== undefined) {
					const _errs3 = errors
					if (typeof data.id !== 'string') {
						validate30.errors = [
							{
								instancePath: instancePath + '/id',
								schemaPath: '#/$defs/commonFields/properties/id/type',
								keyword: 'type',
								params: { type: 'string' },
								message: 'must be string',
							},
						]
						return false
					}
					var valid2 = _errs3 === errors
				} else {
					var valid2 = true
				}
				if (valid2) {
					if (data.label !== undefined) {
						const _errs5 = errors
						if (typeof data.label !== 'string') {
							validate30.errors = [
								{
									instancePath: instancePath + '/label',
									schemaPath: '#/$defs/commonFields/properties/label/type',
									keyword: 'type',
									params: { type: 'string' },
									message: 'must be string',
								},
							]
							return false
						}
						var valid2 = _errs5 === errors
					} else {
						var valid2 = true
					}
					if (valid2) {
						if (data.description !== undefined) {
							const _errs7 = errors
							if (typeof data.description !== 'string') {
								validate30.errors = [
									{
										instancePath: instancePath + '/description',
										schemaPath: '#/$defs/commonFields/properties/description/type',
										keyword: 'type',
										params: { type: 'string' },
										message: 'must be string',
									},
								]
								return false
							}
							var valid2 = _errs7 === errors
						} else {
							var valid2 = true
						}
						if (valid2) {
							if (data.tooltip !== undefined) {
								const _errs9 = errors
								if (typeof data.tooltip !== 'string') {
									validate30.errors = [
										{
											instancePath: instancePath + '/tooltip',
											schemaPath: '#/$defs/commonFields/properties/tooltip/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								var valid2 = _errs9 === errors
							} else {
								var valid2 = true
							}
							if (valid2) {
								if (data.isVisibleExpression !== undefined) {
									const _errs11 = errors
									if (typeof data.isVisibleExpression !== 'string') {
										validate30.errors = [
											{
												instancePath: instancePath + '/isVisibleExpression',
												schemaPath: '#/$defs/commonFields/properties/isVisibleExpression/type',
												keyword: 'type',
												params: { type: 'string' },
												message: 'must be string',
											},
										]
										return false
									}
									var valid2 = _errs11 === errors
								} else {
									var valid2 = true
								}
							}
						}
					}
				}
			}
		} else {
			validate30.errors = [
				{
					instancePath,
					schemaPath: '#/$defs/commonFields/type',
					keyword: 'type',
					params: { type: 'object' },
					message: 'must be object',
				},
			]
			return false
		}
	}
	var valid0 = _errs0 === errors
	if (valid0) {
		const _errs13 = errors
		if (errors === _errs13) {
			if (data && typeof data == 'object' && !Array.isArray(data)) {
				let missing1
				if (data.type === undefined && (missing1 = 'type')) {
					validate30.errors = [
						{
							instancePath,
							schemaPath: '#/allOf/1/required',
							keyword: 'required',
							params: { missingProperty: missing1 },
							message: "must have required property '" + missing1 + "'",
						},
					]
					return false
				} else {
					const _errs15 = errors
					for (const key0 in data) {
						if (!(key0 === 'type' || key0 === 'default')) {
							validate30.errors = [
								{
									instancePath,
									schemaPath: '#/allOf/1/additionalProperties',
									keyword: 'additionalProperties',
									params: { additionalProperty: key0 },
									message: 'must NOT have additional properties',
								},
							]
							return false
							break
						}
					}
					if (_errs15 === errors) {
						if (data.type !== undefined) {
							const _errs16 = errors
							if ('checkbox' !== data.type) {
								validate30.errors = [
									{
										instancePath: instancePath + '/type',
										schemaPath: '#/allOf/1/properties/type/const',
										keyword: 'const',
										params: { allowedValue: 'checkbox' },
										message: 'must be equal to constant',
									},
								]
								return false
							}
							var valid3 = _errs16 === errors
						} else {
							var valid3 = true
						}
						if (valid3) {
							if (data.default !== undefined) {
								const _errs17 = errors
								if (typeof data.default !== 'boolean') {
									validate30.errors = [
										{
											instancePath: instancePath + '/default',
											schemaPath: '#/allOf/1/properties/default/type',
											keyword: 'type',
											params: { type: 'boolean' },
											message: 'must be boolean',
										},
									]
									return false
								}
								var valid3 = _errs17 === errors
							} else {
								var valid3 = true
							}
						}
					}
				}
			} else {
				validate30.errors = [
					{
						instancePath,
						schemaPath: '#/allOf/1/type',
						keyword: 'type',
						params: { type: 'object' },
						message: 'must be object',
					},
				]
				return false
			}
		}
		var valid0 = _errs13 === errors
	}
	validate30.errors = vErrors
	return errors === 0
}
validate30.evaluated = { props: true, dynamicProps: false, dynamicItems: false }
function validate21(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}
) {
	let vErrors = null
	let errors = 0
	const evaluated0 = validate21.evaluated
	if (evaluated0.dynamicProps) {
		evaluated0.props = undefined
	}
	if (evaluated0.dynamicItems) {
		evaluated0.items = undefined
	}
	const _errs0 = errors
	let valid0 = false
	let passing0 = null
	const _errs1 = errors
	if (!validate22(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
		vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors)
		errors = vErrors.length
	}
	var _valid0 = _errs1 === errors
	if (_valid0) {
		valid0 = true
		passing0 = 0
		var props0 = true
	}
	const _errs2 = errors
	if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
		vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors)
		errors = vErrors.length
	}
	var _valid0 = _errs2 === errors
	if (_valid0 && valid0) {
		valid0 = false
		passing0 = [passing0, 1]
	} else {
		if (_valid0) {
			valid0 = true
			passing0 = 1
			if (props0 !== true) {
				props0 = true
			}
		}
		const _errs3 = errors
		if (!validate26(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
			vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors)
			errors = vErrors.length
		}
		var _valid0 = _errs3 === errors
		if (_valid0 && valid0) {
			valid0 = false
			passing0 = [passing0, 2]
		} else {
			if (_valid0) {
				valid0 = true
				passing0 = 2
				if (props0 !== true) {
					props0 = true
				}
			}
			const _errs4 = errors
			if (!validate28(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
				vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors)
				errors = vErrors.length
			}
			var _valid0 = _errs4 === errors
			if (_valid0 && valid0) {
				valid0 = false
				passing0 = [passing0, 3]
			} else {
				if (_valid0) {
					valid0 = true
					passing0 = 3
					if (props0 !== true) {
						props0 = true
					}
				}
				const _errs5 = errors
				if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
					vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors)
					errors = vErrors.length
				}
				var _valid0 = _errs5 === errors
				if (_valid0 && valid0) {
					valid0 = false
					passing0 = [passing0, 4]
				} else {
					if (_valid0) {
						valid0 = true
						passing0 = 4
						if (props0 !== true) {
							props0 = true
						}
					}
				}
			}
		}
	}
	if (!valid0) {
		const err0 = {
			instancePath,
			schemaPath: '#/oneOf',
			keyword: 'oneOf',
			params: { passingSchemas: passing0 },
			message: 'must match exactly one schema in oneOf',
		}
		if (vErrors === null) {
			vErrors = [err0]
		} else {
			vErrors.push(err0)
		}
		errors++
		validate21.errors = vErrors
		return false
	} else {
		errors = _errs0
		if (vErrors !== null) {
			if (_errs0) {
				vErrors.length = _errs0
			} else {
				vErrors = null
			}
		}
	}
	validate21.errors = vErrors
	evaluated0.props = props0
	return errors === 0
}
validate21.evaluated = { dynamicProps: true, dynamicItems: false }
function validate20(
	data,
	{ instancePath = '', parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}
) {
	let vErrors = null
	let errors = 0
	const evaluated0 = validate20.evaluated
	if (evaluated0.dynamicProps) {
		evaluated0.props = undefined
	}
	if (evaluated0.dynamicItems) {
		evaluated0.items = undefined
	}
	if (errors === 0) {
		if (Array.isArray(data)) {
			var valid0 = true
			const len0 = data.length
			for (let i0 = 0; i0 < len0; i0++) {
				const _errs1 = errors
				if (
					!validate21(data[i0], {
						instancePath: instancePath + '/' + i0,
						parentData: data,
						parentDataProperty: i0,
						rootData,
						dynamicAnchors,
					})
				) {
					vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors)
					errors = vErrors.length
				}
				var valid0 = _errs1 === errors
				if (!valid0) {
					break
				}
			}
		} else {
			validate20.errors = [
				{ instancePath, schemaPath: '#/type', keyword: 'type', params: { type: 'array' }, message: 'must be array' },
			]
			return false
		}
	}
	validate20.errors = vErrors
	return errors === 0
}
validate20.evaluated = { items: true, dynamicProps: false, dynamicItems: false }
