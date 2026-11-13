import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import Express from 'express'
import isEqual from 'fast-deep-equal'
import type { JsonValue } from 'type-fest'
import z from 'zod'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import { ParseExpression } from '@companion-app/shared/Expressions.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import {
	SomeButtonGraphicsElementSchema,
	type SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { CompositeElementDefinition, InstanceDefinitions } from '../Instance/Definitions.js'
import type { IPageStore } from '../Page/Store.js'
import { RestApiError } from '../Service/RestApi/errors.js'
import {
	createSuccessSchema,
	errorResponses,
	ErrorResponseSchema,
	successResponse,
} from '../Service/RestApi/schemas/common.js'
import {
	createRestEndpointSpecFactory,
	mountRestEndpoint,
	registerRestEndpoint,
	type RestEndpointSpec,
} from '../Service/RestApi/typedRoute.js'
import { isStructuralStyleElementKey } from './ControlTypes/Button/LayeredButtonStyleEditor.js'
import type { EditableEntityListPool } from './Entities/EntityListPoolEditingMixin.js'
import type { SomeControl } from './IControlFragments.js'

export const BUTTONS_API_BASE_PATH = '/buttons/v1'
const BUTTONS_API_TAGS = ['Buttons']

/** A value that is either fixed, or an expression evaluated when it is used */
export const ExpressionOrValueSchema = z
	.union([
		z
			.object({
				isExpression: z.literal(false).describe('A fixed value.'),
				value: z.unknown().optional().describe('The value. Its type depends on the option. Left out when unset.'),
			})
			.strict(),
		z
			.object({
				isExpression: z.literal(true).describe('An expression, evaluated each time the value is used.'),
				value: z.string().describe('The expression.'),
			})
			.strict(),
	])
	.meta({ id: 'ExpressionOrValue', example: { isExpression: false, value: 'Camera 1' } })

/** An option value as the API sends it. A value left unset has no `value` */
type ExpressionOrValueResponse = z.infer<typeof ExpressionOrValueSchema>

const OptionValuesSchema = z.record(z.string(), ExpressionOrValueSchema)

/** The JSON body was parsed into these, so the unknown values are JSON */
function asOptionValues(
	values: z.infer<typeof OptionValuesSchema>
): Record<string, ExpressionOrValue<JsonValue | undefined>> {
	return values as Record<string, ExpressionOrValue<JsonValue | undefined>>
}

export const ButtonLocationSchema = z
	.object({
		pageId: z.string().describe('Unique page id.').meta({ example: 'ggmHXCUQ0RRXUwEr8HHtQ' }),
		pageNumber: z.number().describe('Position of the page in the page list.').meta({ example: 1 }),
		row: z.number().describe('Row of the button on the page.').meta({ example: 0 }),
		column: z.number().describe('Column of the button on the page.').meta({ example: 1 }),
	})
	.meta({ id: 'ButtonLocation' })

export interface ActionResponse {
	id: string
	type: 'action' | 'feedback'
	connectionId: string
	definitionId: string
	enabled: boolean
	headline: string | null
	options: Record<string, ExpressionOrValueResponse>
	children: Record<string, ActionResponse[]> | null
}

export const ActionResponseSchema: z.ZodType<ActionResponse> = z
	.object({
		id: z.string().describe('Unique action id within the button.').meta({ example: 'Ys0bqVZ1kKUlH2hSmmT6m' }),
		type: z
			.enum(['action', 'feedback'])
			.describe(
				'"action", or "feedback" for a condition inside an action, such as the "When True" group of "Logic: If statement".'
			)
			.meta({ example: 'action' }),
		connectionId: z
			.string()
			.describe('Id of the connection that runs the action, or "internal" for a built-in action.')
			.meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
		definitionId: z
			.string()
			.describe('Action definition id, as listed by the action definitions endpoint.')
			.meta({ example: 'program' }),
		enabled: z.boolean().describe('Whether the action runs when the button is pressed.').meta({ example: true }),
		headline: z.string().nullable().describe('Custom name of the action, shown in place of its definition label.'),
		options: z
			.record(z.string(), ExpressionOrValueSchema)
			.describe('Option values, keyed by option id.')
			.meta({ example: { input: { isExpression: false, value: 1 } } }),
		children: z
			.record(z.string(), z.array(z.lazy(() => ActionResponseSchema)))
			.nullable()
			.describe(
				'Child entities by group, for the internal actions that contain others. A group of conditions holds feedbacks.'
			),
	})
	.meta({ id: 'ButtonAction' })

