import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import type { TriggerControlId } from '@companion-app/shared/ControlId.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button } from '~/Components/Button.js'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { LocalVariablesEditor } from '~/Controls/LocalVariablesEditor.js'
import { AddNoteButton, NotesStrip } from '~/Controls/Notes.js'
import { useControlOptionsSetter } from '~/Controls/useControlOptionsSetter.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { useLocalVariablesStore } from '../Controls/LocalVariablesStore.js'
import { TriggerStages } from './TriggerStages.js'

interface EditTriggerPanelProps {
	controlId: TriggerControlId
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
					<TriggerPanelContent config={controlConfig.config} controlId={controlId} />
				</div>
			) : (
				''
			)}
		</div>
	)
}

interface TriggerPanelContentProps {
	config: TriggerModel
	controlId: TriggerControlId
}

function TriggerPanelContent({ config, controlId }: TriggerPanelContentProps): React.ReactNode {
	const setOption = useControlOptionsSetter(controlId, 'trigger')
	const triggerNameInputId = `trigger-name-${controlId}`
	const [isEditingName, setIsEditingName] = useState(false)

	const setControlNotes = useControlNotesSetter(controlId, 'trigger')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)
	const [activeTab, setActiveTab] = useLocalStorage<'behaviour' | 'variables'>('triggerEditor.activeTab', 'behaviour')

	const setName = useCallback(
		(name: string) => {
			setOption('name', name).catch((e) => {
				console.error(`Set name failed: ${stringifyError(e)}`)
			})
		},
		[setOption]
	)

	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables)

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			{/* Top Header: Trigger Title */}
			<div className="px-2 py-1 bg-surface border-b border-border shrink-0 flex items-center gap-2">
				<div className="grow min-w-0 px-1 py-0.5">
					{isEditingName ? (
						<TextInputFieldSimple
							id={triggerNameInputId}
							setValue={setName}
							value={config.options.name}
							placeholder="Trigger Name..."
							className="h-8 font-semibold text-base bg-surface"
							autoFocus
							onBlur={() => setIsEditingName(false)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
							}}
						/>
					) : (
						<Button
							variant="ghost"
							onClick={() => setIsEditingName(true)}
							className="group w-full h-8 px-1.5 flex items-center gap-2 text-left"
							aria-label="Edit trigger name"
						>
							<span className="grow min-w-0 truncate font-semibold text-base text-body">
								{config.options.name || 'Untitled trigger'}
							</span>
							<FontAwesomeIcon
								icon={faPencil}
								className="shrink-0 text-2xs text-muted opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
							/>
						</Button>
					)}
				</div>
				<div className="shrink-0">
					<AddNoteButton state={notesState} />
				</div>
			</div>

			<div className="px-3 shrink-0">
				<MyErrorBoundary>
					<NotesStrip key={controlId} state={notesState} />
				</MyErrorBoundary>

				<TabArea.Root variant="pills" value={activeTab} onValueChange={setActiveTab} className="mt-1">
					<TabArea.List>
						<TabArea.Tab value="behaviour">Behaviour</TabArea.Tab>
						<TabArea.Tab value="variables">
							<span>Local Variables</span>
							{config.localVariables.length > 0 && (
								<span className="px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-primary/20 text-primary">
									{config.localVariables.length}
								</span>
							)}
						</TabArea.Tab>
					</TabArea.List>
				</TabArea.Root>
			</div>

			{activeTab === 'variables' ? (
				<div className="page-scroll p-4 pt-2">
					<div className="max-w-readable">
						<MyErrorBoundary>
							<LocalVariablesEditor
								controlId={controlId}
								location={undefined}
								variables={config.localVariables}
								localVariablesStore={localVariablesStore}
							/>
						</MyErrorBoundary>
					</div>
				</div>
			) : (
				<div className="page-scroll p-4 pt-2">
					<div className="max-w-readable">
						<TriggerStages config={config} controlId={controlId} localVariablesStore={localVariablesStore} />
					</div>
				</div>
			)}
		</div>
	)
}
