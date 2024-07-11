import { observable, runInAction } from 'mobx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDeepCompareEffect } from 'use-deep-compare'

export interface PanelCollapseHelperResult {
	setAllCollapsed: () => void
	setAllExpanded: () => void
	canExpandAll: boolean
	canCollapseAll: boolean
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	isPanelCollapsed: (panelId: string) => boolean
}

interface CollapsedState {
	defaultCollapsed: boolean
	ids: Record<string, boolean | undefined>
}

interface CollapsedState2 {
	defaultCollapsed?: boolean // @deprecated
	defaultExpandedAt: Record<string, boolean | undefined> | undefined
	ids: Record<string, boolean | undefined>
}

export function usePanelCollapseHelper(storageId: string, panelIds: string[]): PanelCollapseHelperResult {
	const collapseStorageId = `companion_ui_collapsed_${storageId}`

	const [collapsed, setCollapsed] = useState<CollapsedState>({ defaultCollapsed: false, ids: {} })
	useEffect(() => {
		// Reload from storage whenever the storage key changes
		const oldState = window.localStorage.getItem(collapseStorageId)
		if (oldState) {
			setCollapsed(JSON.parse(oldState))
		} else {
			setCollapsed({
				defaultCollapsed: false,
				ids: {},
			})
		}
	}, [collapseStorageId])

	const setPanelCollapsed = useCallback(
		(panelId: string, collapsed: boolean) => {
			setCollapsed((oldState) => {
				const newState: CollapsedState = {
					...oldState,
					ids: {},
				}

				// preserve only the panels which exist
				for (const id of panelIds) {
					newState.ids[id] = oldState.ids?.[id]
				}

				// set the new one
				newState.ids[panelId] = collapsed

				window.localStorage.setItem(collapseStorageId, JSON.stringify(newState))
				return newState
			})
		},
		[collapseStorageId, panelIds]
	)
	const setAllCollapsed = useCallback(() => {
		setCollapsed((oldState) => {
			const newState: CollapsedState = {
				...oldState,
				defaultCollapsed: true,
				ids: {},
			}

			// set all to collapsed
			for (const id of panelIds) {
				newState.ids[id] = true
			}

			window.localStorage.setItem(collapseStorageId, JSON.stringify(newState))
			return newState
		})
	}, [collapseStorageId, panelIds])
	const setAllExpanded = useCallback(() => {
		setCollapsed((oldState) => {
			const newState: CollapsedState = {
				...oldState,
				defaultCollapsed: false,
				ids: {},
			}

			// set all to collapsed
			for (const id of panelIds) {
				newState.ids[id] = false
			}

			window.localStorage.setItem(collapseStorageId, JSON.stringify(newState))
			return newState
		})
	}, [collapseStorageId, panelIds])

	const isPanelCollapsed = useCallback(
		(panelId: string) => {
			return collapsed?.ids?.[panelId] ?? collapsed?.defaultCollapsed ?? false
		},
		[collapsed]
	)

	const canExpandAll = collapsed.defaultCollapsed || !Object.values(collapsed.ids || {}).every((v) => !v)
	const canCollapseAll = !collapsed.defaultCollapsed || !Object.values(collapsed.ids || {}).every((v) => v)

	return {
		setAllCollapsed,
		setAllExpanded,
		canExpandAll,
		canCollapseAll,
		setPanelCollapsed,
		isPanelCollapsed,
	}
}

export interface PanelCollapseHelper2 {
	setAllCollapsed: (parentId: string | null, paneldIds: string[]) => void
	setAllExpanded: (parentId: string | null, paneldIds: string[]) => void
	canExpandAll(parentId: string | null, paneldIds: string[]): boolean
	canCollapseAll(parentId: string | null, paneldIds: string[]): boolean
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	isPanelCollapsed: (parentId: string | null, panelId: string) => boolean
}

class PanelCollapseHelper2Impl implements PanelCollapseHelper2 {
	readonly #storageId: string

	// readonly #defaultCollapsed = observable.box(false)
	readonly #defaultExpandedAt = observable.map<string | null, boolean>()
	readonly #ids = observable.map<string, boolean>()