export interface StyleElementResponse {
	id: string
	type: string
	name: string
	usage: string
	options: Record<string, unknown>
	children: StyleElementResponse[] | null
}

export const StyleElementResponseSchema: z.ZodType<StyleElementResponse> = z
	.object({
		id: z.string().describe('Unique element id within the button.').meta({ example: 'text0' }),
		type: z
			.string()
			.describe('Element type, such as "canvas", "text", "box", "image" or "group".')
			.meta({ example: 'text' }),
		name: z.string().describe('Display name of the element.').meta({ example: 'Text' }),
		usage: z.string().describe('What the element is used for when a legacy style is applied.').meta({
			example: 'auto',
		}),
		options: z
			.record(z.string(), z.unknown())
			.describe('Properties of the element, keyed by property id. Most are an ExpressionOrValue.')
			.meta({ example: { text: { isExpression: false, value: 'CAM 1' } } }),
		children: z
			.array(z.lazy(() => StyleElementResponseSchema))
			.nullable()
			.describe('Elements inside this one, for a group.'),
	})
	.meta({ id: 'ButtonStyleElement' })

const ActionSetResponseSchema = z.object({
	id: z
		.string()
		.describe(
			'Action set id: "down", "up", "rotate_left", "rotate_right", or a number of milliseconds for actions run when the button is held that long.'
		)
		.meta({ example: 'down' }),
	actions: z.array(ActionResponseSchema).describe('Actions in the set, in the order they run.'),
})

const StepResponseSchema = z.object({
	id: z.string().describe('Step id.').meta({ example: '0' }),
	actionSets: z.array(ActionSetResponseSchema).describe('Action sets of the step.'),
})

const ButtonResponseExample = {
	id: 'bank:4kZ3cS6pXyIb2xUuDqQvH',
	type: 'button-layered',
	location: { pageId: 'ggmHXCUQ0RRXUwEr8HHtQ', pageNumber: 1, row: 0, column: 1 },
	editable: true,
	allowStyleChanges: true,
	style: {
		elements: [
			{
				id: 'canvas',
				type: 'canvas',
				name: 'Canvas',
				usage: 'auto',
				options: { decoration: { isExpression: false, value: 'default' } },
				children: null,
			},
			{
				id: 'text0',
				type: 'text',
				name: 'Text',
				usage: 'auto',
				options: { text: { isExpression: false, value: 'CAM 1' } },
				children: null,
			},
		],
	},
	steps: [
		{
			id: '0',
			actionSets: [
				{
					id: 'down',
					actions: [
						{
							id: 'Ys0bqVZ1kKUlH2hSmmT6m',
							type: 'action' as const,
							connectionId: 'KJA1isEECHRDBTFjx-7tf',
							definitionId: 'program',
							enabled: true,
							headline: null,
							options: { input: { isExpression: false as const, value: 1 } },
							children: null,
						},
					],
				},
				{ id: 'up', actions: [] },
			],
		},
	],
}

export const ButtonResponseSchema = z
	.object({
		id: z.string().describe('Unique control id of the button.').meta({ example: ButtonResponseExample.id }),
		type: z
			.string()
			.describe('Button type, such as "button-layered", "pageup", "pagedown" or "pagenum".')
			.meta({ example: 'button-layered' }),
		location: ButtonLocationSchema.nullable().describe('Where the button is placed, or null if it is not on a page.'),
		editable: z
			.boolean()
			.describe('Whether the style and actions of this button can be changed. Linked presets can not be.')
			.meta({ example: true }),
		allowStyleChanges: z
			.boolean()
			.describe(
				'Whether APIs may change the style of this button. This is the "Allow style changes" option of the button, and is set in the web UI.'
			)
			.meta({ example: true }),
		style: z
			.object({
				elements: z.array(StyleElementResponseSchema).describe('Style elements, from the bottom layer up.'),
			})
			.nullable()
			.describe('Style of the button, or null for a button type that has no style.'),
		steps: z
			.array(StepResponseSchema)
			.nullable()
			.describe('Steps of the button with their actions, or null for a button type that has no actions.'),
	})
	.meta({ id: 'Button', example: ButtonResponseExample })

