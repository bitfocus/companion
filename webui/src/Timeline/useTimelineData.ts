import { useCallback, useEffect, useRef, useState } from 'react'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { trpcClient } from '~/Resources/TRPC'
import { buttonModelToFlat, flatActionsToEntities } from './adapter.js'
import { triggerKeyToSetId, type ButtonControl, type CompanionAction } from './types.js'

const SYNC_DEBOUNCE_MS = 450
const MAX_UNDO = 20

interface BackendEntityRef {
	id: string
}

// A `${stepKey}::${setId}` map of the entity ids we believe are live on the backend.
type BackendSets = Map<string, BackendEntityRef[]>

function setKey(stepKey: string, setId: string): string {
	return `${stepKey}::${setId}`
}

// Top-level entity ids per set, taken straight from the live Companion model.
function backendSetsFromModel(model: SomeButtonModel | null | undefined): BackendSets {
	const out: BackendSets = new Map()
	if (!model || model.type !== 'button-layered') return out
	for (const [stepKey, step] of Object.entries(model.steps ?? {})) {
		if (!step) continue
		for (const [sid, entities] of Object.entries(step.action_sets ?? {})) {
			out.set(
				setKey(stepKey, sid),
				(entities ?? []).map((e) => ({ id: e.id }))
			)
		}
	}
	return out
}

// Normalised (id-free) projection of a set's actions, for change detection.
function stripIds(actions: CompanionAction[] | undefined): unknown {
	return (actions ?? []).map((a) => ({
		instance: a.instance,
		action: a.action,
		delay: a.delay,
		disabled: a.disabled ?? false,
		options: a.options,
		children: a.children ? Object.fromEntries(Object.entries(a.children).map(([k, v]) => [k, stripIds(v)])) : undefined,
	}))
}

function wrapOptionValue(v: unknown): { value: unknown; isExpression: boolean } {
	return v !== null && typeof v === 'object' && 'value' in v
		? (v as { value: unknown; isExpression: boolean })
		: { value: v, isExpression: false }
}

// Add an entity to a control's action set, then recurse into its children.
// Stateless (only uses the tRPC client), so it lives at module scope.
async function pushEntity(
	cId: string,
	location: { stepId: string; setId: string | number },
	ownerId: string | null,
	entity: SomeEntityModel
): Promise<string | null> {
	const newId = await trpcClient.controls.entities.add.mutate({
		controlId: cId,
		entityLocation: location,
		ownerId: ownerId ? { parentId: ownerId, childGroup: 'default' } : null,
		connectionId: entity.connectionId,
		entityType: entity.type,
		entityDefinition: entity.definitionId,
	})
	if (!newId) return null
	for (const [key, val] of Object.entries(entity.options ?? {})) {
		await trpcClient.controls.entities.setOption.mutate({
			controlId: cId,
			entityLocation: location,
			entityId: newId,
			key,
			value: wrapOptionValue(val),
		})
	}
	for (const kids of Object.values(entity.children ?? {})) {
		for (const child of kids ?? []) {
			await pushEntity(cId, location, newId, child)
		}
	}
	return newId
}

export interface UseTimelineDataResult {
	control: ButtonControl | null
	dirty: boolean
	saveStatus: string | null
	updateButton: (updater: (ctrl: ButtonControl) => ButtonControl) => void
	undo: () => void
}

/**
 * Holds an editable draft projection of a single Companion control and syncs edits back
 * to Companion via the existing entity tRPC mutations. The draft is seeded from the live
 * model whenever there are no pending local edits.
 */