	constructor(storageId: string) {
		this.#storageId = `companion_ui_collapsed_${storageId}`

		// makeObservable(this, {
		// 	defaultCollapsed: observable,
		// })

		// Try loading the old state
		runInAction(() => {
			try {
				const oldState = window.localStorage.getItem(this.#storageId)
				if (oldState) {
					const parsedState: CollapsedState2 = JSON.parse(oldState)
					if (typeof parsedState.defaultCollapsed === 'boolean') {
						this.#defaultExpandedAt.set(null, !parsedState.defaultCollapsed)
					} else {
						for (const [key, value] of Object.entries(parsedState.defaultExpandedAt || {})) {
							if (typeof value === 'boolean') this.#defaultExpandedAt.set(key, value)
						}
					}

					for (const [key, value] of Object.entries(parsedState.ids)) {
						if (typeof value === 'boolean') this.#ids.set(key, value)
					}
				}
			} catch (e) {
				// Ignore
			}
		})
	}

	#writeState() {
		window.localStorage.setItem(
			this.#storageId,
			JSON.stringify({
				defaultExpandedAt: Object.fromEntries(this.#defaultExpandedAt.toJSON()),
				ids: Object.fromEntries(this.#ids.toJSON()),
			} satisfies CollapsedState2)
		)
	}

	setAllCollapsed = (parentId: string | null, panelIds: string[]) => {
		runInAction(() => {
			this.#defaultExpandedAt.set(parentId, true)

			// Clear state for specified panels
			for (const panelId of panelIds) {
				this.#ids.delete(panelId)
			}

			this.#writeState()
		})
	}

	setAllExpanded = (parentId: string | null, panelIds: string[]): void => {
		runInAction(() => {
			this.#defaultExpandedAt.set(parentId, false)

			// Clear state for specified panels
			for (const panelId of panelIds) {
				this.#ids.delete(panelId)
			}

			this.#writeState()
		})
	}

	// setAllCollapsed = action(() => {
	// 	this.#defaultCollapsed.set(true)

	// 	this.#ids.clear()

	// 	this.#writeState()
	// })

	// setAllExpanded = action((): void => {
	// 	this.#defaultCollapsed.set(false)

	// 	this.#ids.clear()

	// 	this.#writeState()
	// })

	canExpandAll = (parentId: string | null, panelIds: string[]): boolean => {
		return this.#defaultExpandedAt.get(parentId) || !panelIds.every((id) => !this.isPanelCollapsed(parentId, id))
	}
	canCollapseAll = (parentId: string | null, panelIds: string[]): boolean => {
		return !this.#defaultExpandedAt.get(parentId) || !panelIds.every((id) => this.isPanelCollapsed(parentId, id))
	}

	setPanelCollapsed = (panelId: string, collapsed: boolean): void => {
		runInAction(() => {
			this.#ids.set(panelId, collapsed)

			this.#writeState()
		})
	}

	// setPanelCollapsed = action((panelId: string, collapsed: boolean): void => {
	// 	this.#ids.set(panelId, collapsed)

	// 	this.#writeState()
	// })

	isPanelCollapsed = (parentId: string | null, panelId: string): boolean => {
		return this.#ids.get(panelId) ?? this.#defaultExpandedAt.get(parentId) ?? false
	}

	clearUnknownIds = (knownPanelIds: string[]): void => {
		runInAction(() => {
			const knownPanelIdsSet = new Set(knownPanelIds)

			for (const key of this.#ids.keys()) {
				if (!knownPanelIdsSet.has(key)) {
					this.#ids.delete(key)
				}
			}

			this.#writeState()
		})
	}
	// clearUnknownIds = action((knownPanelIds: string[]): void => {
	// 	const knownPanelIdsSet = new Set(knownPanelIds)

	// 	for (const key of this.#ids.keys()) {
	// 		if (!knownPanelIdsSet.has(key)) {
	// 			this.#ids.delete(key)
	// 		}
	// 	}

	// 	this.#writeState()
	// })
}

export function usePanelCollapseHelper2(storageId: string, knownPanelIds: string[]): PanelCollapseHelper2 {
	const store = useMemo(() => new PanelCollapseHelper2Impl(storageId), [storageId])

	// Clear out any unknown panel IDs
	useDeepCompareEffect(() => {
		store.clearUnknownIds(knownPanelIds)
	}, [store, knownPanelIds])

	return store
}