export type ButtonResponse = z.infer<typeof ButtonResponseSchema>

function buildActionResponse(entity: SomeEntityModel): ActionResponse {
	const options: Record<string, ExpressionOrValueResponse> = {}
	for (const [key, value] of Object.entries(entity.options)) {
		if (value) options[key] = value
	}

	let children: Record<string, ActionResponse[]> | null = null
	// A stored action has an empty object where a new one has none, so both read as null
	if (entity.children && Object.keys(entity.children).length > 0) {
		children = {}
		for (const [group, groupChildren] of Object.entries(entity.children)) {
			children[group] = (groupChildren ?? []).map(buildActionResponse)
		}
	}

	return {
		id: entity.id,
		type: entity.type === EntityModelType.Feedback ? 'feedback' : 'action',
		connectionId: entity.connectionId,
		definitionId: entity.definitionId,
		enabled: !entity.disabled,
		headline: entity.headline || null,
		options,
		children,
	}
}

function buildStyleElementResponse(element: SomeButtonGraphicsElement): StyleElementResponse {
	const { id, type, name, usage, ...rest } = element
	const options: Record<string, unknown> = {}
	let children: StyleElementResponse[] | null = null
	for (const [key, value] of Object.entries(rest)) {
		if (key === 'children' && Array.isArray(value)) {
			children = (value as SomeButtonGraphicsElement[]).map(buildStyleElementResponse)
		} else if (!isStructuralStyleElementKey(key)) {
			options[key] = value
		}
	}

	return { id, type, name, usage, options, children }
}

/** The order the web UI shows the action sets of a step in */
const NAMED_ACTION_SETS: readonly ActionSetId[] = ['down', 'up', 'rotate_left', 'rotate_right']

function buildStepsResponse(steps: NormalButtonSteps): ButtonResponse['steps'] {
	return Object.entries(steps)
		.sort(([a], [b]) => Number(a) - Number(b))
		.map(([stepId, step]) => {
			const setIds = Object.keys(step.action_sets).sort((a, b) => {
				const ia = NAMED_ACTION_SETS.indexOf(a as ActionSetId)
				const ib = NAMED_ACTION_SETS.indexOf(b as ActionSetId)
				if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
				return Number(a) - Number(b)
			})

			return {
				id: stepId,
				actionSets: setIds.flatMap((setId) => {
					const actions = step.action_sets[setId as ActionSetId]
					// A rotary set that is turned off has no list
					if (!actions) return []
					return [{ id: setId, actions: actions.map(buildActionResponse) }]
				}),
			}
		})
}

/** The steps of a control, if it is a type of button that has them */
function getControlSteps(control: SomeControl): NormalButtonSteps | null {
	const model = control.toJSON()
	if (model && typeof model === 'object' && 'steps' in model && model.steps) return model.steps
	return null
}

/** Whether the button allows APIs to change its style, the "Allow style changes" option in the web UI */
function getAllowStyleChanges(control: SomeControl): boolean {
	if (!control.supportsOptions) return false
	return control.options.canModifyStyleInApis === true
}

function getEditableEntities(control: SomeControl): EditableEntityListPool | null {
	if (control.supportsEntities && control.entities.isEditable) return control.entities
	return null
}

export function buildButtonResponse(control: SomeControl, pageStore: IPageStore): ButtonResponse {
	const location = pageStore.getLocationOfControlId(control.controlId)
	const pageId = location ? pageStore.getPageId(location.pageNumber) : undefined

	const steps = getControlSteps(control)

	return ButtonResponseSchema.parse({
		id: control.controlId,
		type: control.type,
		location:
			location && pageId
				? { pageId, pageNumber: location.pageNumber, row: location.row, column: location.column }
				: null,
		editable: control.supportsLayeredStyle && !!getEditableEntities(control),
		allowStyleChanges: getAllowStyleChanges(control),
		style: control.supportsLayeredStyle
			? { elements: control.layeredStyleGetElements().map(buildStyleElementResponse) }
			: null,
		steps: steps ? buildStepsResponse(steps) : null,
	} satisfies ButtonResponse)
}

/** Parse an action set id from a path */
function parseActionSetId(setId: string): ActionSetId | null {
	if (NAMED_ACTION_SETS.includes(setId as ActionSetId)) return setId as ActionSetId
	if (/^\d+$/.test(setId)) return Number(setId)
	return null
}

