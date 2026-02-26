/* eslint-disable react-refresh/only-export-components */
import { observable, runInAction } from 'mobx'
import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import { useDeepCompareEffect } from 'use-deep-compare'

interface CollapsedState {
	// @deprecated
	defaultCollapsed?: boolean
	defaultExpandedAt: Record<string, boolean | undefined> | undefined
	ids: Record<string, boolean | undefined>
}

export type PanelCollapseDefaultCollapsed = boolean | ((panelId: string) => boolean)

export interface PanelCollapseHelper {
	setAllCollapsed: (parentId: string | null, panelIds: string[]) => void
	setAllExpanded: (parentId: string | null, panelIds: string[]) => void
	canExpandAll(parentId: string | null, panelIds: string[]): boolean
	canCollapseAll(parentId: string | null, panelIds: string[]): boolean
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	togglePanelCollapsed: (parentId: string | null, panelId: string) => void
	isPanelCollapsed: (parentId: string | null, panelId: string) => boolean
}

class PanelCollapseHelperStore implements PanelCollapseHelper {
	readonly #storageId: string | null
	readonly #defaultCollapsed: PanelCollapseDefaultCollapsed

	readonly #defaultExpandedAt = observable.map<string | null, boolean>()
	readonly #ids = observable.map<string, boolean>()

	constructor(storageId: string | null, defaultCollapsed: PanelCollapseDefaultCollapsed = false) {
		this.#storageId = storageId ? `companion_ui_collapsed_${storageId}` : null
		this.#defaultCollapsed = defaultCollapsed

		// Try loading the old state (skip if in-memory mode)
		if (this.#storageId) {
			runInAction(() => {
				try {
					const oldState = window.localStorage.getItem(this.#storageId!)
					if (oldState) {
						const parsedState: CollapsedState = JSON.parse(oldState)
						if (typeof parsedState.defaultCollapsed === 'boolean') {
							this.#defaultExpandedAt.set(null, !parsedState.defaultCollapsed)
							delete parsedState.defaultCollapsed
						} else {
							for (const [key, value] of Object.entries(parsedState.defaultExpandedAt || {})) {
								if (typeof value === 'boolean') this.#defaultExpandedAt.set(key, value)
							}
						}

						// Fixup a serialization issue
						const stringifiedNull = this.#defaultExpandedAt.get('null')
						if (stringifiedNull !== undefined) {
							this.#defaultExpandedAt.set(null, stringifiedNull)
							this.#defaultExpandedAt.delete('null')
						}

						for (const [key, value] of Object.entries(parsedState.ids)) {
							if (typeof value === 'boolean') this.#ids.set(key, value)
						}
					}
				} catch (_e) {
					// Ignore
				}
			})
		}
	}

	#writeState() {
		if (!this.#storageId) return // In-memory mode, no persistence
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

	togglePanelCollapsed = (parentId: string | null, panelId: string): void => {
		runInAction(() => {
			const currentState = this.isPanelCollapsed(parentId, panelId)
			this.#ids.set(panelId, !currentState)

			this.#writeState()
		})
	}

	isPanelCollapsed = (parentId: string | null, panelId: string): boolean => {
		const storedValue = this.#ids.get(panelId)
		if (storedValue !== undefined) return storedValue

		const parentDefault = this.#defaultExpandedAt.get(parentId)
		if (parentDefault !== undefined) return parentDefault

		if (typeof this.#defaultCollapsed === 'function') return this.#defaultCollapsed(panelId)
		return this.#defaultCollapsed
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

export interface PanelCollapseHelperForPanel {
	// doCollapse: () => void
	// doExpand: () => void
	setCollapsed: (collapsed: boolean) => void
	toggleCollapsed: () => void
	isCollapsed: boolean
}

export function usePanelCollapseHelperContextForPanel(
	ownerId: string | null,
	panelId: string
): PanelCollapseHelperForPanel {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	return {
		// doCollapse: useCallback(() => panelCollapseHelper.setPanelCollapsed(panelId, true), [panelCollapseHelper, panelId]),
		// doExpand: useCallback(() => panelCollapseHelper.setPanelCollapsed(panelId, false), [panelCollapseHelper, panelId]),
		setCollapsed: useCallback(
			(collapsed: boolean) => panelCollapseHelper.setPanelCollapsed(panelId, collapsed),
			[panelCollapseHelper, panelId]
		),
		toggleCollapsed: useCallback(
			() => panelCollapseHelper.togglePanelCollapsed(ownerId, panelId),
			[panelCollapseHelper, ownerId, panelId]
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
	storageId: string | null,
	knownPanelIds: string[],
	defaultCollapsed: PanelCollapseDefaultCollapsed = false
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
