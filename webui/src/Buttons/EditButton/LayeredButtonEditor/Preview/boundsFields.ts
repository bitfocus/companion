import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'

export type BoundsKey = 'x' | 'y' | 'width' | 'height'
export type BoundsFractions = Record<BoundsKey, number>

const BOUNDS_KEYS = ['x', 'y', 'width', 'height'] as const

/** Lines have no bounds - they're defined by their two endpoints instead */
export type LineKey = 'fromX' | 'fromY' | 'toX' | 'toY'
export type LineFractions = Record<LineKey, number>

export const LINE_KEYS = ['fromX', 'fromY', 'toX', 'toY'] as const

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

export function roundFields<Key extends string>(fields: Record<Key, number>): Record<Key, number> {
	const out = {} as Record<Key, number>
	for (const key of Object.keys(fields) as Key[]) {
		out[key] = roundFraction(fields[key])
	}
	return out
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

/**
 * Read a line element's endpoints as 0-1 fractions, or null if any is expression-driven.
 *
 * Lines carry `fromX`/`fromY`/`toX`/`toY` percentages instead of the `x`/`y`/`width`/`height` every other
 * element type has, so they need their own reader.
 */
export function getDraggableLineFields(element: SomeButtonGraphicsElement): LineFractions | null {
	if (element.type !== 'line') return null

	const out: Partial<LineFractions> = {}
	for (const key of LINE_KEYS) {
		const field = element[key]
		if (!field || field.isExpression) return null
		out[key] = field.value / 100
	}
	return out as LineFractions
}

/** Build the mutation payload for a set of option keys, converting fractions back to stored percentages. */
export function buildOptionValues<Key extends string>(
	fields: Record<Key, number>,
	changedKeys: readonly Key[]
): Record<string, ExpressionOrValue<JsonValue>> {
	const values: Record<string, ExpressionOrValue<JsonValue>> = {}
	for (const key of changedKeys) {
		values[key] = { isExpression: false, value: fractionToStoredPercent(fields[key]) as JsonValue }
	}
	return values
}
