import type { UIPresetDefinitionUpdate, UIPresetSection } from '@companion-app/shared/Model/Presets.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observable, action } from 'mobx'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import { assertNever } from '~/Resources/util'
import { applyJsonPatchInPlace } from '~/Stores/ApplyDiffToMap'

export class PresetDefinitionsStore {
	readonly presets = observable.map<string, Record<string, UIPresetSection | undefined>>()

	updatePresets = action((update: UIPresetDefinitionUpdate | null) => {
		if (!update) {
			this.presets.clear()
			return
		}

		switch (update.type) {
			case 'init': {
				this.presets.clear()

				for (const [connectionId, presets] of Object.entries(update.definitions)) {
					this.presets.set(connectionId, presets)
				}
				break
			}
			case 'add':
				this.presets.set(update.connectionId, update.definitions)
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

				applyJsonPatchInPlace(currentPresets, update.patch)
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
		trpc.instances.definitions.presets.subscriptionOptions(undefined, {
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
