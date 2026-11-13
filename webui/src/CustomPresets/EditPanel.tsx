import { useCallback, useId } from 'react'
import type { CustomPresetControlId } from '@companion-app/shared/ControlId.js'
import type { NormalButtonRuntimeProps } from '@companion-app/shared/Model/ButtonModel.js'
import type { CustomPresetModel, CustomPresetOptions } from '@companion-app/shared/Model/CustomPresetModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { ButtonEditorTabBar } from '~/Buttons/EditButton/ButtonEditorTabs.js'
import { LayeredButtonEditor } from '~/Buttons/EditButton/LayeredButtonEditor/LayeredButtonEditor.js'
import { LayeredButtonExtraTabs, useButtonEditorMainTab } from '~/Buttons/EditButton/useButtonEditorMainTab.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { AddNoteButton, NotesStrip } from '~/Controls/Notes.js'
import { useControlOptionsSetter } from '~/Controls/useControlOptionsSetter.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'

interface EditCustomPresetPanelProps {
	controlId: CustomPresetControlId
}

export function EditCustomPresetPanel({ controlId }: EditCustomPresetPanelProps): React.JSX.Element {
	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const loadError = configError ?? null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig && (
				<CustomPresetPanelContent
					config={controlConfig.config}
					runtimeProps={controlConfig.runtime}
					controlId={controlId}
				/>
			)}
		</div>
	)
}

interface CustomPresetPanelContentProps {
	config: CustomPresetModel
	runtimeProps: NormalButtonRuntimeProps
	controlId: CustomPresetControlId
}

function CustomPresetPanelContent({ config, runtimeProps, controlId }: CustomPresetPanelContentProps): React.ReactNode {
	const setControlNotes = useControlNotesSetter(controlId, 'custom-preset')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)
	const editorTabs = useButtonEditorMainTab(config.steps, LayeredButtonExtraTabs)

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			<div className="px-3 pt-2 shrink-0">
				<CustomPresetDetails config={config} controlId={controlId} />
				<div className="flex justify-end">
					<AddNoteButton state={notesState} />
				</div>

				<MyErrorBoundary>
					<NotesStrip key={controlId} state={notesState} />
				</MyErrorBoundary>

				<div className="mt-1">
					<ButtonEditorTabBar {...editorTabs} />
				</div>
			</div>

			<div className="flex-1 min-h-0 flex flex-col overflow-auto px-3">
				<LayeredButtonEditor
					config={config}
					controlId={controlId}
					runtimeProps={runtimeProps}
					location={undefined}
					activeMainTab={editorTabs.activeTab}
				/>
			</div>
		</div>
	)
}

function CustomPresetDetails({ config, controlId }: { config: CustomPresetModel; controlId: CustomPresetControlId }) {
	const setOptionInner = useControlOptionsSetter(controlId, 'custom-preset')
	const nameId = useId()
	const descriptionId = useId()

	const setOption = useCallback(
		<K extends keyof CustomPresetOptions>(key: K, value: CustomPresetOptions[K]) => {
			setOptionInner(key, value).catch((e) => {
				console.error(`Set ${key} failed: ${stringifyError(e)}`)
			})
		},
		[setOptionInner]
	)

	return (
		<Grid.Row className="sm:gap-2">
			<FormLabel htmlFor={nameId} sm={4} column="sm">
				Name
			</FormLabel>
			<Grid.Col sm={8}>
				<TextInputFieldSimple
					id={nameId}
					value={config.options.name}
					setValue={(value) => setOption('name', value)}
					placeholder="Custom preset name"
				/>
			</Grid.Col>

			<FormLabel htmlFor={descriptionId} sm={4} column="sm">
				Description
			</FormLabel>
			<Grid.Col sm={8}>
				<TextInputFieldSimple
					id={descriptionId}
					value={config.options.description}
					setValue={(value) => setOption('description', value)}
					placeholder="Helps to find it when searching the presets"
				/>
			</Grid.Col>
		</Grid.Row>
	)
}
