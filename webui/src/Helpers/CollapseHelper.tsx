import { observable, runInAction } from 'mobx'
import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
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
	readonly #defaultCollapsed: boolean

	readonly #defaultExpandedAt = observable.map<string | null, boolean>()
	readonly #ids = observable.map<string, boolean>()

	constructor(storageId: string, defaultCollapsed = false) {
		this.#storageId = `companion_ui_collapsed_${storageId}`
		this.#defaultCollapsed = defaultCollapsed

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
		return this.#ids.get(panelId) ?? this.#defaultExpandedAt.get(parentId) ?? this.#defaultCollapsed
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

const PanelCollapseHelperContext = createContext<PanelCollapseHelper | null>(null)
export function usePanelCollapseHelperContext(): PanelCollapseHelper {
	const context = useContext(PanelCollapseHelperContext)
	if (!context) throw new Error('PanelCollapseHelperContext not found')
	return context
}
export function usePanelCollapseHelperContextForPanel(ownerId: string | null, panelId: string) {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	return {
		// doCollapse: useCallback(() => panelCollapseHelper.setPanelCollapsed(panelId, true), [panelCollapseHelper, panelId]),
		// doExpand: useCallback(() => panelCollapseHelper.setPanelCollapsed(panelId, false), [panelCollapseHelper, panelId]),
		setCollapsed: useCallback(
			(collapsed: boolean) => panelCollapseHelper.setPanelCollapsed(panelId, collapsed),
			[panelCollapseHelper]
		),
		isCollapsed: panelCollapseHelper.isPanelCollapsed(ownerId, panelId),
	}
}

export function PanelCollapseHelperProvider({
	storageId,
	knownPanelIds,
	defaultCollapsed,
	children,
}: React.PropsWithChildren<{
	storageId: string
	knownPanelIds: string[]
	defaultCollapsed?: boolean
}>): JSX.Element {
	const helper = usePanelCollapseHelper(storageId, knownPanelIds, defaultCollapsed)

	return <PanelCollapseHelperContext.Provider value={helper}>{children}</PanelCollapseHelperContext.Provider>
}

export function usePanelCollapseHelper(
	storageId: string,
	knownPanelIds: string[],
	defaultCollapsed = false
): PanelCollapseHelper {
	const store = useMemo(() => new PanelCollapseHelperStore(storageId, defaultCollapsed), [storageId, defaultCollapsed])

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

export function usePanelCollapseHelperLite(
	storageId: string,
	knownPanelIds: string[],
	defaultCollapsed = false
): PanelCollapseHelperLite {
	const panelIdsRef = useRef<string[]>(knownPanelIds)
	panelIdsRef.current = knownPanelIds

	const collapseHelper = usePanelCollapseHelper(storageId, knownPanelIds, defaultCollapsed)

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
