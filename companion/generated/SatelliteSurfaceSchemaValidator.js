/* eslint-disable */
'use strict'
export const validate = validate20
export default validate20
const schema31 = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	title: 'Satellite Surface Layout',
	description:
		'Schema describing a satellite surface layout: default styling and a map of controls with positions and optional style overrides.',
	type: 'object',
	$defs: {
		size: {
			title: 'SatelliteConfigSize',
			description: 'Pixel size for bitmap content.',
			type: 'object',
			properties: {
				w: { description: 'Width in pixels (non-negative).', type: 'number', minimum: 0 },
				h: { description: 'Height in pixels (non-negative).', type: 'number', minimum: 0 },
			},
			required: ['w', 'h'],
			additionalProperties: false,
		},
		stylePreset: {
			title: 'SatelliteControlStylePreset',
			description:
				'Styling options that can be applied to controls. Can be used as the default style or as per-control overrides.',
			type: 'object',
			properties: {
				bitmap: { description: 'If set, bitmaps of the specified size will be reported.', $ref: '#/$defs/size' },
				text: { description: 'If true, the control requests text to be reported.', type: 'boolean' },
				textStyle: {
					description: 'If true, the control requests text style properties to be reported',
					type: 'boolean',
				},
				colors: {
					description: 'If set, the control requests colours to be reported.',
					type: 'string',
					enum: ['hex', 'rgb'],
				},
			},
			additionalProperties: false,
		},
	},
	properties: {
		stylePresets: {
			description:
				'Named collection of style presets. The preset named `default` is required and is used as the fallback style for controls when no `stylePreset` is specified.',
			type: 'object',
			properties: { default: { $ref: '#/$defs/stylePreset' } },
			patternProperties: { '^.+$': { $ref: '#/$defs/stylePreset' } },
			required: ['default'],
			additionalProperties: false,
		},
		controls: {
			type: 'object',
			patternProperties: {
				'^[a-zA-Z0-9\\-\\/]+$': {
					title: 'SatelliteControlDefinition',
					description:
						'Single control definition. The id must be unique and may be user facing in logs. Typically the id would be in the form of 1/0, matching the row/column of the control.',
					type: 'object',
					properties: {
						row: { description: 'Zero-based row index for layout placement.', type: 'number', minimum: 0 },
						column: { description: 'Zero-based column index for layout placement.', type: 'number', minimum: 0 },
						stylePreset: {
							description:
								'Optional name of a style preset defined in `stylePresets`. If present, the control will use the named preset instead of the default style.',
							type: 'string',
							pattern: '^.+$',
						},
					},
					required: ['row', 'column'],
					additionalProperties: false,
				},
			},
			additionalProperties: false,
		},
	},
	required: ['stylePresets', 'controls'],
	additionalProperties: false,
}
const pattern4 = new RegExp('^.+$', 'u')
const pattern6 = new RegExp('^[a-zA-Z0-9\\-\\/]+$', 'u')
const schema32 = {
	title: 'SatelliteControlStylePreset',
	description:
		'Styling options that can be applied to controls. Can be used as the default style or as per-control overrides.',
	type: 'object',
	properties: {
		bitmap: { description: 'If set, bitmaps of the specified size will be reported.', $ref: '#/$defs/size' },
		text: { description: 'If true, the control requests text to be reported.', type: 'boolean' },
		textStyle: { description: 'If true, the control requests text style properties to be reported', type: 'boolean' },
		colors: {
			description: 'If set, the control requests colours to be reported.',
			type: 'string',
			enum: ['hex', 'rgb'],
		},
	},
	additionalProperties: false,
}
const schema33 = {
	title: 'SatelliteConfigSize',
	description: 'Pixel size for bitmap content.',
	type: 'object',
	properties: {
		w: { description: 'Width in pixels (non-negative).', type: 'number', minimum: 0 },
		h: { description: 'Height in pixels (non-negative).', type: 'number', minimum: 0 },
	},
	required: ['w', 'h'],
	additionalProperties: false,
}
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
	if (errors === 0) {
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			const _errs1 = errors
			for (const key0 in data) {
				if (!(key0 === 'bitmap' || key0 === 'text' || key0 === 'textStyle' || key0 === 'colors')) {
					validate21.errors = [
						{
							instancePath,
							schemaPath: '#/additionalProperties',
							keyword: 'additionalProperties',
							params: { additionalProperty: key0 },
							message: 'must NOT have additional properties',
						},
					]
					return false
					break
				}
			}
			if (_errs1 === errors) {
				if (data.bitmap !== undefined) {
					let data0 = data.bitmap
					const _errs2 = errors
					const _errs3 = errors
					if (errors === _errs3) {
						if (data0 && typeof data0 == 'object' && !Array.isArray(data0)) {
							let missing0
							if ((data0.w === undefined && (missing0 = 'w')) || (data0.h === undefined && (missing0 = 'h'))) {
								validate21.errors = [
									{
										instancePath: instancePath + '/bitmap',
										schemaPath: '#/$defs/size/required',
										keyword: 'required',
										params: { missingProperty: missing0 },
										message: "must have required property '" + missing0 + "'",
									},
								]
								return false
							} else {
								const _errs5 = errors
								for (const key1 in data0) {
									if (!(key1 === 'w' || key1 === 'h')) {
										validate21.errors = [
											{
												instancePath: instancePath + '/bitmap',
												schemaPath: '#/$defs/size/additionalProperties',
												keyword: 'additionalProperties',
												params: { additionalProperty: key1 },
												message: 'must NOT have additional properties',
											},
										]
										return false
										break
									}
								}
								if (_errs5 === errors) {
									if (data0.w !== undefined) {
										let data1 = data0.w
										const _errs6 = errors
										if (errors === _errs6) {
											if (typeof data1 == 'number' && isFinite(data1)) {
												if (data1 < 0 || isNaN(data1)) {
													validate21.errors = [
														{
															instancePath: instancePath + '/bitmap/w',
															schemaPath: '#/$defs/size/properties/w/minimum',
															keyword: 'minimum',
															params: { comparison: '>=', limit: 0 },
															message: 'must be >= 0',
														},
													]
													return false
												}
											} else {
												validate21.errors = [
													{
														instancePath: instancePath + '/bitmap/w',
														schemaPath: '#/$defs/size/properties/w/type',
														keyword: 'type',
														params: { type: 'number' },
														message: 'must be number',
													},
												]
												return false
											}
										}
										var valid2 = _errs6 === errors
									} else {
										var valid2 = true
									}
									if (valid2) {
										if (data0.h !== undefined) {
											let data2 = data0.h
											const _errs8 = errors
											if (errors === _errs8) {
												if (typeof data2 == 'number' && isFinite(data2)) {
													if (data2 < 0 || isNaN(data2)) {
														validate21.errors = [
															{
																instancePath: instancePath + '/bitmap/h',
																schemaPath: '#/$defs/size/properties/h/minimum',
																keyword: 'minimum',
																params: { comparison: '>=', limit: 0 },
																message: 'must be >= 0',
															},
														]
														return false
													}
												} else {
													validate21.errors = [
														{
															instancePath: instancePath + '/bitmap/h',
															schemaPath: '#/$defs/size/properties/h/type',
															keyword: 'type',
															params: { type: 'number' },
															message: 'must be number',
														},
													]
													return false
												}
											}
											var valid2 = _errs8 === errors
										} else {
											var valid2 = true
										}
									}
								}
							}
						} else {
							validate21.errors = [
								{
									instancePath: instancePath + '/bitmap',
									schemaPath: '#/$defs/size/type',
									keyword: 'type',
									params: { type: 'object' },
									message: 'must be object',
								},
							]
							return false
						}
					}
					var valid0 = _errs2 === errors
				} else {
					var valid0 = true
				}
				if (valid0) {
					if (data.text !== undefined) {
						const _errs10 = errors
						if (typeof data.text !== 'boolean') {
							validate21.errors = [
								{
									instancePath: instancePath + '/text',
									schemaPath: '#/properties/text/type',
									keyword: 'type',
									params: { type: 'boolean' },
									message: 'must be boolean',
								},
							]
							return false
						}
						var valid0 = _errs10 === errors
					} else {
						var valid0 = true
					}
					if (valid0) {
						if (data.textStyle !== undefined) {
							const _errs12 = errors
							if (typeof data.textStyle !== 'boolean') {
								validate21.errors = [
									{
										instancePath: instancePath + '/textStyle',
										schemaPath: '#/properties/textStyle/type',
										keyword: 'type',
										params: { type: 'boolean' },
										message: 'must be boolean',
									},
								]
								return false
							}
							var valid0 = _errs12 === errors
						} else {
							var valid0 = true
						}
						if (valid0) {
							if (data.colors !== undefined) {
								let data5 = data.colors
								const _errs14 = errors
								if (typeof data5 !== 'string') {
									validate21.errors = [
										{
											instancePath: instancePath + '/colors',
											schemaPath: '#/properties/colors/type',
											keyword: 'type',
											params: { type: 'string' },
											message: 'must be string',
										},
									]
									return false
								}
								if (!(data5 === 'hex' || data5 === 'rgb')) {
									validate21.errors = [
										{
											instancePath: instancePath + '/colors',
											schemaPath: '#/properties/colors/enum',
											keyword: 'enum',
											params: { allowedValues: schema32.properties.colors.enum },
											message: 'must be equal to one of the allowed values',
										},
									]
									return false
								}
								var valid0 = _errs14 === errors
							} else {
								var valid0 = true
							}
						}
					}
				}
			}
		} else {
			validate21.errors = [
				{ instancePath, schemaPath: '#/type', keyword: 'type', params: { type: 'object' }, message: 'must be object' },
			]
			return false
		}
	}
	validate21.errors = vErrors
	return errors === 0
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false }
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
		if (data && typeof data == 'object' && !Array.isArray(data)) {
			let missing0
			if (
				(data.stylePresets === undefined && (missing0 = 'stylePresets')) ||
				(data.controls === undefined && (missing0 = 'controls'))
			) {
				validate20.errors = [
					{
						instancePath,
						schemaPath: '#/required',
						keyword: 'required',
						params: { missingProperty: missing0 },
						message: "must have required property '" + missing0 + "'",
					},
				]
				return false
			} else {
				const _errs1 = errors
				for (const key0 in data) {
					if (!(key0 === 'stylePresets' || key0 === 'controls')) {
						validate20.errors = [
							{
								instancePath,
								schemaPath: '#/additionalProperties',
								keyword: 'additionalProperties',
								params: { additionalProperty: key0 },
								message: 'must NOT have additional properties',
							},
						]
						return false
						break
					}
				}
				if (_errs1 === errors) {
					if (data.stylePresets !== undefined) {
						let data0 = data.stylePresets
						const _errs2 = errors
						if (errors === _errs2) {
							if (data0 && typeof data0 == 'object' && !Array.isArray(data0)) {
								let missing1
								if (data0.default === undefined && (missing1 = 'default')) {
									validate20.errors = [
										{
											instancePath: instancePath + '/stylePresets',
											schemaPath: '#/properties/stylePresets/required',
											keyword: 'required',
											params: { missingProperty: missing1 },
											message: "must have required property '" + missing1 + "'",
										},
									]
									return false
								} else {
									const _errs4 = errors
									for (const key1 in data0) {
										if (!(key1 === 'default' || pattern4.test(key1))) {
											validate20.errors = [
												{
													instancePath: instancePath + '/stylePresets',
													schemaPath: '#/properties/stylePresets/additionalProperties',
													keyword: 'additionalProperties',
													params: { additionalProperty: key1 },
													message: 'must NOT have additional properties',
												},
											]
											return false
											break
										}
									}
									if (_errs4 === errors) {
										if (data0.default !== undefined) {
											const _errs5 = errors
											if (
												!validate21(data0.default, {
													instancePath: instancePath + '/stylePresets/default',
													parentData: data0,
													parentDataProperty: 'default',
													rootData,
													dynamicAnchors,
												})
											) {
												vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors)
												errors = vErrors.length
											}
											var valid1 = _errs5 === errors
										} else {
											var valid1 = true
										}
										if (valid1) {
											var valid2 = true
											for (const key2 in data0) {
												if (pattern4.test(key2)) {
													const _errs6 = errors
													if (
														!validate21(data0[key2], {
															instancePath:
																instancePath + '/stylePresets/' + key2.replace(/~/g, '~0').replace(/\//g, '~1'),
															parentData: data0,
															parentDataProperty: key2,
															rootData,
															dynamicAnchors,
														})
													) {
														vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors)
														errors = vErrors.length
													}
													var valid2 = _errs6 === errors
													if (!valid2) {
														break
													}
												}
											}
										}
									}
								}
							} else {
								validate20.errors = [
									{
										instancePath: instancePath + '/stylePresets',
										schemaPath: '#/properties/stylePresets/type',
										keyword: 'type',
										params: { type: 'object' },
										message: 'must be object',
									},
								]
								return false
							}
						}
						var valid0 = _errs2 === errors
					} else {
						var valid0 = true
					}
					if (valid0) {
						if (data.controls !== undefined) {
							let data3 = data.controls
							const _errs7 = errors
							if (errors === _errs7) {
								if (data3 && typeof data3 == 'object' && !Array.isArray(data3)) {
									const _errs9 = errors
									for (const key3 in data3) {
										if (!pattern6.test(key3)) {
											validate20.errors = [
												{
													instancePath: instancePath + '/controls',
													schemaPath: '#/properties/controls/additionalProperties',
													keyword: 'additionalProperties',
													params: { additionalProperty: key3 },
													message: 'must NOT have additional properties',
												},
											]
											return false
											break
										}
									}
									if (_errs9 === errors) {
										var valid3 = true
										for (const key4 in data3) {
											if (pattern6.test(key4)) {
												let data4 = data3[key4]
												const _errs10 = errors
												if (errors === _errs10) {
													if (data4 && typeof data4 == 'object' && !Array.isArray(data4)) {
														let missing2
														if (
															(data4.row === undefined && (missing2 = 'row')) ||
															(data4.column === undefined && (missing2 = 'column'))
														) {
															validate20.errors = [
																{
																	instancePath:
																		instancePath + '/controls/' + key4.replace(/~/g, '~0').replace(/\//g, '~1'),
																	schemaPath:
																		'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/required',
																	keyword: 'required',
																	params: { missingProperty: missing2 },
																	message: "must have required property '" + missing2 + "'",
																},
															]
															return false
														} else {
															const _errs12 = errors
															for (const key5 in data4) {
																if (!(key5 === 'row' || key5 === 'column' || key5 === 'stylePreset')) {
																	validate20.errors = [
																		{
																			instancePath:
																				instancePath + '/controls/' + key4.replace(/~/g, '~0').replace(/\//g, '~1'),
																			schemaPath:
																				'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/additionalProperties',
																			keyword: 'additionalProperties',
																			params: { additionalProperty: key5 },
																			message: 'must NOT have additional properties',
																		},
																	]
																	return false
																	break
																}
															}
															if (_errs12 === errors) {
																if (data4.row !== undefined) {
																	let data5 = data4.row
																	const _errs13 = errors
																	if (errors === _errs13) {
																		if (typeof data5 == 'number' && isFinite(data5)) {
																			if (data5 < 0 || isNaN(data5)) {
																				validate20.errors = [
																					{
																						instancePath:
																							instancePath +
																							'/controls/' +
																							key4.replace(/~/g, '~0').replace(/\//g, '~1') +
																							'/row',
																						schemaPath:
																							'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/properties/row/minimum',
																						keyword: 'minimum',
																						params: { comparison: '>=', limit: 0 },
																						message: 'must be >= 0',
																					},
																				]
																				return false
																			}
																		} else {
																			validate20.errors = [
																				{
																					instancePath:
																						instancePath +
																						'/controls/' +
																						key4.replace(/~/g, '~0').replace(/\//g, '~1') +
																						'/row',
																					schemaPath:
																						'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/properties/row/type',
																					keyword: 'type',
																					params: { type: 'number' },
																					message: 'must be number',
																				},
																			]
																			return false
																		}
																	}
																	var valid4 = _errs13 === errors
																} else {
																	var valid4 = true
																}
																if (valid4) {
																	if (data4.column !== undefined) {
																		let data6 = data4.column
																		const _errs15 = errors
																		if (errors === _errs15) {
																			if (typeof data6 == 'number' && isFinite(data6)) {
																				if (data6 < 0 || isNaN(data6)) {
																					validate20.errors = [
																						{
																							instancePath:
																								instancePath +
																								'/controls/' +
																								key4.replace(/~/g, '~0').replace(/\//g, '~1') +
																								'/column',
																							schemaPath:
																								'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/properties/column/minimum',
																							keyword: 'minimum',
																							params: { comparison: '>=', limit: 0 },
																							message: 'must be >= 0',
																						},
																					]
																					return false
																				}
																			} else {
																				validate20.errors = [
																					{
																						instancePath:
																							instancePath +
																							'/controls/' +
																							key4.replace(/~/g, '~0').replace(/\//g, '~1') +
																							'/column',
																						schemaPath:
																							'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/properties/column/type',
																						keyword: 'type',
																						params: { type: 'number' },
																						message: 'must be number',
																					},
																				]
																				return false
																			}
																		}
																		var valid4 = _errs15 === errors
																	} else {
																		var valid4 = true
																	}
																	if (valid4) {
																		if (data4.stylePreset !== undefined) {
																			let data7 = data4.stylePreset
																			const _errs17 = errors
																			if (errors === _errs17) {
																				if (typeof data7 === 'string') {
																					if (!pattern4.test(data7)) {
																						validate20.errors = [
																							{
																								instancePath:
																									instancePath +
																									'/controls/' +
																									key4.replace(/~/g, '~0').replace(/\//g, '~1') +
																									'/stylePreset',
																								schemaPath:
																									'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/properties/stylePreset/pattern',
																								keyword: 'pattern',
																								params: { pattern: '^.+$' },
																								message: 'must match pattern "' + '^.+$' + '"',
																							},
																						]
																						return false
																					}
																				} else {
																					validate20.errors = [
																						{
																							instancePath:
																								instancePath +
																								'/controls/' +
																								key4.replace(/~/g, '~0').replace(/\//g, '~1') +
																								'/stylePreset',
																							schemaPath:
																								'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/properties/stylePreset/type',
																							keyword: 'type',
																							params: { type: 'string' },
																							message: 'must be string',
																						},
																					]
																					return false
																				}
																			}
																			var valid4 = _errs17 === errors
																		} else {
																			var valid4 = true
																		}
																	}
																}
															}
														}
													} else {
														validate20.errors = [
															{
																instancePath:
																	instancePath + '/controls/' + key4.replace(/~/g, '~0').replace(/\//g, '~1'),
																schemaPath:
																	'#/properties/controls/patternProperties/%5E%5Ba-zA-Z0-9%5C-%5C~1%5D%2B%24/type',
																keyword: 'type',
																params: { type: 'object' },
																message: 'must be object',
															},
														]
														return false
													}
												}
												var valid3 = _errs10 === errors
												if (!valid3) {
													break
												}
											}
										}
									}
								} else {
									validate20.errors = [
										{
											instancePath: instancePath + '/controls',
											schemaPath: '#/properties/controls/type',
											keyword: 'type',
											params: { type: 'object' },
											message: 'must be object',
										},
									]
									return false
								}
							}
							var valid0 = _errs7 === errors
						} else {
							var valid0 = true
						}
					}
				}
			}
		} else {
			validate20.errors = [
				{ instancePath, schemaPath: '#/type', keyword: 'type', params: { type: 'object' }, message: 'must be object' },
			]
			return false
		}
	}
	validate20.errors = vErrors
	return errors === 0
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false }