/** Whether a string is a valid expression */
function isValidExpression(expression: string): boolean {
	try {
		ParseExpression(expression)
		return true
	} catch (_e) {
		return false
	}
}

/**
 * Check option values against the option fields of a definition (an action, a feedback or a composite element), as
 * the web UI does when it shows them. The web UI only offers valid values, so this is where values from the API get
 * the same checks. Errors are keyed by the option id.
 */
export function validateOptionValues(
	fields: readonly SomeCompanionInputField[],
	values: Record<string, ExpressionOrValue<JsonValue | undefined>>
): Record<string, string> {
	const errors: Record<string, string> = {}
	for (const [key, value] of Object.entries(values)) {
		const field = fields.find((option) => option.id === key)
		if (!field || field.type === 'static-text') {
			errors[key] = `Unknown option: "${key}"`
			continue
		}

		if (value.isExpression) {
			if (field.disableAutoExpression) {
				errors[key] = `Option "${key}" can not be an expression`
			} else if (!isValidExpression(value.value)) {
				errors[key] = `Option "${key}" is not a valid expression`
			}
			continue
		}

		// An expression field is parsed even when it allows invalid values, as those are about what it evaluates to
		if (field.type === 'expression') {
			if (typeof value.value !== 'string' || !isValidExpression(value.value)) {
				errors[key] = `Option "${key}" is not a valid expression`
			}
			continue
		}

		if (field.allowInvalidValues) continue

		const result = validateInputValue(field, value.value)
		if (result.validationError) {
			errors[key] = result.validationError
		} else if (value.value !== undefined && !isEqual(result.sanitisedValue, value.value)) {
			// The web UI only produces values of the right type. Coercing them here would store a value the client
			// did not send, so a value of the wrong type is refused instead
			errors[key] = `Invalid value for "${key}": expected ${JSON.stringify(result.sanitisedValue)}`
		}
	}
	return errors
}

/** Check option values of an action or feedback, with errors keyed as `options.<id>` */
export function validateEntityOptionValues(
	definition: ClientEntityDefinition,
	values: Record<string, ExpressionOrValue<JsonValue | undefined>>
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(validateOptionValues(definition.options, values)).map(([key, message]) => [
			`options.${key}`,
			message,
		])
	)
}

/** The prefix of the keys of a composite element's own options, as defined by its connection */
const COMPOSITE_OPTION_PREFIX = 'opt:'

/**
 * Check new values for the properties of a style element, using the same schema the button is loaded with.
 * That schema replaces a bad value with a default rather than failing, so a value that does not come back
 * unchanged is invalid.
 *
 * A composite element also has options defined by its connection, stored as `opt:<id>`. The schema accepts any key
 * for those, so they are checked against the composite definition instead, which must be given for a composite.
 */
export function validateStyleElementValues(
	element: SomeButtonGraphicsElement,
	compositeDefinition: CompositeElementDefinition | null,
	values: Record<string, ExpressionOrValue<JsonValue | undefined>>
): Record<string, string> {
	const errors: Record<string, string> = {}

	const settableValues: Record<string, ExpressionOrValue<JsonValue | undefined>> = {}
	const compositeValues: Record<string, ExpressionOrValue<JsonValue | undefined>> = {}
	for (const [key, value] of Object.entries(values)) {
		if (isStructuralStyleElementKey(key)) {
			errors[`options.${key}`] = `Unknown property: "${key}"`
		} else if (element.type === 'composite' && key.startsWith(COMPOSITE_OPTION_PREFIX)) {
			compositeValues[key.slice(COMPOSITE_OPTION_PREFIX.length)] = value
		} else if (element.type === 'composite' && !(key in element)) {
			// The composite schema accepts any extra key, so only the ones it always has are known
			errors[`options.${key}`] = `Unknown property: "${key}"`
		} else if (value.isExpression && !isValidExpression(value.value)) {
			errors[`options.${key}`] = `Property "${key}" is not a valid expression`
		} else {
			settableValues[key] = value
		}
	}

	if (Object.keys(compositeValues).length > 0) {
		if (!compositeDefinition) throw new Error('Composite element definition is required to check its options')
		for (const [key, message] of Object.entries(validateOptionValues(compositeDefinition.options, compositeValues))) {
			errors[`options.${COMPOSITE_OPTION_PREFIX}${key}`] = message
		}
	}

	const parsed = SomeButtonGraphicsElementSchema.safeParse({ ...element, ...settableValues })
	if (!parsed.success) {
		errors.options = 'Invalid element properties'
		return errors
	}
	const parsedElement = parsed.data as unknown as Record<string, unknown>

	for (const [key, value] of Object.entries(settableValues)) {
		if (!(key in parsedElement)) {
			errors[`options.${key}`] = `Unknown property: "${key}"`
		} else if (!isEqual(parsedElement[key], value)) {
			errors[`options.${key}`] = `Invalid value for "${key}"`
		}
	}

	return errors
}

