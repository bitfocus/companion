import type { UIPresetDefinition, UIPresetDefinitionUpdate } from '@companion-app/shared/Model/Presets.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observable, action } from 'mobx'
import { useState } from 'react'
import { trpc } from '~/TRPC'
import { assertNever } from '~/util'
import { applyPatch } from 'fast-json-patch'

export class PresetDefinitionsStore {
	readonly presets = observable.map<string, Map<string, UIPresetDefinition>>()

	updatePresets = action((update: UIPresetDefinitionUpdate | null) => {
		if (!update) {
			this.presets.clear()
			return
		}

		switch (update.type) {
			case 'init': {
				this.presets.clear()

				for (const [connectionId, presets] of Object.entries(update.definitions)) {
					this.presets.set(connectionId, observable.map(presets))
				}
				break
			}
			case 'add':
				this.presets.set(update.connectionId, observable.map(update.definitions))
				break
			case 'remove':
				this.presets.delete(update.connectionId)
				break
			case 'patch': {
				const currentPresets = this.presets.get(update.connectionId)
				if (!currentPresets) {
					console.warn(`No presets found for connection ${update.connectionId} to apply patch`)
					return
				}

				const newPresets = observable.map(applyPatch(Object.fromEntries(currentPresets), update.patch).newDocument)
				this.presets.set(update.connectionId, newPresets)
				break
			}
			default:
				assertNever(update)
		}
	})
}
export function usePresetsDefinitions(store: PresetDefinitionsStore): {
	isReady: boolean
	loadError: string | null
	restartSub: () => void
} {
	const [isReady, setIsReady] = useState(false)
	const [loadError, setLoadError] = useState<string | null>(null)

	const sub = useSubscription(
		trpc.connections.definitions.presets.subscriptionOptions(undefined, {
			onStarted: () => {
				setIsReady(false)
				setLoadError(null)
				store.updatePresets(null)
			},
			onData: (data) => {
				setIsReady(true)
				setLoadError(null)
				store.updatePresets(data)
			},
			onError: (error) => {
				console.error('Failed to load presets definitions', error)
				setIsReady(false)
				setLoadError('Failed to load presets')
			},
		})
	)

	return { isReady, loadError, restartSub: sub.reset }
}
