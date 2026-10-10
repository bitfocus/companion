/**
 * How long a control which turns has to be held still, in press mode, before it is pushed rather than about to be
 * turned. Until then a push is not sent, as a drag starting there would turn it instead.
 */
export const ROTARY_HOLD_MS = 250

/** How far round a control a drag has to go for one step of it, in degrees */
export const ROTARY_STEP_DEGREES = 15

/**
 * How near the centre of a control the pointer can be before which way it points stops meaning anything, in pixels.
 * Passing over the middle swings the angle half a turn in one move, which is not the knob being turned.
 */
const DEAD_ZONE_RADIUS = 6

export interface Point {
	x: number
	y: number
}

/** A drag turning a control, by going round its centre */
export interface RotaryDrag {
	centre: Point
	/** Which way the pointer last pointed from the centre, in degrees; null while it is in the dead zone */
	lastAngle: number | null
	/** How far it has gone round since the last whole step, so slow turning still adds up */
	remainder: number
}

export function startRotaryDrag(centre: Point, point: Point): RotaryDrag {
	return { centre, lastAngle: angleFrom(centre, point), remainder: 0 }
}

/**
 * Follow a drag to a new point. Returns the whole steps it went round by - positive clockwise, as a knob turned
 * right - and the drag to carry on from.
 */
export function continueRotaryDrag(drag: RotaryDrag, point: Point): { drag: RotaryDrag; steps: number } {
	const angle = angleFrom(drag.centre, point)
	if (angle === null || drag.lastAngle === null) return { drag: { ...drag, lastAngle: angle }, steps: 0 }

	// The short way round, so crossing from just under 180 to just over -180 is a small turn, not nearly a whole one
	let delta = angle - drag.lastAngle
	if (delta > 180) delta -= 360
	else if (delta <= -180) delta += 360

	const total = drag.remainder + delta
	const steps = Math.trunc(total / ROTARY_STEP_DEGREES)

	return {
		drag: { centre: drag.centre, lastAngle: angle, remainder: total - steps * ROTARY_STEP_DEGREES },
		steps,
	}
}

/** Which way a point is from the centre, in degrees clockwise on screen; null when too near to say */
function angleFrom(centre: Point, point: Point): number | null {
	const dx = point.x - centre.x
	const dy = point.y - centre.y
	if (Math.hypot(dx, dy) < DEAD_ZONE_RADIUS) return null

	// y grows downwards, so this grows clockwise as seen
	return (Math.atan2(dy, dx) * 180) / Math.PI
}
