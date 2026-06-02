import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import ActionInspector from './components/ActionInspector.js'
import AddActionModal, { type ActionTemplate } from './components/AddActionModal.js'
import { TimelineButtonGrid } from './components/ButtonGrid.js'
import LibraryPanel from './components/LibraryPanel.js'
import Timeline, { type TimelineButton } from './components/Timeline.js'
import { buildActionLibrary } from './library.js'
import {
	intToColor,
	type ButtonControl,
	type CompanionAction,
	type CompanionInstance,
	type ExecutionMode,
	type TriggerKey,
} from './types.js'
import { useTimelineData } from './useTimelineData.js'
import './timeline.scss'

function genId(): string {
	return nanoid(10)
}

interface TimelinePageProps {
	initialLocation?: ControlLocation
}

export const TimelinePage = observer(function TimelinePage({ initialLocation }: TimelinePageProps): React.JSX.Element {
	const { pages, userConfig, connections, entityDefinitions } = useContext(RootAppStoreContext)

	const gridSize = userConfig.properties?.gridSize ?? { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

	const [pageNumber, setPageNumber] = useState(initialLocation?.pageNumber ?? 1)
	const [selectedLocation, setSelectedLocation] = useState<ControlLocation | null>(initialLocation ?? null)

	// Re-focus when navigated here for a specific button (e.g. from the button editor)
	const initialKey = initialLocation
		? `${initialLocation.pageNumber}:${initialLocation.row}:${initialLocation.column}`
		: null
	useEffect(() => {
		if (!initialLocation) return
		setSelectedLocation(initialLocation)
		setPageNumber(initialLocation.pageNumber)
		setSelectedAction(null)
		setPlayheadMs(0)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialKey])
	const [selectedAction, setSelectedAction] = useState<{ id: string; triggerKey: TriggerKey; stepKey: string } | null>(
		null
	)
	const [showLibrary, setShowLibrary] = useState(true)
	const [addingAction, setAddingAction] = useState<{
		stepKey: string
		triggerKey: TriggerKey
		delay: number
		groupPath?: string[]
	} | null>(null)

	const [playheadMs, setPlayheadMs] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)
	const [isPaused, setIsPaused] = useState(false)
	const timelineVisibleMsRef = useRef(5000)
	const animFrameRef = useRef<number | null>(null)
	const playStartRef = useRef<{ wallTime: number; startMs: number } | null>(null)

	const controlId = selectedLocation ? (pages.getControlIdAtLocation(selectedLocation) ?? null) : null
	const { controlConfig } = useControlConfig(controlId)
	const buttonModel: SomeButtonModel | null =
		controlConfig && controlConfig.config.type === 'button-layered' ? controlConfig.config : null

	const { control, dirty, saveStatus, updateButton, undo } = useTimelineData(controlId, buttonModel)

	// ── Live-derived data (read directly so mobx tracks changes) ───────────────
	const instances: Record<string, CompanionInstance> = {}
	instances['internal'] = { instance_type: 'internal', label: 'Internal' }
	for (const [id, conn] of connections.connections.entries()) {
		instances[id] = { instance_type: conn.moduleId, label: conn.label, enabled: conn.enabled }
	}

	const usedKeys = useMemo(() => {
		const set = new Set<string>()
		if (control) {
			const walk = (actions: CompanionAction[]) => {
				for (const a of actions) {
					set.add(`${a.instance}:${a.action}`)
					for (const kids of Object.values(a.children ?? {})) walk(kids)
				}
			}
			for (const step of Object.values(control.steps)) {
				for (const acts of Object.values(step.action_sets)) walk(acts ?? [])
			}
		}
		return set
	}, [control])

	const library = buildActionLibrary(connections, entityDefinitions, usedKeys)

	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())
	const pressButton = useCallback(
		(down: boolean) => {
			if (!selectedLocation) return
			hotPressMutation
				.mutateAsync({ location: selectedLocation, direction: down, surfaceId: 'timeline' })
				.catch(() => undefined)
		},
		[hotPressMutation, selectedLocation]
	)

	// ── Selection helpers ──────────────────────────────────────────────────────
	const selectButton = useCallback((location: ControlLocation) => {
		setSelectedLocation(location)
		setSelectedAction(null)
		setPlayheadMs(0)
	}, [])

	const handleActionSelect = useCallback((actionId: string | null, triggerKey: TriggerKey, stepKey: string) => {
		setSelectedAction(actionId ? { id: actionId, triggerKey, stepKey } : null)
	}, [])

	// ── Action-set mutation helpers (ported from the standalone App) ───────────
	const handleActionMove = useCallback(
		(stepKey: string, triggerKey: TriggerKey, actionId: string, newDelay: number) => {
			updateButton((ctrl) => {
				const step = ctrl.steps[stepKey]
				const actions = step.action_sets[triggerKey] ?? []
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[stepKey]: {
							...step,
							action_sets: {
								...step.action_sets,
								[triggerKey]: actions.map((a) => (a.id === actionId ? { ...a, delay: newDelay } : a)),
							},
						},
					},
				}
			})
		},
		[updateButton]
	)

	const handleActionDelayChange = handleActionMove

	const handleActionAdd = useCallback((stepKey: string, triggerKey: TriggerKey, delay: number) => {
		setAddingAction({ stepKey, triggerKey, delay })
	}, [])

	const handleActionDelete = useCallback(
		(stepKey: string, triggerKey: TriggerKey, actionId: string) => {
			updateButton((ctrl) => {
				const step = ctrl.steps[stepKey]
				const actions = step.action_sets[triggerKey] ?? []
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[stepKey]: {
							...step,
							action_sets: { ...step.action_sets, [triggerKey]: actions.filter((a) => a.id !== actionId) },
						},
					},
				}
			})
			setSelectedAction((sa) => (sa?.id === actionId ? null : sa))
		},
		[updateButton]
	)

	const handleActionDrop = useCallback(
		(
			stepKey: string,
			triggerKey: TriggerKey,
			delay: number,
			template: { connectionId: string; definitionId: string; options: Record<string, unknown> }
		) => {
			const newAction: CompanionAction = {
				id: genId(),
				instance: template.connectionId,
				action: template.definitionId,
				delay,
				options: template.options ?? {},
			}
			updateButton((ctrl) => {
				const s = ctrl.steps[stepKey] ?? { action_sets: {} }
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[stepKey]: {
							...s,
							action_sets: { ...s.action_sets, [triggerKey]: [...(s.action_sets[triggerKey] ?? []), newAction] },
						},
					},
				}
			})
			setSelectedAction({ id: newAction.id, triggerKey, stepKey })
		},
		[updateButton]
	)

	const handleActionChange = useCallback(
		(updated: CompanionAction) => {
			if (!selectedAction) return
			updateButton((ctrl) => {
				const step = ctrl.steps[selectedAction.stepKey]
				const actions = step.action_sets[selectedAction.triggerKey] ?? []
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[selectedAction.stepKey]: {
							...step,
							action_sets: {
								...step.action_sets,
								[selectedAction.triggerKey]: actions.map((a) => (a.id === updated.id ? updated : a)),
							},
						},
					},
				}
			})
		},
		[selectedAction, updateButton]
	)

	// ── Group helpers ──────────────────────────────────────────────────────────
	const updateGroupAtPath = useCallback(
		(stepKey: string, triggerKey: TriggerKey, path: string[], updater: (c: CompanionAction[]) => CompanionAction[]) => {
			if (path.length === 0) return
			const traverse = (actions: CompanionAction[], remaining: string[]): CompanionAction[] => {
				const [id, ...rest] = remaining
				return actions.map((a) => {
					if (a.id !== id) return a
					const kids = a.children?.default ?? []
					return {
						...a,
						children: { ...a.children, default: rest.length === 0 ? updater(kids) : traverse(kids, rest) },
					}
				})
			}
			updateButton((ctrl) => {
				const step = ctrl.steps[stepKey]
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[stepKey]: {
							...step,
							action_sets: {
								...step.action_sets,
								[triggerKey]: traverse(step.action_sets[triggerKey] ?? [], path),
							},
						},
					},
				}
			})
		},
		[updateButton]
	)

	const handleChildActionMove = useCallback(
		(stepKey: string, triggerKey: TriggerKey, path: string[], childId: string, newDelay: number) =>
			updateGroupAtPath(stepKey, triggerKey, path, (cs) =>
				cs.map((c) => (c.id === childId ? { ...c, delay: newDelay } : c))
			),
		[updateGroupAtPath]
	)

	const handleChildActionReorder = useCallback(
		(stepKey: string, triggerKey: TriggerKey, path: string[], fromIdx: number, toIdx: number) =>
			updateGroupAtPath(stepKey, triggerKey, path, (cs) => {
				const next = [...cs]
				const [moved] = next.splice(fromIdx, 1)
				next.splice(toIdx, 0, moved)
				return next
			}),
		[updateGroupAtPath]
	)

	const handleChildActionAdd = useCallback(
		(stepKey: string, triggerKey: TriggerKey, path: string[], delay: number) =>
			setAddingAction({ stepKey, triggerKey, delay, groupPath: path }),
		[]
	)

	const handleChildActionDrop = useCallback(
		(
			stepKey: string,
			triggerKey: TriggerKey,
			path: string[],
			template: { connectionId: string; definitionId: string; options: Record<string, unknown> },
			delay: number
		) => {
			const isGroup = template.connectionId === 'internal' && template.definitionId === 'action_group'
			const newAction: CompanionAction = {
				id: genId(),
				action: template.definitionId,
				instance: template.connectionId,
				options: { ...template.options, ...(isGroup ? { execution_mode: 'concurrent' } : {}) },
				delay,
				...(isGroup ? { children: { default: [] } } : {}),
			}
			updateGroupAtPath(stepKey, triggerKey, path, (cs) => [...cs, newAction])
		},
		[updateGroupAtPath]
	)

	const handleChildExecutionModeChange = useCallback(
		(stepKey: string, triggerKey: TriggerKey, path: string[], childId: string, mode: ExecutionMode) =>
			updateGroupAtPath(stepKey, triggerKey, path, (cs) =>
				cs.map((c) => (c.id === childId ? { ...c, options: { ...c.options, execution_mode: mode } } : c))
			),
		[updateGroupAtPath]
	)

	const handleModalAdd = useCallback(
		(template: ActionTemplate) => {
			if (!addingAction) return
			const { stepKey, triggerKey, delay, groupPath } = addingAction
			if (groupPath && groupPath.length > 0) {
				handleChildActionDrop(
					stepKey,
					triggerKey,
					groupPath,
					{ connectionId: template.connectionId, definitionId: template.definitionId, options: template.options },
					delay
				)
				setAddingAction(null)
				return
			}
			const newAction: CompanionAction = {
				id: genId(),
				action: template.definitionId,
				instance: template.connectionId,
				options: template.options,
				delay,
			}
			updateButton((ctrl) => {
				const step = ctrl.steps[stepKey]
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[stepKey]: {
							...step,
							action_sets: { ...step.action_sets, [triggerKey]: [...(step.action_sets[triggerKey] ?? []), newAction] },
						},
					},
				}
			})
			setSelectedAction({ id: newAction.id, triggerKey, stepKey })
			setAddingAction(null)
		},
		[addingAction, handleChildActionDrop, updateButton]
	)

	// ── Step / trigger management ──────────────────────────────────────────────
	const handleStepAdd = useCallback(() => {
		updateButton((ctrl) => {
			const nextKey = String(Object.keys(ctrl.steps).length)
			return {
				...ctrl,
				steps: { ...ctrl.steps, [nextKey]: { action_sets: { down: [], up: [] }, options: { runWhileHeld: [] } } },
			}
		})
	}, [updateButton])

	const handleStepRemove = useCallback(
		(stepKey: string) => {
			updateButton((ctrl) => {
				const remaining = Object.entries(ctrl.steps).filter(([k]) => k !== stepKey)
				const reindexed: ButtonControl['steps'] = {}
				remaining.forEach(([, v], i) => {
					reindexed[String(i)] = v
				})
				return { ...ctrl, steps: reindexed }
			})
		},
		[updateButton]
	)

	const handleTriggerAdd = useCallback(
		(stepKey: string, holdMs: number) => {
			updateButton((ctrl) => {
				const step = ctrl.steps[stepKey]
				if (!step || String(holdMs) in step.action_sets) return ctrl
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[stepKey]: { ...step, action_sets: { ...step.action_sets, [String(holdMs)]: [] } },
					},
				}
			})
		},
		[updateButton]
	)

	const handleTriggerRemove = useCallback(
		(stepKey: string, triggerKey: TriggerKey) => {
			updateButton((ctrl) => {
				const step = ctrl.steps[stepKey]
				if (!step) return ctrl
				const { [triggerKey]: _removed, ...rest } = step.action_sets
				return { ...ctrl, steps: { ...ctrl.steps, [stepKey]: { ...step, action_sets: rest } } }
			})
			setSelectedAction((sa) => (sa?.triggerKey === triggerKey && sa?.stepKey === stepKey ? null : sa))
		},
		[updateButton]
	)

	const handleExecutionModeChange = useCallback(
		(stepKey: string, triggerKey: TriggerKey, mode: ExecutionMode) => {
			updateButton((ctrl) => {
				const step = ctrl.steps[stepKey]
				const actions = step.action_sets[triggerKey] ?? []
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[stepKey]: {
							...step,
							action_sets: {
								...step.action_sets,
								[triggerKey]: actions.map((a) =>
									a.instance === 'internal' && a.action === 'action_group'
										? { ...a, options: { ...a.options, execution_mode: mode } }
										: a
								),
							},
						},
					},
				}
			})
		},
		[updateButton]
	)

	// ── Derived inspector data ─────────────────────────────────────────────────
	const selectedActionData = useMemo<CompanionAction | null>(() => {
		if (!control || !selectedAction) return null
		const step = control.steps[selectedAction.stepKey]
		if (!step) return null
		const actions = step.action_sets[selectedAction.triggerKey] ?? []
		return actions.find((a) => a.id === selectedAction.id) ?? null
	}, [control, selectedAction])

	const waitAfterMs = useMemo<number | null>(() => {
		if (!control || !selectedAction || !selectedActionData) return null
		const step = control.steps[selectedAction.stepKey]
		if (!step) return null
		const sorted = [...(step.action_sets[selectedAction.triggerKey] ?? [])].sort((a, b) => a.delay - b.delay)
		const idx = sorted.findIndex((a) => a.id === selectedAction.id)
		if (idx === -1 || idx === sorted.length - 1) return null
		return sorted[idx + 1].delay - selectedActionData.delay
	}, [control, selectedAction, selectedActionData])

	const handleSetWaitAfter = useCallback(
		(ms: number) => {
			if (!selectedAction) return
			updateButton((ctrl) => {
				const s = ctrl.steps[selectedAction.stepKey]
				if (!s) return ctrl
				const actions = s.action_sets[selectedAction.triggerKey] ?? []
				const sorted = [...actions].sort((a, b) => a.delay - b.delay)
				const idx = sorted.findIndex((a) => a.id === selectedAction.id)
				if (idx === -1 || idx === sorted.length - 1) return ctrl
				const selected = sorted[idx]
				const nextAction = sorted[idx + 1]
				const targetDelay = selected.delay + Math.max(0, ms)
				const delta = targetDelay - nextAction.delay
				if (delta === 0) return ctrl
				const shiftIds = new Set(sorted.slice(idx + 1).map((a) => a.id))
				return {
					...ctrl,
					steps: {
						...ctrl.steps,
						[selectedAction.stepKey]: {
							...s,
							action_sets: {
								...s.action_sets,
								[selectedAction.triggerKey]: actions.map((a) =>
									shiftIds.has(a.id) ? { ...a, delay: Math.max(0, a.delay + delta) } : a
								),
							},
						},
					},
				}
			})
		},
		[selectedAction, updateButton]
	)

	const handleAddActionAfter = useCallback(
		(ms: number) => {
			if (!selectedAction || !selectedActionData) return
			setAddingAction({
				stepKey: selectedAction.stepKey,
				triggerKey: selectedAction.triggerKey,
				delay: selectedActionData.delay + Math.max(0, ms),
			})
		},
		[selectedAction, selectedActionData]
	)

	const handleSyncOptionToAll = useCallback(
		(key: string, value: unknown) => {
			if (!selectedActionData) return
			const { action: actionId, instance: instanceId, id: selfId } = selectedActionData
			updateButton((ctrl) => {
				const newSteps: ButtonControl['steps'] = {}
				for (const [sk, step] of Object.entries(ctrl.steps)) {
					const newSets: typeof step.action_sets = {}
					for (const [tk, actions] of Object.entries(step.action_sets)) {
						newSets[tk] = (actions ?? []).map((a) =>
							a.id !== selfId && a.action === actionId && a.instance === instanceId
								? { ...a, options: { ...a.options, [key]: value } }
								: a
						)
					}
					newSteps[sk] = { ...step, action_sets: newSets }
				}
				return { ...ctrl, steps: newSteps }
			})
		},
		[selectedActionData, updateButton]
	)

	const knownActionIds = useMemo(() => {
		const ids = new Set<string>()
		for (const a of library) if (a.definitionId) ids.add(a.definitionId)
		return [...ids].sort()
	}, [library])

	// ── Playback (local scrub; fires the real button via hot-press) ────────────
	const stopAnimation = useCallback(() => {
		if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
		playStartRef.current = null
	}, [])

	const handlePause = useCallback(() => {
		stopAnimation()
		setIsPlaying(false)
		setIsPaused(true)
	}, [stopAnimation])

	const handleStop = useCallback(() => {
		stopAnimation()
		setIsPlaying(false)
		setIsPaused(false)
		setPlayheadMs(0)
	}, [stopAnimation])

	const startPlayFrom = useCallback(
		(startMs: number) => {
			if (!control) return
			const actionEnd = (a: CompanionAction, parentDelay = 0): number => {
				const absStart = parentDelay + a.delay
				const dur = ['timeout', 'duration'].reduce((best, k) => {
					const v = a.options?.[k]
					const n = Number(v)
					return v != null && v !== '' && !isNaN(n) && n > 0 ? Math.max(best, n) : best
				}, 0)
				let end = absStart + dur
				for (const kids of Object.values(a.children ?? {}))
					for (const c of kids ?? []) end = Math.max(end, actionEnd(c, absStart))
				return end
			}
			let maxEndMs = 0
			for (const step of Object.values(control.steps))
				for (const acts of Object.values(step.action_sets))
					for (const a of acts ?? []) maxEndMs = Math.max(maxEndMs, actionEnd(a))
			const tail = Math.max(300, Math.round(timelineVisibleMsRef.current / 8))
			const maxMs = maxEndMs + tail
			if (startMs >= maxMs) {
				setPlayheadMs(0)
				return
			}

			setIsPlaying(true)
			setIsPaused(false)
			playStartRef.current = { wallTime: performance.now(), startMs }
			pressButton(true)
			setTimeout(() => pressButton(false), 50)

			const tick = () => {
				const ref = playStartRef.current
				if (!ref) return
				const currentMs = ref.startMs + (performance.now() - ref.wallTime)
				setPlayheadMs(currentMs)
				if (currentMs < maxMs) {
					animFrameRef.current = requestAnimationFrame(tick)
				} else {
					setPlayheadMs(maxMs)
					setIsPlaying(false)
					setIsPaused(false)
					playStartRef.current = null
				}
			}
			animFrameRef.current = requestAnimationFrame(tick)
		},
		[control, pressButton]
	)

	const handlePlay = useCallback(() => {
		if (!control) return
		if (isPlaying) {
			handlePause()
			return
		}
		startPlayFrom(playheadMs)
	}, [control, isPlaying, playheadMs, startPlayFrom, handlePause])

	// Stop playback when the selected button changes
	useEffect(() => {
		stopAnimation()
		setIsPlaying(false)
		setIsPaused(false)
	}, [controlId, stopAnimation])

	// ── Keyboard shortcuts (scoped to this page) ───────────────────────────────
	const handlePlayRef = useRef(handlePlay)
	const handleStopRef = useRef(handleStop)
	const selectedActionRef = useRef(selectedAction)
	const undoRef = useRef(undo)
	const deleteRef = useRef(handleActionDelete)
	handlePlayRef.current = handlePlay
	handleStopRef.current = handleStop
	selectedActionRef.current = selectedAction
	undoRef.current = undo
	deleteRef.current = handleActionDelete

	useEffect(() => {
		const isTyping = (t: EventTarget | null) => {
			const el = t as HTMLElement | null
			return (
				!!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
			)
		}
		const handler = (e: KeyboardEvent) => {
			if (isTyping(e.target)) return
			if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
				e.preventDefault()
				undoRef.current()
				return
			}
			if (e.key === ' ') {
				e.preventDefault()
				handlePlayRef.current()
			} else if (e.key === 'Escape') {
				e.preventDefault()
				handleStopRef.current()
			} else if (e.key === 'Delete' || e.key === 'Backspace') {
				const sa = selectedActionRef.current
				if (sa) {
					e.preventDefault()
					deleteRef.current(sa.stepKey, sa.triggerKey, sa.id)
				}
			} else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				e.preventDefault()
				const step = e.shiftKey ? 500 : e.ctrlKey || e.metaKey ? 100 : 50
				setPlayheadMs((ms) => Math.max(0, ms + (e.key === 'ArrowRight' ? step : -step)))
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [])

	// ── Render data ────────────────────────────────────────────────────────────
	const pageName = pages.get(pageNumber)?.name || `Page ${pageNumber}`
	const buttonLabel = control?.style?.text?.trim() || (controlId ? 'Button' : '')
	const timelineButtons: TimelineButton[] = useMemo(() => {
		if (!control || !controlId) return []
		return [{ key: controlId, label: buttonLabel, pageSlot: pageName, control }]
	}, [control, controlId, buttonLabel, pageName])

	const buttonStyle = control?.style
	const bgColor = buttonStyle ? intToColor(buttonStyle.bgcolor ?? 0) : '#1a1a1a'
	const fgColor = buttonStyle ? intToColor(buttonStyle.color ?? 0xffffff) : '#fff'

	const pageCount = Math.max(1, pages.pageCount)

	return (
		<div className="ct-root">
			<div className="app">
				{addingAction && (
					<AddActionModal library={library} onAdd={handleModalAdd} onClose={() => setAddingAction(null)} />
				)}

				<div className="titlebar">
					<div className="titlebar-title">
						<span className="live-badge">LIVE</span>
						Timeline
						{dirty && <span className="dirty-dot" />}
						{saveStatus && <span className="save-status">{saveStatus}</span>}
					</div>
					<div className="titlebar-actions">
						<button className="toolbar-btn" onClick={handleStop} disabled={!isPlaying && !isPaused} title="Stop [Esc]">
							■
						</button>
						<button
							className={`toolbar-btn ${isPlaying ? 'toolbar-btn--playing' : isPaused ? 'toolbar-btn--active' : ''}`}
							onClick={handlePlay}
							disabled={!controlId || !control}
							title={isPlaying ? 'Pause [Space]' : 'Play from playhead [Space]'}
						>
							{isPlaying ? '⏸' : '▶'}
						</button>
						<button
							className="toolbar-btn toolbar-btn--test"
							onMouseDown={() => pressButton(true)}
							onMouseUp={() => pressButton(false)}
							onMouseLeave={() => pressButton(false)}
							disabled={!controlId}
							title="Hold to test this button live in Companion"
						>
							▶ Test
						</button>
						<button
							className={`toolbar-btn ${showLibrary ? 'toolbar-btn--active' : ''}`}
							onClick={() => setShowLibrary((v) => !v)}
							title="Toggle action library"
						>
							⊞ Library
						</button>
					</div>
				</div>

				<div className="workspace">
					<div className="sidebar-panel">
						<div className="sidebar-header">Buttons</div>
						<div className="ct-page-bar">
							<button
								className="step-tab"
								disabled={pageNumber <= 1}
								onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
							>
								‹
							</button>
							<span className="ct-page-name">{pageName}</span>
							<button
								className="step-tab"
								disabled={pageNumber >= pageCount}
								onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
							>
								›
							</button>
						</div>
						<TimelineButtonGrid
							pageNumber={pageNumber}
							gridSize={gridSize}
							selectedLocation={selectedLocation}
							onSelect={selectButton}
						/>
					</div>

					{showLibrary && <LibraryPanel library={library} />}

					<div className="main-panel">
						{control && (
							<div className="button-header" style={{ backgroundColor: bgColor, color: fgColor }}>
								<span className="button-header-key">{pageName}</span>
								<span className="button-header-text">{buttonStyle?.text || '(no label)'}</span>
							</div>
						)}
						<div className="view-tabs">
							<button className="view-tab view-tab--active">Timeline</button>
						</div>
						{control ? (
							<Timeline
								buttons={timelineButtons}
								selectedKey={controlId}
								instances={instances}
								selectedActionId={selectedAction?.id ?? null}
								playheadMs={playheadMs}
								onPlayheadChange={setPlayheadMs}
								onActionSelect={handleActionSelect}
								onActionMove={handleActionMove}
								onActionAdd={handleActionAdd}
								onActionDrop={handleActionDrop}
								onActionDelete={handleActionDelete}
								onStepAdd={handleStepAdd}
								onStepRemove={handleStepRemove}
								onTriggerAdd={handleTriggerAdd}
								onTriggerRemove={handleTriggerRemove}
								onActionDelayChange={handleActionDelayChange}
								onExecutionModeChange={handleExecutionModeChange}
								onVisibleMsChange={(ms) => {
									timelineVisibleMsRef.current = ms
								}}
								onChildActionMove={handleChildActionMove}
								onChildActionReorder={handleChildActionReorder}
								onChildActionAdd={handleChildActionAdd}
								onChildActionDrop={handleChildActionDrop}
								onChildExecutionModeChange={handleChildExecutionModeChange}
							/>
						) : (
							<div className="timeline-empty">
								<p>Select a button to start editing its action timeline</p>
							</div>
						)}
					</div>

					{selectedActionData && selectedAction ? (
						<div className="inspector-panel">
							<ActionInspector
								action={selectedActionData}
								triggerKey={selectedAction.triggerKey}
								stepKey={selectedAction.stepKey}
								instances={instances}
								knownActionIds={knownActionIds}
								waitAfterMs={waitAfterMs}
								onChange={handleActionChange}
								onSetWaitAfter={handleSetWaitAfter}
								onAddActionAfter={handleAddActionAfter}
								onDelete={() =>
									handleActionDelete(selectedAction.stepKey, selectedAction.triggerKey, selectedAction.id)
								}
								onSyncOptionToAll={handleSyncOptionToAll}
							/>
						</div>
					) : (
						<div className="inspector-panel inspector-panel--empty">
							<p>Select an action to inspect</p>
						</div>
					)}
				</div>
			</div>
		</div>
	)
})
