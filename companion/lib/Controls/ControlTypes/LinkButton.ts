import type {
	RemoteLinkButtonModel,
	RemoteLinkButtonRuntimeProps,
	RemoteLinkButtonVisualState,
} from '@companion-app/shared/Model/ButtonModel.js'
import { ControlBase } from '../ControlBase.js'
import type {
	ControlWithoutActionSets,
	ControlWithoutActions,
	ControlWithoutEntities,
	ControlWithoutEvents,
	ControlWithoutOptions,
	ControlWithoutPushed,
	ControlWithoutStyle,
} from '../IControlFragments.js'
import type { ControlDependencies } from '../ControlDependencies.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ParseLocationString } from '../../Internal/Util.js'
import type { DrawStyleModel, DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { VisitorReferencesUpdaterVisitor } from '../../Resources/Visitors/ReferencesUpdater.js'

/** Custom draw style for Remote Link button visual states. */
type RemoteLinkDrawStyle =
	| {
			type: 'bitmap'
			dataUrl: string
			pressed: boolean
	  }
	| {
			type: 'placeholder'
			text: string
			fontSize: number
			isError: boolean
	  }

/** Default model when creating a new Remote Link button. */
const DEFAULT_MODEL: RemoteLinkButtonModel = {
	type: 'remotelinkbutton',
	peerUuid: '',
	location: '',
}

/**
 * Control that mirrors a button from a remote Companion instance via Link.
 *
 * This control does not have its own actions, feedbacks, or style properties.
 * Instead, it displays a bitmap received from a remote peer (via the Link
 * subscription system) and forwards press/release events back to that peer.
 *
 * The LinkController feeds data into this control via the public setters:
 *   - {@link setVisualState} – transitions between placeholder states
 *   - {@link setBitmap} – provides the remote bitmap data URL
 *   - {@link setPeerName} – provides the resolved peer display name
 */
export class ControlButtonRemoteLink
	extends ControlBase<RemoteLinkButtonModel>
	implements
		ControlWithoutActions,
		ControlWithoutEntities,
		ControlWithoutStyle,
		ControlWithoutEvents,
		ControlWithoutActionSets,
		ControlWithoutOptions,
		ControlWithoutPushed
{
	readonly type = 'remotelinkbutton'

	readonly supportsActions = false
	readonly supportsEntities = false
	readonly supportsStyle = false
	readonly supportsEvents = false
	readonly supportsActionSets = false
	readonly supportsOptions = false
	readonly supportsPushed = false

	/** The persisted configuration. */
	#config: RemoteLinkButtonModel

	/** Current visual state (runtime-only, not persisted). */
	#visualState: RemoteLinkButtonVisualState = 'unknown_peer'

	/** Cached remote bitmap data URL, or null. */
	#bitmapDataUrl: string | null = null

	/** Whether the remote button is currently pressed. */
	#remotePressed = false

	/** Human-readable name of the target peer. */
	#peerName: string | null = null

	/** Callback for press forwarding (set by LinkController). */
	#onPress: ((controlId: string, pressed: boolean, surfaceId: string | undefined) => void) | null = null

	/** Callback when link config changes (set by LinkController). */
	#onConfigChanged: ((controlId: string) => void) | null = null

	/** Cached set of variable IDs referenced in the location field. */
	#cachedVariables: ReadonlySet<string> | null = null

	constructor(deps: ControlDependencies, controlId: string, storage: RemoteLinkButtonModel | null, isImport: boolean) {
		super(deps, controlId, 'Controls/Button/RemoteLink')

		if (!storage) {
			this.#config = { ...DEFAULT_MODEL }
			this.commitChange()
		} else {
			if (storage.type !== 'remotelinkbutton')
				throw new Error(`Invalid type given to ControlButtonRemoteLink: "${storage.type}"`)
			this.#config = storage
			if (isImport) this.commitChange()
		}

		// Initialize variable cache
		this.#updateCachedVariables()
	}

	// ── Public getters for LinkController ────────────────────────

	/** The configured remote peer UUID. */
	get peerUuid(): string {
		return this.#config.peerUuid
	}

	/** The configured remote location (raw string, may contain variables/expressions). */
	get linkLocation(): string {
		return this.#config.location
	}

	/**
	 * Parse the configured location with the given press location context.
	 * Returns null if the location cannot be parsed or variables cannot be resolved.
	 */
	parseLocation(pressLocation: ControlLocation | undefined): ControlLocation | null {
		return ParseLocationString(this.#config.location, pressLocation)
	}

	/** Current visual state. */
	get visualState(): RemoteLinkButtonVisualState {
		return this.#visualState
	}

	// ── Public setters (called by LinkController) ────────────────

	/**
	 * Update the visual state of this Remote Link button.
	 * Triggers a redraw and runtime property change.
	 */
	setVisualState(state: RemoteLinkButtonVisualState): void {
		if (this.#visualState === state) return
		this.#visualState = state

		// Clear bitmap if we're no longer in bitmap state
		if (state !== 'bitmap') {
			this.#bitmapDataUrl = null
			this.#remotePressed = false
		}

		this.sendRuntimePropsChange()
		this.triggerRedraw()
	}

	/**
	 * Set the remote bitmap data URL and pressed state.
	 * Automatically transitions visual state to 'bitmap'.
	 */
	setBitmap(dataUrl: string, pressed: boolean): void {
		this.#bitmapDataUrl = dataUrl
		this.#remotePressed = pressed

		if (this.#visualState !== 'bitmap') {
			this.#visualState = 'bitmap'
			this.sendRuntimePropsChange()
		}

		this.triggerRedraw()
	}

	/**
	 * Set the human-readable peer name (for UI display).
	 */
	setPeerName(name: string | null): void {
		if (this.#peerName === name) return
		this.#peerName = name
		this.sendRuntimePropsChange()
	}

	/**
	 * Set the press handler callback (called by LinkController).
	 */
	setOnPress(handler: ((controlId: string, pressed: boolean, surfaceId: string | undefined) => void) | null): void {
		this.#onPress = handler
	}

	/**
	 * Set the config change callback (called by LinkController).
	 */
	setOnConfigChanged(handler: ((controlId: string) => void) | null): void {
		this.#onConfigChanged = handler
	}

	/**
	 * Update the link configuration fields.
	 * Called from tRPC when the user edits the control.
	 */
	setLinkConfig(config: Partial<Pick<RemoteLinkButtonModel, 'peerUuid' | 'location'>>): void {
		let changed = false

		if (config.peerUuid !== undefined && config.peerUuid !== this.#config.peerUuid) {
			this.#config = { ...this.#config, peerUuid: config.peerUuid }
			changed = true
		}
		if (config.location !== undefined && config.location !== this.#config.location) {
			this.#config = { ...this.#config, location: config.location }
			this.#updateCachedVariables()
			changed = true
		}

		if (changed) {
			this.commitChange(true)
			this.#onConfigChanged?.(this.controlId)
		}
	}

	// ── ControlBase abstract implementations ─────────────────────

	getDrawStyle(): DrawStyleModel {
		const style = this.#getInternalDrawStyle()
		return this.#convertToDrawStyleModel(style)
	}

	/**
	 * Get the internal draw style (our custom type for link button states).
	 * This is kept separate from DrawStyleModel to avoid coupling to the legacy button system.
	 */
	#getInternalDrawStyle(): RemoteLinkDrawStyle {
		switch (this.#visualState) {
			case 'bitmap':
				return {
					type: 'bitmap',
					dataUrl: this.#bitmapDataUrl ?? '',
					pressed: this.#remotePressed,
				}
			case 'unknown_peer':
				return {
					type: 'placeholder',
					text: 'Unknown peer',
					fontSize: 15,
					isError: true,
				}
			case 'unreachable':
				return {
					type: 'placeholder',
					text: 'Unreachable',
					fontSize: 12,
					isError: false,
				}
			case 'loading':
				return {
					type: 'placeholder',
					text: 'Loading...',
					fontSize: 14,
					isError: false,
				}
			case 'loop_detected':
				return {
					type: 'placeholder',
					text: 'Loop detected',
					fontSize: 11,
					isError: true,
				}
		}
	}

	/**
	 * Convert our internal draw style to DrawStyleButtonModel for the graphics renderer.
	 * This is a minimal conversion - we don't use most of the button style properties.
	 */
	#convertToDrawStyleModel(style: RemoteLinkDrawStyle): DrawStyleButtonModel {
		if (style.type === 'bitmap') {
			return {
				style: 'button',
				text: '',
				textExpression: undefined,
				size: 'auto',
				alignment: 'center:center',
				pngalignment: 'center:center',
				color: 0xffffff,
				bgcolor: 0x000000,
				show_topbar: false,
				png64: style.dataUrl,
				imageBuffers: [],
				pushed: false,
				cloud: true,
				cloud_error: false,
				stepCurrent: 1,
				stepCount: 1,
				button_status: undefined,
				action_running: undefined,
			}
		} else {
			// Placeholder state
			return {
				style: 'button',
				text: style.text,
				textExpression: undefined,
				size: style.fontSize,
				alignment: 'center:center',
				pngalignment: 'center:center',
				color: 0x999999,
				bgcolor: 0x000000,
				show_topbar: 'default',
				png64: null,
				imageBuffers: [],
				pushed: false,
				cloud: !style.isError,
				cloud_error: style.isError,
				stepCurrent: 1,
				stepCount: 1,
				button_status: undefined,
				action_running: undefined,
			}
		}
	}

	getBitmapSize(): { width: number; height: number } | null {
		return { width: 72, height: 72 }
	}

	/**
	 * Update the cached set of variable IDs referenced in the location field.
	 */
	#updateCachedVariables(): void {
		const variables = new Set<string>()
		// Extract variable references from location field
		// Regex matches $(label:variable) patterns
		const reg = /\$\(([^:$)]+):([^$)]+)\)/g
		const matches = this.#config.location.matchAll(reg)
		for (const match of matches) {
			variables.add(`${match[1]}:${match[2]}`)
		}
		this.#cachedVariables = variables
	}

	collectReferencedConnectionsAndVariables(
		_foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void {
		// Use cached variables if available
		if (this.#cachedVariables) {
			for (const varId of this.#cachedVariables) {
				foundVariables.add(varId)
				const colonIndex = varId.indexOf(':')
				if (colonIndex !== -1) {
					foundConnectionLabels.add(varId.substring(0, colonIndex))
				}
			}
		}
	}

	triggerLocationHasChanged(): void {
		// Nothing location-dependent
	}

	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Forward press to the LinkController via the callback
		this.#onPress?.(this.controlId, _pressed, _surfaceId)
	}

	toJSON(_clone = true): RemoteLinkButtonModel {
		return {
			type: this.#config.type,
			peerUuid: this.#config.peerUuid,
			location: this.#config.location,
		}
	}

	toRuntimeJSON(): RemoteLinkButtonRuntimeProps {
		return {
			visualState: this.#visualState,
			peerName: this.#peerName,
		}
	}

	renameVariables(labelFrom: string, labelTo: string): void {
		// Use the established VisitorReferencesUpdaterVisitor to handle variable renaming
		const visitor = new VisitorReferencesUpdaterVisitor({ [labelFrom]: labelTo }, undefined)
		const wrapper = { location: this.#config.location }
		visitor.visitString(wrapper, 'location')

		if (wrapper.location !== this.#config.location) {
			this.#config = { ...this.#config, location: wrapper.location }
			this.#updateCachedVariables()
			this.commitChange(true)
			this.#onConfigChanged?.(this.controlId)
		}
	}

	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		// Early exit if no cached variables
		if (!this.#cachedVariables) return
		// Efficient check: if sets are disjoint (no overlap), no need to trigger update
		if (this.#cachedVariables.isDisjointFrom(allChangedVariables)) return

		// At least one referenced variable changed, trigger config change to re-sync subscription
		this.#onConfigChanged?.(this.controlId)
	}
}
