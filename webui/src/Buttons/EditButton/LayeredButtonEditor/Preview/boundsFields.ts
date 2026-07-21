import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'

export type BoundsKey = 'x' | 'y' | 'width' | 'height'
export type BoundsFractions = Record<BoundsKey, number>

const BOUNDS_KEYS = ['x', 'y', 'width', 'height'] as const

/** Smallest size a drag/resize will leave an element at, as a fraction of its parent bounds */
export const MIN_FRACTION_SIZE = 0.02

/** One decimal place of a percentage - the precision bounds are stored at (0.001 fraction = 0.1%) */
export const ROUND_STEP = 0.001

export function roundFraction(value: number): number {
	return Math.round(value / ROUND_STEP) * ROUND_STEP
}

/** A 0-1 fraction as the percentage the model stores, rounded to one decimal place and free of float noise */
export function fractionToStoredPercent(fraction: number): number {
	return Math.round(fraction * 1000) / 10
}

export function roundFields(fields: BoundsFractions): BoundsFractions {
	return {
		x: roundFraction(fields.x),
		y: roundFraction(fields.y),
		width: roundFraction(fields.width),
		height: roundFraction(fields.height),
	}
}

/**
 * Read an element's bounds as 0-1 fractions, or null if it has none or any is expression-driven (in which
 * case the value isn't ours to overwrite).
 *
 * The stored values are percentages (0-100, matching the "X %" / "Width %" field labels), normalised here
 * to the fraction-of-parent-bounds space used by the drag/resize math and GraphicsLayeredButtonRenderer.
 */
export function getDraggableBoundsFields(element: SomeButtonGraphicsElement): BoundsFractions | null {
	if (!('x' in element) || !('width' in element)) return null

	const raw = element as unknown as Record<BoundsKey, ExpressionOrValue<number> | undefined>
	const out: Partial<BoundsFractions> = {}
	for (const key of BOUNDS_KEYS) {
		const field = raw[key]
		if (!field || field.isExpression) return null
		out[key] = field.value / 100
	}
	return out as BoundsFractions
}

/** Build the mutation payload for a set of bounds keys, converting fractions back to stored percentages. */
export function buildBoundsValues(
	fields: BoundsFractions,
	changedKeys: readonly BoundsKey[]
): Record<string, ExpressionOrValue<JsonValue>> {
	const values: Record<string, ExpressionOrValue<JsonValue>> = {}
	for (const key of changedKeys) {
		values[key] = { isExpression: false, value: fractionToStoredPercent(fields[key]) as JsonValue }
	}
	return values
}
