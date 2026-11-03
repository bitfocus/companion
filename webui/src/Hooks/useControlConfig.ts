import { skipToken } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { runInAction } from 'mobx'
import { useEffect, useState } from 'react'
import { applyObjectPatch } from '@companion-app/shared/Diff.js'
import {
	isControlModelForId,
	type ControlModelForId,
	type StoredControlId,
	type UIControlState,
	type UIControlUpdateConfig,
	type UIControlUpdateRuntime,
} from '@companion-app/shared/Model/Controls.js'
import { trpc } from '~/Resources/TRPC'
import { assertNever } from '~/Resources/util'

/**
 * Watch the config of a control. The config is checked to be one that the kind of control id can have, so a trigger id
 * gives a trigger config
 */
export function useControlConfig<TId extends StoredControlId>(
	controlId: TId | null | undefined
): {
	controlConfig: UIControlState<ControlModelForId<TId>> | null
	error: string | null
	reloadConfig: () => void
} {
	// Only ever holds a state that matches the kind of controlId
	const [controlConfig, setControlConfig] = useState<UIControlState | null>(null)
	const [error, setError] = useState<string | null>(null)

	const sub = useSubscription(
		trpc.controls.watchControl.subscriptionOptions(controlId ? { controlId } : skipToken, {
			onStarted: () => {
				setControlConfig(null)
			},
			onData: (data) => {
				runInAction(() => {
					switch (data.type) {
						case 'init': {
							// tRPC types the payload as its JSON form, which turns an `ExpressionOrValue`'s `value: T | undefined` into `value?: T`
							const control = data.control as UIControlState
							if (controlId && isControlModelForId(controlId, control.config)) {
								setControlConfig(control)
							} else {
								console.error(`Control ${controlId} has unexpected type ${control.type}`)
								setError('Unexpected control type')
								setControlConfig(null)
							}
							break
						}
						case 'destroy':
							setControlConfig(null)
							break
						case 'config':
						case 'runtime':
							setControlConfig((oldState) => oldState && applyControlUpdate(oldState, data))
							break
						default:
							assertNever(data)
							break
					}
				})
			},
			onError: (e) => {
				console.error(`Failed to load control config for ${controlId}`, e)

				setError('Failed to load control config')
				setControlConfig(null)
			},
		})
	)

	// Clear data when the controlId changes
	useEffect(() => {
		if (!controlId) setControlConfig(null)
	}, [controlId])

	return {
		controlConfig: controlConfig as UIControlState<ControlModelForId<TId>> | null,
		error,
		reloadConfig: sub.reset,
	}
}

/**
 * Apply a patch to a control's state. A control never changes type (a new type is a new control, which destroys the
 * old one), so a patch keeps the config and runtime of the same type.
 */
function applyControlUpdate(
	state: UIControlState,
	update: UIControlUpdateConfig | UIControlUpdateRuntime
): UIControlState {
	switch (update.type) {
		case 'config':
			return { ...state, config: applyObjectPatch(structuredClone(state.config), update.patch) } as UIControlState
		case 'runtime':
			return { ...state, runtime: applyObjectPatch(structuredClone(state.runtime), update.patch) } as UIControlState
		default:
			assertNever(update)
			return state
	}
}