export type ButtonsRestContext = {
	controls: Pick<Map<string, SomeControl>, 'get'>
	pageStore: IPageStore
	definitions: InstanceDefinitions
}

const defineButtonsEndpointSpec = createRestEndpointSpecFactory<ButtonsRestContext>()

const controlIdParam = z.object({
	controlId: z
		.string()
		.describe('Control id of the button, as returned by the page or button endpoints.')
		.meta({ example: ButtonResponseExample.id }),
})

const elementParams = controlIdParam.extend({
	elementId: z.string().describe('Id of the style element.').meta({ example: 'text0' }),
})

const actionSetParams = controlIdParam.extend({
	stepId: z.string().describe('Step id. A button starts with one step, "0".').meta({ example: '0' }),
	setId: z
		.string()
		.describe('Action set id: "down", "up", "rotate_left", "rotate_right", or a number of milliseconds for a held set.')
		.meta({ example: 'down' }),
})

const actionParams = actionSetParams.extend({
	actionId: z.string().describe('Id of the action.').meta({ example: 'Ys0bqVZ1kKUlH2hSmmT6m' }),
})

const StyleElementPatchBodySchema = z
	.object({
		options: OptionValuesSchema.refine((values) => Object.keys(values).length > 0, 'At least one property is required')
			.describe('Properties to change, keyed by property id. Properties that are left out keep their value.')
			.meta({ example: { text: { isExpression: false, value: 'CAM 2' } } }),
	})
	.strict()

const ActionCreateBodySchema = z
	.object({
		connectionId: z
			.string()
			.describe('Id of the connection to run the action, or "internal" for a built-in action.')
			.meta({ example: 'KJA1isEECHRDBTFjx-7tf' }),
		definitionId: z.string().describe('Action definition id.').meta({ example: 'program' }),
		options: OptionValuesSchema.default({})
			.describe('Option values. Options that are left out get their default.')
			.meta({ example: { input: { isExpression: false, value: 2 } } }),
		enabled: z.boolean().default(true).describe('Set false to skip the action when the button is pressed.'),
		headline: z.string().default('').describe('Custom name of the action. Empty for none.'),
	})
	.strict()

type ActionCreateBody = z.infer<typeof ActionCreateBodySchema>

/** A sanity bound on one replace. Far above any real action set, but stops a malformed request */
const MAX_REPLACE_ACTIONS = 1000

const ActionsReplaceBodySchema = z
	.object({
		actions: z
			.array(ActionCreateBodySchema)
			.max(MAX_REPLACE_ACTIONS)
			.describe('The new actions of the set, in the order they run. An empty list removes every action.'),
	})
	.strict()

/** Check an action to be created against its definition, keyed by field. Empty when it is valid */
function checkNewAction(definitions: InstanceDefinitions, body: ActionCreateBody): Record<string, string> {
	const definition = definitions.getEntityDefinition(EntityModelType.Action, body.connectionId, body.definitionId)
	if (!definition || definition.hiddenFromPicker) {
		return {
			definitionId: `Unknown action "${body.definitionId}" for connection "${body.connectionId}". The connection must be running.`,
		}
	}
	return validateEntityOptionValues(definition, asOptionValues(body.options))
}

/** Build the model of a checked action, as the web UI does when one is added, with the given values applied */
function createNewAction(
	definitions: InstanceDefinitions,
	control: SomeControl,
	body: ActionCreateBody
): SomeEntityModel {
	const newAction = definitions.createEntityItem(
		body.connectionId,
		EntityModelType.Action,
		body.definitionId,
		ParseControlId(control.controlId)?.type ?? null,
		null
	)
	if (!newAction) throw RestApiError.unprocessable('Action could not be created')

	Object.assign(newAction.options, asOptionValues(body.options))
	if (!body.enabled) newAction.disabled = true
	if (body.headline) newAction.headline = body.headline

	return newAction
}

