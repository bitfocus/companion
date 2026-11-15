import { useCallback, useId, useMemo, useState } from 'react'
import type { CustomElementControlId } from '@companion-app/shared/ControlId.js'
import type { CustomElementModel, CustomElementOptions } from '@companion-app/shared/Model/CustomElementModel.js'
import { toCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { LayeredButtonEditorStyle } from '~/Buttons/EditButton/LayeredButtonEditor/LayeredButtonEditor.js'
import { LayeredStyleStore } from '~/Buttons/EditButton/LayeredButtonEditor/StyleStore.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { BuildingBlockInputsEditor } from '~/Controls/BuildingBlockInputsEditor.js'
import { useLocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { AddNoteButton, NotesStrip } from '~/Controls/Notes.js'
import { useBuildingBlockInputsService } from '~/Controls/useBuildingBlockInputsService.js'
import { useControlOptionsSetter } from '~/Controls/useControlOptionsSetter.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import type { CustomElementEditTab } from './customElementEditTabs.js'
import { CustomElementUsesEditor } from './UsesEditor.js'
import './EditPanel.css'

interface EditCustomElementPanelProps {
	controlId: CustomElementControlId
	activeTab: CustomElementEditTab
	setActiveTab: (tab: CustomElementEditTab) => void
}

export function EditCustomElementPanel({
	controlId,
	activeTab,
	setActiveTab,
}: EditCustomElementPanelProps): React.JSX.Element {
	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const loadError = configError ?? null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig && (
				<CustomElementPanelContent
					config={controlConfig.config}
					controlId={controlId}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			)}
		</div>
	)
}

interface CustomElementPanelContentProps {
	config: CustomElementModel
	controlId: CustomElementControlId
	activeTab: CustomElementEditTab
	setActiveTab: (tab: CustomElementEditTab) => void
}

function CustomElementPanelContent({
	config,
	controlId,
	activeTab,
	setActiveTab,
}: CustomElementPanelContentProps): React.ReactNode {
	const setControlNotes = useControlNotesSetter(controlId, 'custom-element')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)

	const inputFields = useMemo(() => config.inputs.map(toCompanionInputField), [config.inputs])
	const inputsService = useBuildingBlockInputsService(controlId)

	// It has no local variables of its own, but its elements can use its inputs
	const localVariablesStore = useLocalVariablesStore(controlId, null, null, inputFields)

	const [styleStore] = useState(() => new LayeredStyleStore())
	useMemo(() => styleStore.updateData(config.elements), [styleStore, config.elements])

	return (
		<div className="custom-element-edit-panel">
			<div className="px-3 pt-2 shrink-0">
				<CustomElementDetails config={config} controlId={controlId} />
				<div className="flex justify-end">
					<AddNoteButton state={notesState} />
				</div>

				<MyErrorBoundary>
					<NotesStrip key={controlId} state={notesState} />
				</MyErrorBoundary>

				<TabArea.Root variant="pills" value={activeTab} onValueChange={setActiveTab} className="mt-1">
					<TabArea.List>
						<TabArea.Tab value="elements">Elements</TabArea.Tab>
						<TabArea.Tab value="inputs">
							<span>Inputs</span>
							{config.inputs.length > 0 && (
								<span className="px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-primary/20 text-primary">
									{config.inputs.length}
								</span>
							)}
						</TabArea.Tab>
						<TabArea.Tab value="uses">Uses</TabArea.Tab>
					</TabArea.List>
				</TabArea.Root>
			</div>

			{activeTab === 'elements' ? (
				<div className="custom-element-elements">
					<MyErrorBoundary>
						<LayeredButtonEditorStyle
							controlId={controlId}
							location={null}
							bare={true}
							styleStore={styleStore}
							localVariablesStore={localVariablesStore}
						/>
					</MyErrorBoundary>
				</div>
			) : (
				<div className="page-scroll p-4 pt-0">
					<div className="max-w-readable">
						{activeTab === 'inputs' && (
							<MyErrorBoundary>
								<BuildingBlockInputsEditor
									service={inputsService}
									inputs={config.inputs}
									usedAs="element"
									collapseStorageId={`custom_element_inputs_${controlId}`}
								/>
							</MyErrorBoundary>
						)}

						{activeTab === 'uses' && (
							<MyErrorBoundary>
								<CustomElementUsesEditor controlId={controlId} />
							</MyErrorBoundary>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

function CustomElementDetails({
	config,
	controlId,
}: {
	config: CustomElementModel
	controlId: CustomElementControlId
}) {
	const setOptionInner = useControlOptionsSetter(controlId, 'custom-element')
	const nameId = useId()
	const descriptionId = useId()

	const setOption = useCallback(
		<K extends keyof CustomElementOptions>(key: K, value: CustomElementOptions[K]) => {
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
					placeholder="Custom element name"
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
					placeholder="Shown when choosing the element"
				/>
			</Grid.Col>
		</Grid.Row>
	)
}
