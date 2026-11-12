import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import Express from 'express'
import z from 'zod'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { IPageStore } from '../Page/Store.js'
import { RestApiError } from '../Service/RestApi/errors.js'
import { createSuccessSchema, errorResponses, successResponse } from '../Service/RestApi/schemas/common.js'
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
			.describe('Child actions by group, for the internal actions that contain other actions.'),
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

export type ButtonsRestContext = {
	controls: Pick<Map<string, SomeControl>, 'get'>
	pageStore: IPageStore
}

const defineButtonsEndpointSpec = createRestEndpointSpecFactory<ButtonsRestContext>()

const controlIdParam = z.object({
	controlId: z
		.string()
		.describe('Control id of the button, as returned by the page or button endpoints.')
		.meta({ example: ButtonResponseExample.id }),
})

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