const ActionPatchBodySchema = z
	.object({
		options: OptionValuesSchema.optional()
			.describe('Option values to change. Options that are left out keep their value.')
			.meta({ example: { input: { isExpression: false, value: 3 } } }),
		enabled: z.boolean().optional().describe('Set false to skip the action when the button is pressed.'),
		headline: z.string().optional().describe('Custom name of the action. An empty string removes it.'),
	})
	.strict()
	.refine(
		(body) => body.options !== undefined || body.enabled !== undefined || body.headline !== undefined,
		'At least one field is required'
	)

const conflictResponse = {
	409: {
		description: 'Button can not be edited',
		content: { 'application/json': { schema: ErrorResponseSchema } },
	},
}

const unprocessableResponse = {
	422: {
		description: 'Unknown action, or invalid option values',
		content: { 'application/json': { schema: ErrorResponseSchema } },
	},
}

/** Resolve a button that can be edited, and the action set addressed by the path */
function getEditableActionSet(
	controls: ButtonsRestContext['controls'],
	params: z.infer<typeof actionSetParams>
): {
	control: SomeControl
	entities: EditableEntityListPool
	listId: { stepId: string; setId: ActionSetId }
	actions: SomeEntityModel[]
} {
	const control = controls.get(params.controlId)
	if (!control) throw RestApiError.notFound('Button not found')

	const entities = getEditableEntities(control)
	const steps = getControlSteps(control)
	if (!entities || !steps) throw RestApiError.conflict('Button actions can not be edited')

	const setId = parseActionSetId(params.setId)
	const actions = setId !== null ? steps[params.stepId]?.action_sets[setId] : undefined
	if (setId === null || !actions) throw RestApiError.notFound('Action set not found')

	return { control, entities, listId: { stepId: params.stepId, setId }, actions }
}

function findAction(actions: SomeEntityModel[], actionId: string): SomeEntityModel | undefined {
	for (const action of actions) {
		if (action.id === actionId) return action
		for (const children of Object.values(action.children ?? {})) {
			const found = findAction(children ?? [], actionId)
			if (found) return found
		}
	}
	return undefined
}

