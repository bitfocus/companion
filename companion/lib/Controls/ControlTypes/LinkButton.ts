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
import type { DrawStyleModel, DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../ControlDependencies.js'

/** Default model when creating a new Remote Link button. */
const DEFAULT_MODEL: RemoteLinkButtonModel = {
	type: 'remotelinkbutton',
	peerUuid: '',
	page: '',
	row: '',
	col: '',
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
	#onPress: ((controlId: string, pressed: boolean) => void) | null = null

	/** Callback when link config changes (set by LinkController). */
	#onConfigChanged: ((controlId: string) => void) | null = null

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
	}

	// ── Public getters for LinkController ────────────────────────

	/** The configured remote peer UUID. */
	get peerUuid(): string {
		return this.#config.peerUuid
	}

	/** The configured remote page (raw string, may contain variables/expressions). */
	get linkPage(): string {
		return this.#config.page
	}

	/** The configured remote row (raw string, may contain variables/expressions). */
	get linkRow(): string {
		return this.#config.row
	}

	/** The configured remote column (raw string, may contain variables/expressions). */
	get linkCol(): string {
		return this.#config.col
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
	setOnPress(handler: ((controlId: string, pressed: boolean) => void) | null): void {
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
	setLinkConfig(config: Partial<Pick<RemoteLinkButtonModel, 'peerUuid' | 'page' | 'row' | 'col'>>): void {
		let changed = false

		if (config.peerUuid !== undefined && config.peerUuid !== this.#config.peerUuid) {
			this.#config = { ...this.#config, peerUuid: config.peerUuid }
			changed = true
		}
		if (config.page !== undefined && config.page !== this.#config.page) {
			this.#config = { ...this.#config, page: config.page }
			changed = true
		}
		if (config.row !== undefined && config.row !== this.#config.row) {
			this.#config = { ...this.#config, row: config.row }
			changed = true
		}
		if (config.col !== undefined && config.col !== this.#config.col) {
			this.#config = { ...this.#config, col: config.col }
			changed = true
		}

		if (changed) {
			this.commitChange(true)
			this.#onConfigChanged?.(this.controlId)
		}
	}

	// ── ControlBase abstract implementations ─────────────────────

	getDrawStyle(): DrawStyleModel {
		switch (this.#visualState) {
			case 'bitmap':
				return this.#drawBitmapState()
			case 'unknown_peer':
				return this.#drawPlaceholderState('Unknown peer', 15)
			case 'unreachable':
				return this.#drawPlaceholderState('Unreachable', 12)
			case 'loading':
				return this.#drawPlaceholderState('Loading...', 14)
			case 'loop_detected':
				return this.#drawPlaceholderState('Loop detected', 11)
		}
	}

	#drawBitmapState(): DrawStyleButtonModel {
		return {
			style: 'button',
			text: '',
			textExpression: undefined,
			size: 'auto',
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: 0xffffff,
			bgcolor: 0x000000,
			show_topbar: 'default',
			png64: this.#bitmapDataUrl,
			imageBuffers: [],
			pushed: this.#remotePressed,
			cloud: true,
			cloud_error: false,
			stepCurrent: 1,
			stepCount: 1,
			button_status: undefined,
			action_running: undefined,
		}
	}

	#drawPlaceholderState(text: string, size: number): DrawStyleButtonModel {
		const isError = this.#visualState === 'unknown_peer' || this.#visualState === 'loop_detected'

		return {
			style: 'button',
			text,
			textExpression: undefined,
			size,
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: 0x999999,
			bgcolor: 0x000000,
			show_topbar: 'default',
			png64: null,
			imageBuffers: [],
			pushed: false,
			cloud: !isError,
			cloud_error: isError,
			stepCurrent: 1,
			stepCount: 1,
			button_status: undefined,
			action_running: undefined,
		}
	}

	getBitmapSize(): { width: number; height: number } | null {
		return { width: 72, height: 72 }
	}

	collectReferencedConnectionsAndVariables(
		_foundConnectionIds: Set<string>,
		_foundConnectionLabels: Set<string>,
		_foundVariables: Set<string>
	): void {
		// TODO: parse page/row/col for variable references
	}

	triggerLocationHasChanged(): void {
		// Nothing location-dependent
	}

	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Forward press to the LinkController via the callback
		this.#onPress?.(this.controlId, _pressed)
	}

	toJSON(_clone = true): RemoteLinkButtonModel {
		return {
			type: this.#config.type,
			peerUuid: this.#config.peerUuid,
			page: this.#config.page,
			row: this.#config.row,
			col: this.#config.col,
		}
	}

	toRuntimeJSON(): RemoteLinkButtonRuntimeProps {
		return {
			visualState: this.#visualState,
			peerName: this.#peerName,
		}
	}

	renameVariables(_labelFrom: string, _labelTo: string): void {
		// TODO: rename variable references in page/row/col
	}

	onVariablesChanged(_allChangedVariables: ReadonlySet<string>): void {
		// TODO: re-evaluate variable references and notify LinkController
	}
}
