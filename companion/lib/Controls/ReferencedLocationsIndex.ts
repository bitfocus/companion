import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocationString } from '@companion-app/shared/Model/Common.js'

/**
 * Which controls referenced which button locations (e.g. '1/0/0') in their last draw, indexed both ways.
 *
 * Every button render has to notify the controls that reference its location, so that they redraw with the new
 * content. Without this index that meant asking every control in the system, on every render - which is quadratic
 * when everything redraws at once (eg a global style setting changing, or an import), and froze slower machines.
 *
 * The drawers report what they reference after each draw. The index only has to be a superset of the truth: each
 * drawer still checks the location against its own references, so a stale entry only costs a no-op call.
 */
export class ReferencedLocationsIndex {
	readonly #byControl = new Map<SomeControlId, ReadonlySet<ControlLocationString>>()
	readonly #byLocation = new Map<ControlLocationString, Set<SomeControlId>>()

	/**
	 * Replace the locations referenced by a control
	 * @param locations The referenced location strings, or null when it references none
	 */
	setControlReferences(controlId: SomeControlId, locations: ReadonlySet<ControlLocationString> | null): void {
		const previous = this.#byControl.get(controlId)
		if (previous) {
			for (const location of previous) {
				if (!locations?.has(location)) this.#removeFromLocation(location, controlId)
			}
		}

		if (!locations || locations.size === 0) {
			this.#byControl.delete(controlId)
			return
		}

		// Copy, so that a caller mutating its set later can't desync the two maps
		const ownLocations = new Set(locations)
		this.#byControl.set(controlId, ownLocations)

		for (const location of ownLocations) {
			if (previous?.has(location)) continue

			let controlIds = this.#byLocation.get(location)
			if (!controlIds) {
				controlIds = new Set()
				this.#byLocation.set(location, controlIds)
			}
			controlIds.add(controlId)
		}
	}

	/** Forget everything a control referenced (eg it was deleted) */
	forgetControl(controlId: SomeControlId): void {
		this.setControlReferences(controlId, null)
	}

	/** The ids of the controls whose last draw referenced a location, or undefined if none did */
	getControlsReferencing(location: ControlLocationString): ReadonlySet<SomeControlId> | undefined {
		return this.#byLocation.get(location)
	}

	#removeFromLocation(location: ControlLocationString, controlId: SomeControlId): void {
		const controlIds = this.#byLocation.get(location)
		if (!controlIds) return

		controlIds.delete(controlId)
		if (controlIds.size === 0) this.#byLocation.delete(location)
	}
}