const buttonEndpointSpecs: RestEndpointSpec<ButtonsRestContext>[] = [
	defineButtonsEndpointSpec(
		{
			method: 'get',
			path: '/:controlId',
			scopes: ['read'],
			tags: BUTTONS_API_TAGS,
			summary: 'Get a button',
			description: 'Returns a button with its location, style elements and actions.',
			request: { params: controlIdParam },
			response: {
				status: 200,
				description: 'Button details',
				schema: createSuccessSchema(ButtonResponseSchema),
			},
			examples: { response: successResponse(ButtonResponseExample) },
			errorResponses,
		},
		({ controls, pageStore }) => {
			return ({ params }) => {
				const control = controls.get(params.controlId)
				if (!control || ParseControlId(control.controlId)?.type !== 'bank') {
					throw RestApiError.notFound('Button not found')
				}

				return { body: successResponse(buildButtonResponse(control, pageStore)) }
			}
		}
	),

	defineButtonsEndpointSpec(
		{
			method: 'patch',
			path: '/:controlId/style/elements/:elementId',
			scopes: ['write'],
			tags: BUTTONS_API_TAGS,
			summary: 'Update a style element',
			description:
				'Changes properties of one style element of a button, such as the text of a text element. Only send the properties to change. The button must have "Allow style changes" turned on (`allowStyleChanges`), or this is refused with 409.',
			request: { params: elementParams, body: StyleElementPatchBodySchema },
			response: {
				status: 200,
				description: 'Updated element',
				schema: createSuccessSchema(StyleElementResponseSchema),
			},
			examples: {
				body: { options: { text: { isExpression: false, value: 'CAM 2' } } },
				response: successResponse({
					id: 'text0',
					type: 'text',
					name: 'Text',
					usage: 'auto',
					options: { text: { isExpression: false, value: 'CAM 2' } },
					children: null,
				}),
			},
			extraResponses: { ...conflictResponse, ...unprocessableResponse },
			errorResponses,
		},
		({ controls, definitions }) => {
			return ({ params, body }) => {
				const control = controls.get(params.controlId)
				if (!control) throw RestApiError.notFound('Button not found')
				if (!control.supportsLayeredStyle || !getEditableEntities(control)) {
					throw RestApiError.conflict('Button style can not be edited')
				}
				if (!getAllowStyleChanges(control)) {
					throw RestApiError.conflict('Style changes from APIs are not allowed for this button')
				}

				const element = control.layeredStyleGetElementById(params.elementId)
				if (!element) throw RestApiError.notFound('Style element not found')

				let compositeDefinition: CompositeElementDefinition | null = null
				if (element.type === 'composite') {
					compositeDefinition =
						definitions.getCompositeElementDefinition(element.connectionId, element.elementId) ?? null
					if (!compositeDefinition) {
						throw RestApiError.conflict(
							`Definition of composite element "${element.elementId}" is not available. The connection must be running.`
						)
					}
				}

				const values = asOptionValues(body.options)
				const errors = validateStyleElementValues(element, compositeDefinition, values)
				if (Object.keys(errors).length > 0) throw RestApiError.unprocessable('Invalid element properties', errors)

				if (!control.layeredStyleUpdateOptions(params.elementId, values)) {
					throw RestApiError.conflict('Button style can not be edited')
				}

				const updated = control.layeredStyleGetElementById(params.elementId)
				if (!updated) throw RestApiError.notFound('Style element not found')
				return { body: successResponse(buildStyleElementResponse(updated)) }
			}
		}
	),

	defineButtonsEndpointSpec(
		{
			method: 'post',
			path: '/:controlId/steps/:stepId/action-sets/:setId/actions',
			scopes: ['write'],
			tags: BUTTONS_API_TAGS,
			summary: 'Add an action',
			description:
				'Adds an action to the end of an action set. Options that are not given get the default from the action definition.',
			request: { params: actionSetParams, body: ActionCreateBodySchema },
			response: {
				status: 201,
				description: 'Action added',
				schema: createSuccessSchema(ActionResponseSchema),
			},
			examples: {
				body: {
					connectionId: 'KJA1isEECHRDBTFjx-7tf',
					definitionId: 'program',
					options: { input: { isExpression: false, value: 2 } },
				},
				response: successResponse(ButtonResponseExample.steps[0].actionSets[0].actions[0]),
			},
			extraResponses: { ...conflictResponse, ...unprocessableResponse },
			errorResponses,
		},
		({ controls, definitions }) => {
			return ({ params, body, basePath }) => {
				const { control, entities, listId } = getEditableActionSet(controls, params)

				const errors = checkNewAction(definitions, body)
				if (Object.keys(errors).length > 0) throw RestApiError.unprocessable('Invalid action', errors)

				const newAction = createNewAction(definitions, control, body)

				if (!entities.entityAdd(listId, null, newAction)) throw RestApiError.notFound('Action set not found')

				return {
					status: 201,
					location: `${basePath}${BUTTONS_API_BASE_PATH}/${control.controlId}/steps/${params.stepId}/action-sets/${params.setId}/actions/${newAction.id}`,
					body: successResponse(buildActionResponse(newAction)),
				}
			}
		}
	),

	defineButtonsEndpointSpec(
		{
			method: 'put',
			path: '/:controlId/steps/:stepId/action-sets/:setId/actions',
			scopes: ['write'],
			tags: BUTTONS_API_TAGS,
			summary: 'Replace the actions of an action set',
			description:
				'Replaces every action in an action set with the given list, in one change. Every action is checked first; if any is invalid, nothing changes.',
			request: { params: actionSetParams, body: ActionsReplaceBodySchema },
			response: {
				status: 200,
				description: 'The actions now in the set',
				schema: createSuccessSchema(z.array(ActionResponseSchema)),
			},
			examples: {
				body: {
					actions: [
						{
							connectionId: 'KJA1isEECHRDBTFjx-7tf',
							definitionId: 'program',
							options: { input: { isExpression: false, value: 2 } },
							enabled: true,
							headline: '',
						},
					],
				},
				response: successResponse(ButtonResponseExample.steps[0].actionSets[0].actions),
			},
			extraResponses: { ...conflictResponse, ...unprocessableResponse },
			errorResponses,
		},
		({ controls, definitions }) => {
			return ({ params, body }) => {
				const { control, entities, listId } = getEditableActionSet(controls, params)

				const errors: Record<string, string> = {}
				body.actions.forEach((action, index) => {
					for (const [key, message] of Object.entries(checkNewAction(definitions, action))) {
						errors[`actions.${index}.${key}`] = message
					}
				})
				if (Object.keys(errors).length > 0) throw RestApiError.unprocessable('Invalid actions', errors)

				const newActions = body.actions.map((action) => createNewAction(definitions, control, action))

				// The same call the action recorder makes when it replaces the actions of a button
				if (!entities.entityReplaceAll(listId, newActions)) throw RestApiError.notFound('Action set not found')

				const { actions } = getEditableActionSet(controls, params)
				return { body: successResponse(actions.map(buildActionResponse)) }
			}
		}
	),

	defineButtonsEndpointSpec(
		{
			method: 'patch',
			path: '/:controlId/steps/:stepId/action-sets/:setId/actions/:actionId',
			scopes: ['write'],
			tags: BUTTONS_API_TAGS,
			summary: 'Update an action',
			description: 'Changes option values, the enabled state or the headline of an action. Only send what changes.',
			request: { params: actionParams, body: ActionPatchBodySchema },
			response: {
				status: 200,
				description: 'Updated action',
				schema: createSuccessSchema(ActionResponseSchema),
			},
			examples: {
				body: { options: { input: { isExpression: false, value: 3 } } },
				response: successResponse(ButtonResponseExample.steps[0].actionSets[0].actions[0]),
			},
			extraResponses: { ...conflictResponse, ...unprocessableResponse },
			errorResponses,
		},
		({ controls, definitions }) => {
			return ({ params, body }) => {
				const { entities, listId, actions } = getEditableActionSet(controls, params)

				const action = findAction(actions, params.actionId)
				if (!action) throw RestApiError.notFound('Action not found')

				const values = body.options ? asOptionValues(body.options) : {}
				if (Object.keys(values).length > 0) {
					// A condition inside an action is a feedback, so its definition is found by the entity's own type
					const definition = definitions.getEntityDefinition(action.type, action.connectionId, action.definitionId)
					if (!definition) {
						throw RestApiError.conflict(
							`Definition of ${action.type} "${action.definitionId}" is not available. The connection must be running.`
						)
					}

					const errors = validateEntityOptionValues(definition, values)
					if (Object.keys(errors).length > 0) throw RestApiError.unprocessable('Invalid option values', errors)
				}

				// Everything is checked, so apply it all
				for (const [key, value] of Object.entries(values)) {
					entities.entitySetOption(listId, action.id, key, value)
				}
				if (body.enabled !== undefined) entities.entityEnabled(listId, action.id, body.enabled)
				if (body.headline !== undefined) entities.entityHeadline(listId, action.id, body.headline)

				const updated = findAction(getEditableActionSet(controls, params).actions, action.id)
				if (!updated) throw RestApiError.notFound('Action not found')
				return { body: successResponse(buildActionResponse(updated)) }
			}
		}
	),

	defineButtonsEndpointSpec(
		{
			method: 'delete',
			path: '/:controlId/steps/:stepId/action-sets/:setId/actions/:actionId',
			scopes: ['write'],
			tags: BUTTONS_API_TAGS,
			summary: 'Remove an action',
			description: 'Removes an action from an action set.',
			request: { params: actionParams },
			response: { status: 204, description: 'Action removed' },
			extraResponses: conflictResponse,
			errorResponses,
		},
		({ controls }) => {
			return ({ params }) => {
				const { entities, listId, actions } = getEditableActionSet(controls, params)
				if (!findAction(actions, params.actionId)) throw RestApiError.notFound('Action not found')

				if (!entities.entityRemove(listId, params.actionId)) throw RestApiError.notFound('Action not found')
				return { status: 204 }
			}
		}
	),
]

/**
 * Create the buttons router for /api/v2/buttons/v1
 */
export function createButtonsRouter(context: ButtonsRestContext): Express.Router {
	const router = Express.Router()

	for (const endpointSpec of buttonEndpointSpecs) {
		mountRestEndpoint(router, endpointSpec.createEndpoint(context))
	}

	return router
}

/**
 * Register all /buttons paths in the OpenAPI registry.
 */
export function registerButtonPaths(registry: OpenAPIRegistry): void {
	for (const endpointSpec of buttonEndpointSpecs) {
		registerRestEndpoint(registry, BUTTONS_API_BASE_PATH, endpointSpec.contract)
	}
}