export function useTimelineData(controlId: string | null, liveModel: SomeButtonModel | null): UseTimelineDataResult {
	const [control, setControl] = useState<ButtonControl | null>(null)
	const [dirty, setDirty] = useState(false)
	const [saveStatus, setSaveStatus] = useState<string | null>(null)

	const controlRef = useRef<ButtonControl | null>(null)
	const dirtyRef = useRef(false)
	const lastSyncedRef = useRef<ButtonControl | null>(null)
	const backendSetsRef = useRef<BackendSets>(new Map())
	const historyRef = useRef<ButtonControl[]>([])
	const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const syncTailRef = useRef<Promise<void>>(Promise.resolve())
	const controlIdRef = useRef<string | null>(controlId)

	controlRef.current = control
	dirtyRef.current = dirty

	// Reset everything when the selected control changes
	useEffect(() => {
		controlIdRef.current = controlId
		setControl(null)
		setDirty(false)
		setSaveStatus(null)
		controlRef.current = null
		lastSyncedRef.current = null
		backendSetsRef.current = new Map()
		historyRef.current = []
	}, [controlId])

	// Seed/refresh the draft from the live model whenever there are no pending edits
	useEffect(() => {
		if (dirtyRef.current) return
		const flat = buttonModelToFlat(liveModel)
		setControl(flat)
		controlRef.current = flat
		lastSyncedRef.current = flat
		backendSetsRef.current = backendSetsFromModel(liveModel)
	}, [liveModel])

	// Rebuild the changed action sets on the backend: remove the entities we know are there,
	// then add the freshly-projected ones, keeping our authoritative id map in lockstep.
	const performSync = useCallback(async () => {
		const cId = controlIdRef.current
		const draft = controlRef.current
		const lastSynced = lastSyncedRef.current
		if (!cId || !draft) return

		for (const [stepKey, step] of Object.entries(draft.steps)) {
			for (const [sid, actions] of Object.entries(step.action_sets)) {
				const prevActions = lastSynced?.steps?.[stepKey]?.action_sets?.[sid]
				if (JSON.stringify(stripIds(actions)) === JSON.stringify(stripIds(prevActions))) continue

				const location = { stepId: stepKey, setId: triggerKeyToSetId(sid as any) }
				const sk = setKey(stepKey, sid)
				const existing = backendSetsRef.current.get(sk) ?? []

				// Remove existing top-level entities (removing a group removes its children)
				for (const ent of existing) {
					await trpcClient.controls.entities.remove
						.mutate({ controlId: cId, entityLocation: location, entityId: ent.id })
						.catch(() => undefined)
				}

				// Add the projected entities and record their real backend ids
				const target = flatActionsToEntities(actions ?? [])
				const added: BackendEntityRef[] = []
				for (const ent of target) {
					const id = await pushEntity(cId, location, null, ent).catch(() => null)
					if (id) added.push({ id })
				}
				backendSetsRef.current.set(sk, added)
			}
		}

		lastSyncedRef.current = draft
		setDirty(false)
		dirtyRef.current = false
		setSaveStatus('Synced ✓')
		setTimeout(() => setSaveStatus((s) => (s === 'Synced ✓' ? null : s)), 2000)
	}, [])

	const scheduleSync = useCallback(() => {
		if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
		syncTimerRef.current = setTimeout(() => {
			// Serialise syncs so a burst of edits never overlaps mid-flight
			syncTailRef.current = syncTailRef.current.then(async () => performSync()).catch(() => undefined)
		}, SYNC_DEBOUNCE_MS)
	}, [performSync])

	const updateButton = useCallback(
		(updater: (ctrl: ButtonControl) => ButtonControl) => {
			const current = controlRef.current
			if (!current) return
			historyRef.current = [...historyRef.current.slice(-MAX_UNDO), current]
			const next = updater(current)
			controlRef.current = next
			setControl(next)
			setDirty(true)
			dirtyRef.current = true
			scheduleSync()
		},
		[scheduleSync]
	)

	const undo = useCallback(() => {
		const prev = historyRef.current[historyRef.current.length - 1]
		if (!prev) return
		historyRef.current = historyRef.current.slice(0, -1)
		controlRef.current = prev
		setControl(prev)
		setDirty(true)
		dirtyRef.current = true
		scheduleSync()
	}, [scheduleSync])

	useEffect(() => {
		return () => {
			if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
		}
	}, [])

	return { control, dirty, saveStatus, updateButton, undo }
}
