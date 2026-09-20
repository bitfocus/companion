import {
	faArrowDown,
	faBolt,
	faChevronDown,
	faChevronRight,
	faDollarSign,
	faFilter,
	faPencil,
	faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useState } from 'react'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { ControlNotesEditor } from '~/Controls/ControlNotesEditor.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { LocalVariablesEditor } from '~/Controls/LocalVariablesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useLocalVariablesStore } from '../Controls/LocalVariablesStore.js'
import { TriggerEventEditor } from './EventEditor.js'

interface EditTriggerPanelProps {
	controlId: string
}

export function EditTriggerPanel({ controlId }: EditTriggerPanelProps): React.JSX.Element {
	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig ? (
				<div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ display: dataReady ? '' : 'none' }}>
					{controlConfig.config.type === 'trigger' ? (
						<TriggerPanelContent config={controlConfig.config} controlId={controlId} />
					) : (
						<StaticAlert color="danger">
							Invalid control type: {controlConfig.config.type}. Expected 'trigger'.
						</StaticAlert>
					)}
				</div>
			) : (
				''
			)}
		</div>
	)
}

interface TriggerPanelContentProps {
	config: TriggerModel
	controlId: string
}

function TriggerPanelContent({ config, controlId }: TriggerPanelContentProps): React.ReactNode {
	const { notifier } = useContext(RootAppStoreContext)
	const testActionsMutation = useMutationExt(trpc.controls.triggers.testActions.mutationOptions())
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const [showVariablesAndNotes, setShowVariablesAndNotes] = useState(
		Boolean(config.localVariables.length > 0 || config.options.notes)
	)

	const doTestRun = useCallback(() => {
		testActionsMutation
			.mutateAsync({ controlId })
			.then(() => {
				notifier.show('Trigger Tested', `Fired trigger "${config.options.name || 'Untitled'}"`, 3000)
			})
			.catch((err) => {
				notifier.show('Test Failed', String(err), 4000)
			})
	}, [testActionsMutation, controlId, config.options.name, notifier])

	const setName = useCallback(
		(name: string) => {
			setOptionsFieldMutation
				.mutateAsync({
					controlId,
					key: 'name',
					value: name,
				})
				.catch((e) => {
					console.error(`Set name failed: ${e}`)
				})
		},
		[setOptionsFieldMutation, controlId]
	)

	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables)

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-surface-muted/20">
			{/* Top Header: Trigger Title & Live Test Run */}
			<div className="p-3 bg-surface border-b border-border shrink-0 flex items-center justify-between gap-3 shadow-2xs">
				<div className="grow min-w-0">
					<TextInputFieldSimple
						id={undefined}
						setValue={setName}
						value={config.options.name}
						placeholder="Trigger Name..."
						className="h-8 font-semibold text-sm bg-surface-subtle"
					/>
				</div>

				<Button
					variant="ghost"
					size="sm"
					onClick={doTestRun}
					title="Test fire trigger actions immediately"
					className="text-xs px-3 py-1.5 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 font-medium shrink-0 rounded-lg transition-all"
				>
					<FontAwesomeIcon icon={faPlay} className="text-2xs" />
					<span>Test Run</span>
				</Button>
			</div>

			{/* Unified Automation Pipeline Canvas (No Tabs, No Truncation) */}
			<div className="page-scroll p-4 space-y-3">
				{/* ─── STAGE 1: WHEN (Events) ─────────────────────────────────── */}
				<div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
					<div className="px-3.5 py-2.5 bg-surface-subtle border-b border-border flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="px-1.5 py-0.5 rounded text-3xs font-bold font-mono uppercase bg-amber-500/15 text-amber-600 border border-amber-500/20 flex items-center gap-1">
								<FontAwesomeIcon icon={faBolt} className="text-3xs" />
								WHEN
							</span>
							<span className="text-xs font-semibold text-body">Trigger Events</span>
						</div>
						<span className="text-3xs font-medium text-muted">
							{config.events.length} {config.events.length === 1 ? 'event' : 'events'}
						</span>
					</div>

					<div className="p-3">
						<MyErrorBoundary>
							<TriggerEventEditor
								heading=""
								controlId={controlId}
								events={config.events}
								localVariablesStore={localVariablesStore}
							/>
						</MyErrorBoundary>
					</div>
				</div>

				{/* Connector Arrow */}
				<div className="flex justify-center items-center -my-1 text-muted/50">
					<div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-3xs shadow-xs">
						<FontAwesomeIcon icon={faArrowDown} />
					</div>
				</div>

				{/* ─── STAGE 2: IF (Conditions) ───────────────────────────────── */}
				<div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
					<div className="px-3.5 py-2.5 bg-surface-subtle border-b border-border flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="px-1.5 py-0.5 rounded text-3xs font-bold font-mono uppercase bg-sky-500/15 text-sky-600 border border-sky-500/20 flex items-center gap-1">
								<FontAwesomeIcon icon={faFilter} className="text-3xs" />
								IF
							</span>
							<span className="text-xs font-semibold text-body">Conditions & Guardrails</span>
						</div>
						<span className="text-3xs font-medium text-muted">
							{config.condition.length === 0 ? 'Always run' : `${config.condition.length} conditions`}
						</span>
					</div>

					<div className="p-3">
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading=""
								controlId={controlId}
								entities={config.condition}
								listId="feedbacks"
								entityType={EntityModelType.Feedback}
								entityTypeLabel="condition"
								feedbackListType={FeedbackEntitySubType.Boolean}
								location={undefined}
								localVariablesStore={localVariablesStore}
								localVariablePrefix={null}
							/>
						</MyErrorBoundary>
					</div>
				</div>

				{/* Connector Arrow */}
				<div className="flex justify-center items-center -my-1 text-muted/50">
					<div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-3xs shadow-xs">
						<FontAwesomeIcon icon={faArrowDown} />
					</div>
				</div>

				{/* ─── STAGE 3: THEN (Actions) ────────────────────────────────── */}
				<div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
					<div className="px-3.5 py-2.5 bg-surface-subtle border-b border-border flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="px-1.5 py-0.5 rounded text-3xs font-bold font-mono uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
								<FontAwesomeIcon icon={faPlay} className="text-3xs" />
								THEN
							</span>
							<span className="text-xs font-semibold text-body">Execute Actions</span>
						</div>
						<span className="text-3xs font-medium text-muted">
							{config.actions.length} {config.actions.length === 1 ? 'action' : 'actions'}
						</span>
					</div>

					<div className="p-3">
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading=""
								controlId={controlId}
								location={undefined}
								listId="trigger_actions"
								entities={config.actions}
								entityType={EntityModelType.Action}
								entityTypeLabel="action"
								feedbackListType={null}
								localVariablesStore={localVariablesStore}
								localVariablePrefix={null}
							/>
						</MyErrorBoundary>
					</div>
				</div>

				{/* ─── STAGE 4: Variables & Documentation Notes (Collapsible) ──── */}
				<div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
					<button
						type="button"
						onClick={() => setShowVariablesAndNotes((v) => !v)}
						className="w-full px-3.5 py-2.5 bg-surface-subtle border-b border-border flex items-center justify-between text-left hover:bg-surface-hover transition-colors"
					>
						<div className="flex items-center gap-2">
							<FontAwesomeIcon
								icon={showVariablesAndNotes ? faChevronDown : faChevronRight}
								className="text-2xs text-muted"
							/>
							<span className="text-xs font-semibold text-body">Variables & Documentation Notes</span>
						</div>
						<div className="flex items-center gap-2 text-3xs text-muted font-medium">
							<span>{config.localVariables.length} variables</span>
						</div>
					</button>

					{showVariablesAndNotes && (
						<div className="p-3.5 space-y-4 bg-surface">
							<div>
								<div className="flex items-center gap-1.5 text-xs font-semibold text-body mb-1.5">
									<FontAwesomeIcon icon={faDollarSign} className="text-2xs text-muted" />
									<span>Local Variables</span>
								</div>
								<MyErrorBoundary>
									<LocalVariablesEditor
										className="mt-1"
										controlId={controlId}
										location={undefined}
										variables={config.localVariables}
										localVariablesStore={localVariablesStore}
									/>
								</MyErrorBoundary>
							</div>

							<div className="pt-2 border-t border-border/70">
								<div className="flex items-center gap-1.5 text-xs font-semibold text-body mb-1.5">
									<FontAwesomeIcon icon={faPencil} className="text-2xs text-muted" />
									<span>Notes & Documentation</span>
								</div>
								<MyErrorBoundary>
									<ControlNotesEditor controlId={controlId} notes={config.options.notes} multiline={true} />
								</MyErrorBoundary>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
