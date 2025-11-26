import { runInAction } from 'mobx'
import { useEffect, useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import { useSubscription } from '@trpc/tanstack-react-query'
import { assertNever } from '~/Resources/util'
import type { SomeControlModel, UIControlUpdateInit } from '@companion-app/shared/Model/Controls.js'
import jsonPatch from 'fast-json-patch'

interface ControlConfig {
	config: SomeControlModel
	runtime: Record<string, any>
}

export function useControlConfig(controlId: string | null | undefined): {
	controlConfig: ControlConfig | null
	error: string | null
	reloadConfig: () => void
} {
	const [controlConfig, setControlConfig] = useState<ControlConfig | null>(null)
	const [error, setError] = useState<string | null>(null)

	const sub = useSubscription(
		trpc.controls.watchControl.subscriptionOptions(
			{
				controlId: controlId ?? '',
			},
			{
				enabled: !!controlId,
				onStarted: () => {
					setControlConfig(null)
				},
				onData: (data) => {
					runInAction(() => {
						switch (data.type) {
							case 'init':
								setControlConfig(data as UIControlUpdateInit) // TODO - how to avoid this cast?
								break
							case 'destroy':
								setControlConfig(null)
								break
							case 'config':
								setControlConfig((oldConfig) => {
									if (!oldConfig) return oldConfig

									return {
										...oldConfig,
										config: jsonPatch.applyPatch(structuredClone(oldConfig.config), data.patch).newDocument,
									}
								})
								break
							case 'runtime':
								setControlConfig((oldConfig) => {
									if (!oldConfig) return oldConfig

									return {
										...oldConfig,
										runtime: jsonPatch.applyPatch(structuredClone(oldConfig.runtime), data.patch).newDocument,
									}
								})
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
			}
		)
	)

	// Clear data when the controlId changes
	useEffect(() => {
		if (!controlId) setControlConfig(null)
	}, [controlId])

	return { controlConfig, error, reloadConfig: sub.reset }
}
