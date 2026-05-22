import { CCallout } from '@coreui/react'
import {
	faCircleInfo,
	faClock,
	faDownload,
	faFileImport,
	faGlobe,
	faPlug,
	faTh,
	faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFormHook, createFormHookContexts, formOptions } from '@tanstack/react-form'
import { useCallback, useContext, useState } from 'react'
import type {
	ClientImportObject,
	ClientImportOrResetSelection,
	ImportOrResetType,
} from '@companion-app/shared/Model/ImportExport.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { TabArea } from '~/Components/TabArea.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImportPageWizard } from './Page.js'
import { ImportTriggersTab } from './Triggers.js'

// These can't be imported currently
type ClientImportSelection = Omit<ClientImportOrResetSelection, 'connections' | 'userconfig'>

interface ImportFullWizardProps {
	snapshot: ClientImportObject
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
}

export function ImportFullWizard({
	snapshot,
	connectionRemap,
	setConnectionRemap,
}: ImportFullWizardProps): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)

	const importSinglePageMutation = useMutationExt(trpc.importExport.importSinglePage.mutationOptions())
	const doSinglePageImport = useCallback(
		(fromPage: number, toPage: number, connectionIdRemapping: Record<string, string | undefined>) => {
			importSinglePageMutation
				.mutateAsync({
					sourcePage: fromPage,
					targetPage: toPage,
					connectionIdRemapping,
				})
				.then((res) => {
					notifier.show(`Import successful`, `Page was imported successfully`, 10000)
					console.log('remap response', res)
					if (res) {
						setConnectionRemap(res)
					}
				})
				.catch((e) => {
					notifier.show(`Import failed`, `Page import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[importSinglePageMutation, notifier, setConnectionRemap]
	)

	const [activeTab, setActiveTab] = useState<'full' | 'buttons' | 'triggers'>('full')

	return (
		<TabArea.Root value={activeTab} onValueChange={setActiveTab}>
			<TabArea.List>
				<TabArea.Tab value="full">
					<FontAwesomeIcon icon={faGlobe} /> Full Import
				</TabArea.Tab>
				<TabArea.Tab value="buttons" disabled={!snapshot.buttons}>
					<FontAwesomeIcon icon={faTh} /> Buttons
				</TabArea.Tab>
				<TabArea.Tab value="triggers" disabled={!snapshot.triggers}>
					<FontAwesomeIcon icon={faClock} /> Triggers
				</TabArea.Tab>
			</TabArea.List>

			<TabArea.Panel value="full">
				<MyErrorBoundary>
					<FullImportTab snapshot={snapshot} />
				</MyErrorBoundary>
			</TabArea.Panel>
			<TabArea.Panel value="buttons" style={{ height: '100%' }}>
				<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
					<h4>Buttons</h4>
					<MyErrorBoundary>
						{snapshot.buttons ? (
							<ImportPageWizard
								snapshot={snapshot}
								connectionRemap={connectionRemap}
								setConnectionRemap={setConnectionRemap}
								doImport={doSinglePageImport}
							/>
						) : (
							''
						)}
					</MyErrorBoundary>
				</div>
			</TabArea.Panel>
			<TabArea.Panel value="triggers">
				<MyErrorBoundary>
					{snapshot.triggers ? (
						<ImportTriggersTab
							snapshot={snapshot}
							connectionRemap={connectionRemap}
							setConnectionRemap={setConnectionRemap}
						/>
					) : (
						''
					)}
				</MyErrorBoundary>
			</TabArea.Panel>
		</TabArea.Root>
	)
}

const defaultFullImportConfig: ClientImportSelection = {
	buttons: 'reset-and-import',
	surfaces: {
		known: 'reset-and-import',
		instances: 'reset-and-import',
		remote: 'reset-and-import',
	},
	triggers: 'reset-and-import',
	customVariables: 'reset-and-import',
	expressionVariables: 'reset-and-import',
	imageLibrary: 'reset-and-import',
}

const { fieldContext, useFieldContext, formContext } = createFormHookContexts()

type FormMetaData = { fullReset: boolean }

const defaultMeta: FormMetaData = { fullReset: true }

const importFormOpts = formOptions({
	defaultValues: defaultFullImportConfig,
	onSubmitMeta: defaultMeta,
})

const { useAppForm } = createFormHook({
	fieldComponents: {
		ImportToggleField,
		ImportToggleGroup,
	},
	formComponents: {
		// 	FormSubmitButton,
	},
	fieldContext,
	formContext,
})

interface FullImportTabProps {
	snapshot: ClientImportObject
}

function FullImportTab({ snapshot }: FullImportTabProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const importFullMutation = useMutationExt(trpc.importExport.importFull.mutationOptions())

	const form = useAppForm({
		...importFormOpts,
		onSubmit: async ({ value, meta }) => {
			const fullReset = meta.fullReset
			const submitConfig = sanitiseSelection(value, snapshot, fullReset)

			try {
				await importFullMutation // TODO: 60s timeout?
					.mutateAsync({
						config: submitConfig,
					})

				// notifier.current.show(`Import successful`, `Page was imported successfully`, 10000)
				window.location.reload()
			} catch (e) {
				console.log('import failed', stringifyError(e))
				notifier.show(`Import failed`, `Full import failed with: "${stringifyError(e, true)}"`, 10000)
			}
		},
	})

	return (
		<>
			<h4>Full Import</h4>
			<p>
				A full import will replace the current system configuration of the selected components with the imported
				configuration of the components.
			</p>
			<StaticAlert color="info" className="mb-0">
				<FontAwesomeIcon icon={faCircleInfo} /> Want to import specific buttons or triggers instead? Use the{' '}
				<strong>Buttons</strong> or <strong>Triggers</strong> tabs at the top.
			</StaticAlert>
			<CCallout color="warning">
				<h5>
					<FontAwesomeIcon icon={faWarning} /> Before You Proceed
				</h5>
				<p>
					It is <strong>highly recommended</strong> to export the current system configuration before performing a full
					import.
				</p>
				<LinkButtonExternal color="warning" href={makeAbsolutePath('/int/export/full')}>
					<FontAwesomeIcon icon={faDownload} /> Export Current Configuration
				</LinkButtonExternal>
			</CCallout>
			<h5>Components</h5>
			<p>
				Select the components you want to import. This will{' '}
				<strong>completely reset their existing configuration</strong>, and replace it with the imported state.
			</p>

			<form.AppForm>
				<form
					className={'flex-form'}
					onSubmit={(e) => {
						e.preventDefault()
						e.stopPropagation()
					}}
				>
					{/* <div className="ms-2">
						<CFormCheck
							checked={true}
							disabled
							label={
								<>
									Connections
									<InlineHelp help="Connections are always imported, as they are referenced by the buttons and triggers.">
										<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
									</InlineHelp>
								</>
							}
						/>
					</div> */}

					<div className="ms-2">
						<form.AppField name="buttons">
							{(field) => <field.ImportToggleField label="Buttons" disabled={!snapshot.buttons} />}
						</form.AppField>
					</div>
					<div className="ms-2">
						<form.AppField name="triggers">
							{(field) => <field.ImportToggleField label="Triggers" disabled={!snapshot.triggers} />}
						</form.AppField>
					</div>
					<div className="ms-2">
						<form.AppField name="customVariables">
							{(field) => <field.ImportToggleField label="Custom Variables" disabled={!snapshot.customVariables} />}
						</form.AppField>
					</div>
					<div className="ms-2">
						<form.AppField name="expressionVariables">
							{(field) => (
								<field.ImportToggleField label="Expression Variables" disabled={!snapshot.expressionVariables} />
							)}
						</form.AppField>
					</div>
					<div className="ms-2">
						<form.AppField name="surfaces">
							{(field) => (
								<field.ImportToggleGroup
									label="Surfaces"
									disabled={!snapshot.surfacesInstances && !snapshot.surfacesKnown && !snapshot.surfacesRemote}
									defaultChecked={
										{
											known: 'reset-and-import',
											instances: 'reset-and-import',
											remote: 'reset-and-import',
										} satisfies ClientImportSelection['surfaces']
									}
									defaultUnchecked={
										{
											known: 'unchanged',
											instances: 'unchanged',
											remote: 'unchanged',
										} satisfies ClientImportSelection['surfaces']
									}
								/>
							)}
						</form.AppField>
					</div>

					<div className="ms-2">
						<form.AppField name="surfaces.known">
							{(field) => (
								<field.ImportToggleField
									className="ms-4"
									disabled={!snapshot.surfacesKnown}
									label={
										<>
											Known Surfaces
											<InlineHelpIcon className="ms-1">The list of known surfaces, and their settings</InlineHelpIcon>
										</>
									}
								/>
							)}
						</form.AppField>
					</div>
					<div className="ms-2">
						<form.AppField name="surfaces.instances">
							{(field) => (
								<field.ImportToggleField
									className="ms-4"
									disabled={!snapshot.surfacesInstances}
									label={
										<>
											Surface Integrations
											<InlineHelpIcon className="ms-1">The configured surface integrations</InlineHelpIcon>
										</>
									}
								/>
							)}
						</form.AppField>
					</div>
					<div className="ms-2">
						<form.AppField name="surfaces.remote">
							{(field) => (
								<field.ImportToggleField
									className="ms-4"
									disabled={!snapshot.surfacesRemote}
									label={
										<>
											Remote Surfaces
											<InlineHelpIcon className="ms-1">
												Connections for surfaces that are connected remotely
											</InlineHelpIcon>
										</>
									}
								/>
							)}
						</form.AppField>
					</div>

					<div className="ms-2">
						<form.AppField name="imageLibrary">
							{(field) => <field.ImportToggleField label="Image Library" disabled={!snapshot.imageLibrary} />}
						</form.AppField>
					</div>

					{/* <div className="ms-2">
								<form.AppField name="userconfig">
									{(field) => <field.ImportToggleField label="Settings" disabled={!snapshot.userconfig} />}
								</form.AppField>
							</div> */}

					<StaticAlert color="info" className="mt-3">
						<FontAwesomeIcon icon={faPlug} /> All connections will be imported, as they are required to be able to
						import any actions and feedbacks.
					</StaticAlert>

					<CCallout color="success">
						<h5>Import, Resetting only Selected Components</h5>
						<p>
							This option resets <strong>only</strong> the selected components before importing them.
							<br /> Choosing this option will preserve your <a href="settings">Settings</a> page configurations.
						</p>
						<form.Subscribe selector={(form) => [form.values]}>
							{([values]) => {
								const anythingEnabled = isAnythingEnabled(sanitiseSelection(values, snapshot, false))
								return (
									<>
										<Button
											color="success"
											type="submit"
											disabled={!anythingEnabled}
											onClick={() => {
												form.handleSubmit({ fullReset: false }).catch((err) => {
													console.error('Form submission error', err)
												})
											}}
										>
											<FontAwesomeIcon icon={faFileImport} /> Import Preserving Unselected
										</Button>
									</>
								)
							}}
						</form.Subscribe>
					</CCallout>
					<CCallout color="danger">
						<h5>Full Reset & Import</h5>
						<p>
							This option will reset <strong>all</strong> components, including <a href="settings">Settings</a>, before
							importing the selected ones.
							<br />
							Full reset is generally the safer option when some items are deselected, as it reduces the chance of
							producing an inconsistent setup.
						</p>
						<form.Subscribe selector={(form) => [form.values]}>
							{([values]) => {
								const anythingEnabled = isAnythingEnabled(sanitiseSelection(values, snapshot, false))
								return (
									<Button
										color="primary"
										type="submit"
										disabled={!anythingEnabled}
										onClick={() => {
											// override default specified in onSubmitMeta
											form.handleSubmit({ fullReset: true }).catch((err) => {
												console.error('Form submission error', err)
											})
										}}
									>
										<FontAwesomeIcon icon={faFileImport} /> Full Reset & Import
									</Button>
								)
							}}
						</form.Subscribe>
					</CCallout>
				</form>
			</form.AppForm>
		</>
	)
}

interface ImportToggleFieldProps {
	label: string | React.ReactNode
	disabled: boolean
	className?: string
}
function ImportToggleField({ label, disabled, className }: ImportToggleFieldProps) {
	const field = useFieldContext<ImportOrResetType>()

	return (
		<CheckboxInputFieldWithLabel
			className={className}
			disabled={disabled}
			value={field.state.value !== 'unchanged' && !disabled}
			setValue={(val) => field.handleChange(val ? 'reset-and-import' : 'unchanged')}
			onBlur={field.handleBlur}
			label={label}
		/>
	)
}
interface ImportToggleGroupProps {
	label: string
	disabled: boolean
	defaultChecked: Record<string, ImportOrResetType>
	defaultUnchecked: Record<string, ImportOrResetType>
}
function ImportToggleGroup({ label, disabled, defaultChecked, defaultUnchecked }: ImportToggleGroupProps) {
	const field = useFieldContext<Record<string, ImportOrResetType>>()

	const isAChildChecked = !!field.state.value && Object.values(field.state.value).some((v) => v !== 'unchanged')
	const isAChildUnchecked = !!field.state.value && Object.values(field.state.value).some((v) => v === 'unchanged')

	return (
		<CheckboxInputFieldWithLabel
			disabled={disabled}
			indeterminate={isAChildChecked && isAChildUnchecked}
			value={isAChildChecked && !disabled}
			setValue={(val) => field.handleChange(val ? defaultChecked : defaultUnchecked)}
			onBlur={field.handleBlur}
			label={label}
		/>
	)
}

function isAnythingEnabled(values: ClientImportSelection): boolean {
	for (const key in values) {
		const v = values[key as keyof ClientImportSelection]
		if (typeof v === 'string') {
			if (v !== 'unchanged') {
				return true
			}
		} else if (typeof v === 'object' && v !== null) {
			// Nested object (e.g., surfaces)
			for (const subKey in v) {
				if (v[subKey as keyof typeof v] !== 'unchanged') {
					return true
				}
			}
		}
	}
	return false
}

function sanitiseSelection(
	values: ClientImportSelection,
	snapshot: ClientImportObject,
	fullReset: boolean
): ClientImportOrResetSelection {
	const defaultBehaviour: ImportOrResetType = fullReset ? 'reset' : 'unchanged'

	const processValue = (snapshotIncluded: boolean, value: ImportOrResetType): ImportOrResetType =>
		snapshotIncluded && value === 'reset-and-import' ? value : defaultBehaviour

	return {
		buttons: processValue(snapshot.buttons, values.buttons),
		surfaces: {
			known: processValue(snapshot.surfacesKnown, values.surfaces.known),
			instances: processValue(snapshot.surfacesInstances, values.surfaces.instances),
			remote: processValue(snapshot.surfacesRemote, values.surfaces.remote),
		},
		triggers: processValue(!!snapshot.triggers, values.triggers),
		customVariables: processValue(snapshot.customVariables, values.customVariables),
		expressionVariables: processValue(snapshot.expressionVariables, values.expressionVariables),
		imageLibrary: processValue(snapshot.imageLibrary, values.imageLibrary),

		// These are not user selectable, so simply vary depending on whether this is a full reset or not
		connections: defaultBehaviour,
		userconfig: defaultBehaviour,
	}
}
