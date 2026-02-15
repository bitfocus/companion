import type { ActionSetsModel, ActionStepOptions } from './ActionModel.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { ButtonStyleProperties } from './StyleModel.js'

export type SomeButtonModel =
	| PageNumberButtonModel
	| PageUpButtonModel
	| PageDownButtonModel
	| NormalButtonModel
	| RemoteLinkButtonModel

export interface PageNumberButtonModel {
	readonly type: 'pagenum'
}
export interface PageUpButtonModel {
	readonly type: 'pageup'
}

export interface PageDownButtonModel {
	readonly type: 'pagedown'
}

export interface ButtonModelBase {
	feedbacks: SomeEntityModel[]

	steps: NormalButtonSteps

	localVariables: SomeEntityModel[]
}

export interface NormalButtonModel extends ButtonModelBase {
	readonly type: 'button'

	options: NormalButtonOptions

	style: ButtonStyleProperties
}

export interface PresetButtonModel extends ButtonModelBase {
	readonly type: 'preset:button'

	options: NormalButtonOptions

	style: ButtonStyleProperties
}

export type NormalButtonSteps = Record<
	string,
	{
		action_sets: ActionSetsModel
		options: ActionStepOptions
	}
>

export type ButtonOptionsBase = {
	stepProgression: 'auto' | 'manual' | 'expression'
	stepExpression?: string
}

export type NormalButtonOptions = ButtonOptionsBase & {
	rotaryActions: boolean
}

export type ButtonStatus = 'good' | 'warning' | 'error'

export interface NormalButtonRuntimeProps {
	current_step_id: string
}

/**
 * Visual state of a Link button, dictating how the renderer should draw it.
 * - `unknown_peer`:  Cloud icon + error indicator (peer UUID not in PeerRegistry)
 * - `unreachable`:   Cloud icon + disconnected style (peer known but offline)
 * - `loading`:       Cloud icon + loading indicator (subscribed, awaiting first bitmap)
 * - `bitmap`:        Remote bitmap is available and should be displayed
 * - `loop_detected`: Cloud icon + infinity symbol (source chain contains our own UUID)
 */
export type RemoteLinkButtonVisualState = 'unknown_peer' | 'unreachable' | 'loading' | 'bitmap' | 'loop_detected'

/** Persisted model for a remote Link (remote mirror) button. */
export interface RemoteLinkButtonModel {
	readonly type: 'remotelinkbutton'

	/** UUID of the remote peer instance to mirror. Empty string = not configured. */
	peerUuid: string

	/**
	 * Remote button location in standard Companion LocationString format.
	 * Examples: "1/0/0", "$(this:page)/$(this:row)/$(this:column)", "this"
	 * Parsed using ParseLocationString with full variable support.
	 */
	location: string
}

/** Runtime (non-persisted) properties sent to the UI for a remote Link button. */
export interface RemoteLinkButtonRuntimeProps {
	/** Current visual state of the link button. */
	visualState: RemoteLinkButtonVisualState

	/** Human-readable name of the target peer, if known. */
	peerName: string | null
}
