import z from 'zod'
import { ActionSetsModelSchema, ActionStepOptionsSchema } from './ActionModel.js'
import { SomeEntityModelSchema } from './EntityModel.js'
import { createExpressionOrValueSchema, JsonValueSchema } from './Options.js'
import { SomeButtonGraphicsElementSchema } from './StyleLayersModel.js'
import { ButtonGraphicsDecorationType, ButtonGraphicsShowStatusIcons } from './StyleModel.js'

export const PageNumberButtonModelSchema = z.object({
	type: z.literal('pagenum'),
})
export type PageNumberButtonModel = z.output<typeof PageNumberButtonModelSchema>

export const PageUpButtonModelSchema = z.object({
	type: z.literal('pageup'),
})
export type PageUpButtonModel = z.output<typeof PageUpButtonModelSchema>

export const PageDownButtonModelSchema = z.object({
	type: z.literal('pagedown'),
})
export type PageDownButtonModel = z.output<typeof PageDownButtonModelSchema>

const normalButtonStepSchema = z.object({
	action_sets: ActionSetsModelSchema.default(() => ({
		down: [],
		up: [],
		rotate_left: undefined,
		rotate_right: undefined,
	})),
	options: ActionStepOptionsSchema.default(() => ({ runWhileHeld: [] })),
})

/** A button always has a step, so one without any is given an empty one */
export const NormalButtonStepsSchema = z
	.record(z.string(), normalButtonStepSchema)
	.default(() => ({ '0': normalButtonStepSchema.parse({}) }))

export type NormalButtonSteps = z.output<typeof NormalButtonStepsSchema>

export const ButtonOptionsBaseSchema = z.object({
	stepProgression: z.enum(['auto', 'manual', 'expression']).default('auto'),
	stepExpression: z.string().optional(),
})

export type ButtonOptionsBase = z.output<typeof ButtonOptionsBaseSchema>

export const LayeredButtonOptionsSchema = ButtonOptionsBaseSchema.extend({
	rotaryActions: z.boolean().default(false),
	canModifyStyleInApis: z.boolean().default(false),
	notes: z.string().optional(),
})

export type LayeredButtonOptions = z.output<typeof LayeredButtonOptionsSchema>

const buttonModelBaseShape = {
	feedbacks: z.array(SomeEntityModelSchema).default(() => []),
	steps: NormalButtonStepsSchema,
	localVariables: z.array(SomeEntityModelSchema).default(() => []),
}

export const ButtonModelBaseSchema = z.object(buttonModelBaseShape)

export type ButtonModelBase = z.output<typeof ButtonModelBaseSchema>

const layeredButtonShape = {
	...buttonModelBaseShape,
	options: LayeredButtonOptionsSchema.default(() => LayeredButtonOptionsSchema.parse({})),
	style: z
		.object({
			layers: z.array(SomeButtonGraphicsElementSchema).default(() => []),
		})
		.default(() => ({ layers: [] })),
}

export const PresetButtonModelSchema = z.object({
	type: z.literal('preset:button'),
	...layeredButtonShape,
	/**
	 * Content-based checksum of the source preset this was resolved from, produced atomically with the model
	 * so the two cannot drift. The preview control uses it to skip rebuilding on a `updatePresets` that didn't
	 * actually change the preset. Optional: absent on older/imported data (treated as "unknown" → rebuild once).
	 */
	checksum: z.string().optional(),
})

export type PresetButtonModel = z.output<typeof PresetButtonModelSchema>

export const LayeredButtonModelSchema = z.object({
	type: z.literal('button-layered'),
	...layeredButtonShape,
})

export type LayeredButtonModel = z.output<typeof LayeredButtonModelSchema>

/**
 * A button that references a preset from a connection.
 * It keeps a cached copy of the resolved button data (the same fields as a layered button) so it keeps
 * running in its 'last known' state if the source preset disappears or the connection stops, and refreshes
 * that cache when the source preset definition updates.
 */
