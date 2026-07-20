import { z } from 'zod'

export const SatelliteConfigSizeSchema = z
	.object({
		w: z.number().min(0).describe('Width in pixels (non-negative).'),
		h: z.number().min(0).describe('Height in pixels (non-negative).'),
	})
	.meta({
		id: 'SatelliteConfigSize',
		title: 'SatelliteConfigSize',
		description: 'Pixel size for bitmap content.',
	})
export type SatelliteConfigSize = z.infer<typeof SatelliteConfigSizeSchema>

export const SatelliteLedsConfigSchema = z
	.object({
		segments: z.number().int().min(1).max(200).describe('The number of individually addressable LED segments.'),
		mode: z
			.enum(['full-ring', 'simple'])
			.describe(
				"How Companion maps a gauge onto these LEDs. `full-ring`: the LEDs form a complete circle and the gauge is rendered faithfully (angles, deadzone and colours respected 1:1); segment 0 is at 6 o'clock and indices increase clockwise. `simple`: any other shape where the value is swept across all segments, with segment 0 as the 0% end. In both cases the surface re-maps to its physical wiring locally if it differs from these conventions."
			),
	})
	.meta({
		id: 'SatelliteLedsConfig',
		title: 'SatelliteLedsConfig',
		description:
			'If set, the control has an addressable strip/ring of LEDs (e.g. the ring around a Stream Deck Studio encoder) and requests LED colours to be reported. Colours are reported per-frame via the `LEDS` parameter as base64 of a packed RGB buffer, one `R,G,B` triple per segment.',
	})
export type SatelliteLedsConfig = z.infer<typeof SatelliteLedsConfigSchema>

export const SatelliteControlStylePresetSchema = z
	.object({
		bitmap: SatelliteConfigSizeSchema.optional().describe('If set, bitmaps of the specified size will be reported.'),
		text: z.boolean().optional().describe('If true, the control requests text to be reported.'),
		textStyle: z.boolean().optional().describe('If true, the control requests text style properties to be reported'),
		colors: z.enum(['hex', 'rgb']).optional().describe('If set, the control requests colours to be reported.'),
		leds: SatelliteLedsConfigSchema.optional().describe(
			'If set, the control has an addressable strip/ring of LEDs and requests LED colours to be reported.'
		),
	})
	.meta({
		id: 'SatelliteControlStylePreset',
		title: 'SatelliteControlStylePreset',
		description:
			'Styling options that can be applied to controls. Can be used as the default style or as per-control overrides.',
	})
export type SatelliteControlStylePreset = z.infer<typeof SatelliteControlStylePresetSchema>

export const SatelliteControlDefinitionSchema = z
	.object({
		row: z.number().min(0).describe('Zero-based row index for layout placement.'),
		column: z.number().min(0).describe('Zero-based column index for layout placement.'),
		stylePreset: z
			.string()
			.min(1)
			.optional()
			.describe(
				'Optional name of a style preset defined in `stylePresets`. If present, the control will use the named preset instead of the default style.'
			),
	})
	.meta({
		id: 'SatelliteControlDefinition',
		title: 'SatelliteControlDefinition',
		description:
			'Single control definition. The id must be unique and may be user facing in logs. Typically the id would be in the form of 1/0, matching the row/column of the control.',
	})
export type SatelliteControlDefinition = z.infer<typeof SatelliteControlDefinitionSchema>

export const SatelliteSurfaceLayoutSchema = z
	.object({
		stylePresets: z
			.object({
				default: SatelliteControlStylePresetSchema,
			})
			.catchall(SatelliteControlStylePresetSchema)
			.describe(
				'Named collection of style presets. The preset named `default` is required and is used as the fallback style for controls when no `stylePreset` is specified.'
			),
		controls: z.record(z.string().regex(/^[a-zA-Z0-9\-/]+$/), SatelliteControlDefinitionSchema),
	})
	.meta({
		title: 'Satellite Surface Layout',
		description:
			'Schema describing a satellite surface layout: default styling and a map of controls with positions and optional style overrides.',
	})
export type SatelliteSurfaceLayout = z.infer<typeof SatelliteSurfaceLayoutSchema>
