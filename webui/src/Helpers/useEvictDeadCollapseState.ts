import { useContext, useEffect, useRef } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { evictDeadOwnedKeys, type LiveIdSets } from './CollapseStorage.js'

/**
 * Once the relevant stores have fully loaded, run a single pass to delete orphaned collapse-state
 * keys whose owning control/connection no longer exists. Runs at most once per session.
 *
 * `loadingComplete` must only be true once pages, triggers, expression variables and connections
 * are all loaded (see ContextData) — otherwise a not-yet-loaded id would be mistaken for a deleted
 * one and its collapse state wrongly removed.
 */
export function useEvictDeadCollapseState(loadingComplete: boolean): void {
	const { pages, triggersList, expressionVariablesList, connections } = useContext(RootAppStoreContext)
	const hasRun = useRef(false)

	useEffect(() => {
		if (!loadingComplete || hasRun.current) return
		hasRun.current = true

		// Snapshot the live ids. A control may be a button, a trigger or an expression variable.
		const controls = new Set<string>()
		for (const page of pages.data) {
			for (const rowMap of page.controls.values()) {
				for (const controlId of rowMap.values()) {
					controls.add(controlId)
				}
			}
		}
		for (const triggerId of triggersList.triggers.keys()) controls.add(triggerId)
		for (const variableId of expressionVariablesList.expressionVariables.keys()) controls.add(variableId)

		const live: LiveIdSets = {
			controls,
			connections: new Set<string>(connections.connections.keys()),
		}
		evictDeadOwnedKeys(live)
	}, [loadingComplete, pages, triggersList, expressionVariablesList, connections])
}
