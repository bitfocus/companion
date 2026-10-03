import { z } from 'zod'
import { MAX_BODY_IMAGE_LENGTH } from '@companion-surface/base'

/**
 * How to draw the face of a satellite surface. Mirrors the surface appearance which surface modules describe, so
 * that a satellite surface is drawn the same way, but is defined here so that the satellite protocol is versioned
 * and documented on its own terms.
 *
 * Origin top-left, y down. Distances are in the units of `size`, and only the ratios within one face matter.
 */

/** Inline only - nothing downstream shares a filesystem with the client */
const BODY_IMAGE_REGEX =
	/^data:image\/(svg\+xml|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/

export const SatelliteAppearanceSizeSchema = z
	.object({
		width: z.number().positive().describe('Width of the whole face, in face units.'),
		height: z.number().positive().describe('Height of the whole face, in face units.'),
	})
	.meta({
		id: 'SatelliteAppearanceSize',
		title: 'SatelliteAppearanceSize',
		description: 'The extent of the whole face. Every other measurement in the appearance is in these units.',
	})

export const SatelliteControlShapeSchema = z
	.discriminatedUnion('type', [
		z
			.object({
				type: z.literal('rect'),
				cornerRadius: z
					.number()
					.min(0)
					.optional()
					.meta({ default: 0 })
					.describe(
						'Corner radius in face units. Omit or use `0` for square corners; a capsule (a touch strip segment, a fader track) is half the shorter side.'
					),
			})
			.describe('A rectangle filling the control bounds, optionally with rounded corners.'),
		z
			.object({ type: z.literal('circle') })
			.describe('An ellipse inscribed in the control bounds, which in square bounds is a circle.'),
	])
	.meta({
		id: 'SatelliteControlShape',
		title: 'SatelliteControlShape',
		description: 'How a control is drawn.',
	})

export const SatelliteControlAppearanceSchema = z
	.object({
		x: z.number().describe('Distance from the left edge of the face to the left edge of the control, in face units.'),
		y: z.number().describe('Distance from the top edge of the face to the top edge of the control, in face units.'),
		width: z.number().positive().describe('Width of the control, in face units.'),
		height: z.number().positive().describe('Height of the control, in face units.'),
		shape: SatelliteControlShapeSchema.optional().describe(
			'How the control is drawn. Defaults to a square-cornered rectangle filling the bounds.'
		),
		type: z
			.enum(['button', 'encoder', 'jog', 'fader', 'lcd-segment'])
			.optional()
			.describe(
				'What kind of control this is, so it can be drawn as one - a knob rather than a round button, a fader rather than a tall key. Defaults to a button.'
			),
		label: z
			.string()
			.max(64)
			.optional()
			.describe(
				'The legend printed on the hardware, if it has one, eg `CUT`. Drawn on the face where there is no artwork.'
			),
	})
	.meta({
		id: 'SatelliteControlAppearance',
		title: 'SatelliteControlAppearance',
		description:
			'Where one control sits on the face and how it is drawn. A control may overhang `size`, and controls may overlap - a later entry is drawn, and hit tested, on top of an earlier one.',
	})

export const SatelliteSurfaceAppearanceSchema = z
	.object({
		size: SatelliteAppearanceSizeSchema,
		bodyColor: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/)
			.describe(
				'The colour of the device itself, as `#rrggbb` - the colour of the plastic, not a colour chosen to suit a theme. With no `bodyImage` it fills the face; with one it says what the device looks like, so the face can be told apart from whatever is behind it.'
			),
		bodyImage: z
			.string()
			.regex(BODY_IMAGE_REGEX, 'must be a base64 `data:` URI of an svg, png or webp image')
			.max(MAX_BODY_IMAGE_LENGTH, 'body image is too large; a face should be simple vector art, not a photograph')
			.optional()
			.describe(
				'Artwork for the face, drawn under the controls, as a base64 `data:` URI. SVG is preferred. An SVG must use a `viewBox` of `0 0 <size.width> <size.height>` so that the art and the control positions share one coordinate system; a raster is scaled to fill `size` exactly.'
			),
		controls: z
			.record(z.string().regex(/^[a-zA-Z0-9\-/]+$/), SatelliteControlAppearanceSchema)
			.describe(
				'Where each control sits, keyed by the same control ids as the layout manifest. Must cover every control of the layout, or the whole appearance is ignored. Ids the layout does not have are ignored.'
			),
	})
	.meta({
		title: 'Satellite Surface Appearance',
		description:
			'Schema describing how to draw the face of a satellite surface: its extent, its background, and where each of its controls is. Layered over the layout manifest and keyed by the same control ids.',
	})
export type SatelliteSurfaceAppearance = z.infer<typeof SatelliteSurfaceAppearanceSchema>