export const PresetReferenceButtonModelSchema = z.object({
	type: z.literal('preset-reference'),
	...layeredButtonShape,

	/**
	 * The reference to the source preset, and the user-editable templated variable overrides.
	 * The keys of `variableValues` match `localVariable.variableName` of the templated local variables and
	 * are the only fields the user is allowed to edit on a placed reference.
	 */
	presetRef: z.object({
		connectionId: z.string(),
		/**
		 * The module-id of the source connection. Kept up to date with the referenced connection, so the user
		 * can switch the reference to another connection of the same module (and so import can re-link).
		 */
		moduleId: z.string(),
		presetId: z.string(),
		variableValues: z.record(z.string(), JsonValueSchema.optional()).nullable().default(null),
	}),

	/**
	 * Content-based checksum of the source preset this cache was resolved from, produced atomically with the
	 * model so the two cannot drift. Used to skip rebuilding on a `updatePresets` that didn't actually change
	 * the preset. Optional: absent on older/imported data (treated as "unknown" → rebuild once).
	 */
	checksum: z.string().optional(),
})

export type PresetReferenceButtonModel = z.output<typeof PresetReferenceButtonModelSchema>

/**
 * A button that mirrors another button at a grid location. It has no style/entities of its own: it renders the
 * target button's full draw output (canvas, layers and runtime state) and forwards presses/rotation to the target.
 * The `location` is a page/row/column string, editable as plain text or an expression. Editing it in the UI
 * snapshots the target into a normal `button-layered` control (breaking the link).
 */
export const ButtonReferenceButtonModelSchema = z.object({
	type: z.literal('button-reference'),

	options: z.object({
		/** The grid location (page/row/column) of the button to mirror. */
		location: createExpressionOrValueSchema(z.string()),
		notes: z.string().optional(),
	}),
})

export type ButtonReferenceButtonModel = z.output<typeof ButtonReferenceButtonModelSchema>

/** The options of a link button, as stored. Each has a default, which an option that is missing or not valid gets */
export const LinkButtonOptionsSchema = z.object({
	/** The Link id of the installation to mirror a button from. Empty when not chosen yet */
	peerId: z.string().default(''),
	/** The grid location (page/row/column) of the button on that installation */
	location: createExpressionOrValueSchema(z.string()).default({ value: '', isExpression: false }),
	notes: z.string().optional(),
	/** How the button is decorated here */
	decoration: z.enum(ButtonGraphicsDecorationType).default(ButtonGraphicsDecorationType.FollowDefault),
	/** Whether the button shows status icons here */
	showStatusIcons: z.enum(ButtonGraphicsShowStatusIcons).default(ButtonGraphicsShowStatusIcons.FollowDefault),
})
export type LinkButtonOptions = z.output<typeof LinkButtonOptionsSchema>

/**
 * A button that mirrors a button on another Companion installation, over Companion Link. It shows the remote
 * button's image and forwards presses and rotation to it.
 */
export const LinkButtonModelSchema = z.object({
	type: z.literal('link-button'),
	options: LinkButtonOptionsSchema,
})
export type LinkButtonModel = z.output<typeof LinkButtonModelSchema>

/**
 * The options of a link button from data that may not be valid, eg as loaded or imported. Each option that is not
 * valid is replaced by its default, so that one bad option doesn't lose the rest
 * @returns the options, and the keys of those that were replaced
 */
export function parseLinkButtonOptions(raw: unknown): { options: LinkButtonOptions; invalidKeys: string[] } {
	const input: Record<string, unknown> = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

	const options: Record<string, unknown> = LinkButtonOptionsSchema.parse({})
	const invalidKeys: string[] = []
	for (const [key, schema] of Object.entries(LinkButtonOptionsSchema.shape)) {
		if (input[key] === undefined) continue

		const result = schema.safeParse(input[key])
		if (result.success) options[key] = result.data
		else invalidKeys.push(key)
	}

	return { options: options as LinkButtonOptions, invalidKeys }
}

export const SomeButtonModelSchema = z.discriminatedUnion('type', [
	PageNumberButtonModelSchema,
	PageUpButtonModelSchema,
	PageDownButtonModelSchema,
	LayeredButtonModelSchema,
	PresetReferenceButtonModelSchema,
	ButtonReferenceButtonModelSchema,
	LinkButtonModelSchema,
])

export type SomeButtonModel = z.output<typeof SomeButtonModelSchema>

export type ButtonStatus = 'good' | 'warning' | 'error'

export interface NormalButtonRuntimeProps {
	current_step_id: string
}
