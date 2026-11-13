import { useCallback, useId, useMemo } from 'react'
import type { CustomPresetControlId } from '@companion-app/shared/ControlId.js'
import type { NormalButtonRuntimeProps } from '@companion-app/shared/Model/ButtonModel.js'
import type { CustomPresetModel, CustomPresetOptions } from '@companion-app/shared/Model/CustomPresetModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { ButtonEditorTabBar } from '~/Buttons/EditButton/ButtonEditorTabs.js'
import { LayeredButtonEditor } from '~/Buttons/EditButton/LayeredButtonEditor/LayeredButtonEditor.js'
import {
	LayeredButtonExtraTabs,
	useButtonEditorTabs,
	type ButtonEditorExtraTabs,
	type ButtonEditorMainTabState,
} from '~/Buttons/EditButton/useButtonEditorMainTab.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { AddNoteButton, NotesStrip } from '~/Controls/Notes.js'
import { useControlOptionsSetter } from '~/Controls/useControlOptionsSetter.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { CUSTOM_PRESET_EDIT_TAB_PATHS, type CustomPresetEditTab } from './customPresetEditTabs.js'
import { CustomPresetUsesEditor } from './UsesEditor.js'
import './EditPanel.css'

/** The tabs of a button, and the buttons which are linked to the custom preset */
const CUSTOM_PRESET_EXTRA_TABS: ButtonEditorExtraTabs[] = [
	...LayeredButtonExtraTabs,
	{ id: 'uses', name: 'Uses', position: 'end' },
]

interface EditCustomPresetPanelProps {
	controlId: CustomPresetControlId
	activeTab: CustomPresetEditTab
	setActiveTab: (tab: CustomPresetEditTab) => void
}

export function EditCustomPresetPanel({
	controlId,
	activeTab,
	setActiveTab,
}: EditCustomPresetPanelProps): React.JSX.Element {
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
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			)}
		</div>
	)
}

interface CustomPresetPanelContentProps {
	config: CustomPresetModel
	runtimeProps: NormalButtonRuntimeProps
	controlId: CustomPresetControlId
	activeTab: CustomPresetEditTab
	setActiveTab: (tab: CustomPresetEditTab) => void
}

function CustomPresetPanelContent({
	config,
	runtimeProps,
	controlId,
	activeTab,
	setActiveTab,
}: CustomPresetPanelContentProps): React.ReactNode {
	const setControlNotes = useControlNotesSetter(controlId, 'custom-preset')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)

	const tabs = useButtonEditorTabs(config.steps, CUSTOM_PRESET_EXTRA_TABS)
	const editorTabs = useMemo(
		(): ButtonEditorMainTabState => ({
			tabs,
			activeTab,
			setActiveTab: (tab) => {
				if (isCustomPresetEditTab(tab)) setActiveTab(tab)
			},
		}),
		[tabs, activeTab, setActiveTab]
	)

	return (
		<div className="custom-preset-edit-panel">
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

			<div className="custom-preset-editor">
				{activeTab === 'uses' ? (
					<MyErrorBoundary>
						<CustomPresetUsesEditor controlId={controlId} />
					</MyErrorBoundary>
				) : (
					<LayeredButtonEditor
						config={config}
						controlId={controlId}
						runtimeProps={runtimeProps}
						location={null}
						activeMainTab={activeTab}
					/>
				)}
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

function isCustomPresetEditTab(tab: string): tab is CustomPresetEditTab {
	return Object.hasOwn(CUSTOM_PRESET_EDIT_TAB_PATHS, tab)
}
