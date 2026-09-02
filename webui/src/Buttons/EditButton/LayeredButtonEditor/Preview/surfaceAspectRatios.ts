import type { ClientSurfaceButtonSizesItem } from '@companion-app/shared/Model/Surfaces.js'

export interface SurfaceAspectRatioChoice {
	/** The ratio, in the same "w:h" form the presets use */
	id: string
	label: string
}

function greatestCommonDivisor(a: number, b: number): number {
	while (b) {
		;[a, b] = [b, a % b]
	}
	return a
}

/**
 * Reduce a pixel size to the smallest whole number ratio which describes it, so that a 248x58 info bar reads as
 * "124:29" rather than repeating the pixel dimensions back at the user.
 */
export function reduceToAspectRatio(w: number, h: number): string | null {
	if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null

	const divisor = greatestCommonDivisor(Math.round(w), Math.round(h))
	if (!divisor) return null

	return `${Math.round(w) / divisor}:${Math.round(h) / divisor}`
}

/**
 * The distinct aspect ratios of the buttons across all of the known surfaces, labelled with the models which
 * have buttons of that shape. A surface with more than one button size contributes to more than one ratio.
 */
export function collectSurfaceAspectRatios(surfaces: ClientSurfaceButtonSizesItem[]): SurfaceAspectRatioChoice[] {
	const namesByRatio = new Map<string, Set<string>>()

	for (const surface of surfaces) {
		for (const size of surface.bitmapSizes) {
			const ratio = reduceToAspectRatio(size.w, size.h)
			if (!ratio) continue

			let names = namesByRatio.get(ratio)
			if (!names) {
				names = new Set()
				namesByRatio.set(ratio, names)
			}
			names.add(surface.type)
		}
	}

	return Array.from(namesByRatio.entries())
		.map(([id, names]) => ({
			id,
			label: `${id} (${Array.from(names).sort().join(', ')})`,
		}))
		.sort((a, b) => a.id.localeCompare(b.id))
}
