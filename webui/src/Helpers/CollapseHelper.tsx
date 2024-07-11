import { observable, runInAction } from 'mobx'
import { useMemo, useRef } from 'react'
import { useDeepCompareEffect } from 'use-deep-compare'

interface CollapsedState {
	// @deprecated
	defaultCollapsed?: boolean
	defaultExpandedAt: Record<string, boolean | undefined> | undefined
	ids: Record<string, boolean | undefined>
}

export interface PanelCollapseHelper {
	setAllCollapsed: (parentId: string | null, panelIds: string[]) => void
	setAllExpanded: (parentId: string | null, panelIds: string[]) => void
	canExpandAll(parentId: string | null, panelIds: string[]): boolean
	canCollapseAll(parentId: string | null, panelIds: string[]): boolean
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	isPanelCollapsed: (parentId: string | null, panelId: string) => boolean
}

class PanelCollapseHelperStore implements PanelCollapseHelper {
	readonly #storageId: string

	readonly #defaultExpandedAt = observable.map<string | null, boolean>()
	readonly #ids = observable.map<string, boolean>()

	constructor(storageId: string) {
		this.#storageId = `companion_ui_collapsed_${storageId}`

		// Try loading the old state
		runInAction(() => {
			try {
				const oldState = window.localStorage.getItem(this.#storageId)
				if (oldState) {
					const parsedState: CollapsedState = JSON.parse(oldState)
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
			} satisfies CollapsedState)
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
}

export function usePanelCollapseHelper(storageId: string, knownPanelIds: string[]): PanelCollapseHelper {
	const store = useMemo(() => new PanelCollapseHelperStore(storageId), [storageId])

	// Clear out any unknown panel IDs
	useDeepCompareEffect(() => {
		store.clearUnknownIds(knownPanelIds)
	}, [store, knownPanelIds])

	return store
}

export interface PanelCollapseHelperLite {
	setAllCollapsed: () => void
	setAllExpanded: () => void
	canExpandAll(): boolean
	canCollapseAll(): boolean
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	isPanelCollapsed: (panelId: string) => boolean
}

export function usePanelCollapseHelperLite(storageId: string, knownPanelIds: string[]): PanelCollapseHelperLite {
	const panelIdsRef = useRef<string[]>(knownPanelIds)
	panelIdsRef.current = knownPanelIds

	const collapseHelper = usePanelCollapseHelper(storageId, knownPanelIds)

	return useMemo(
		() => ({
			setAllCollapsed: () => collapseHelper.setAllCollapsed(null, panelIdsRef.current),
			setAllExpanded: () => collapseHelper.setAllExpanded(null, panelIdsRef.current),
			canExpandAll: () => collapseHelper.canExpandAll(null, panelIdsRef.current),
			canCollapseAll: () => collapseHelper.canCollapseAll(null, panelIdsRef.current),
			setPanelCollapsed: collapseHelper.setPanelCollapsed,
			isPanelCollapsed: (panelId) => collapseHelper.isPanelCollapsed(null, panelId),
		}),
		[collapseHelper]
	)
}
