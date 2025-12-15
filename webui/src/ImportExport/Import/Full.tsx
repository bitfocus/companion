import React, { useCallback, useContext, useState } from 'react'
import { makeAbsolutePath } from '~/Resources/util.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { CAlert, CButton, CCallout, CFormCheck, CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
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
import { ImportPageWizard } from './Page.js'
import { ImportTriggersTab } from './Triggers.js'
import type {
	ClientImportObject,
	ClientImportOrResetSelection,
	ImportOrResetType,
} from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { createFormHook, createFormHookContexts, formOptions } from '@tanstack/react-form'

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
		<>
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink active={activeTab === 'full'} onClick={() => setActiveTab('full')}>
						<FontAwesomeIcon icon={faGlobe} /> Full Import
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink
						active={activeTab === 'buttons'}
						onClick={() => setActiveTab('buttons')}
						disabled={!snapshot.buttons}
					>
						<FontAwesomeIcon icon={faTh} /> Buttons
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink
						active={activeTab === 'triggers'}
						onClick={() => setActiveTab('triggers')}
						disabled={!snapshot.triggers}
					>
						<FontAwesomeIcon icon={faClock} /> Triggers
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent className="no-height-limit">
				<CTabPane visible={activeTab === 'full'}>
					<MyErrorBoundary>
						<FullImportTab snapshot={snapshot} />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane visible={activeTab === 'buttons'} style={{ height: '100%' }}>
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
				</CTabPane>
				<CTabPane visible={activeTab === 'triggers'}>
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
				</CTabPane>
			</CTabContent>
		</>
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
			} catch (e: any) {
				console.log('import failed', e)
				notifier.show(`Import failed`, `Full import failed with: "${e?.message ?? e}"`, 10000)
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
			<CAlert color="info" className="margin-top">
				<FontAwesomeIcon icon={faCircleInfo} /> Want to import specific buttons or triggers instead? Use the{' '}
				<strong>Buttons</strong> or <strong>Triggers</strong> tabs at the top.
			</CAlert>
			<CCallout color="warning">
				<h5>
					<FontAwesomeIcon icon={faWarning} /> Before You Proceed
				</h5>
				<p>
					It is <strong>highly recommended</strong> to export the current system configuration before performing a full
					import.
				</p>
				<CButton color="warning" href={makeAbsolutePath('/int/export/full')} target="_blank">
					<FontAwesomeIcon icon={faDownload} /> Export Current Configuration
				</CButton>
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

					<div className="ms-4">
						<form.AppField name="surfaces.known">
							{(field) => <field.ImportToggleField label="Known Surfaces" disabled={!snapshot.surfacesKnown} />}
						</form.AppField>
					</div>
					<div className="ms-4">
						<form.AppField name="surfaces.instances">
							{(field) => (
								<field.ImportToggleField label="Surface Integrations" disabled={!snapshot.surfacesInstances} />
							)}
						</form.AppField>
					</div>
					<div className="ms-4">
						<form.AppField name="surfaces.remote">
							{(field) => <field.ImportToggleField label="Remote Surfaces" disabled={!snapshot.surfacesRemote} />}
						</form.AppField>
					</div>

					{/* <div className="ms-2">
								<form.AppField name="userconfig">
									{(field) => <field.ImportToggleField label="Settings" disabled={!snapshot.userconfig} />}
								</form.AppField>
							</div> */}

					<CAlert color="info" className="margin-top">
						<FontAwesomeIcon icon={faPlug} /> All connections will be imported, as they are required to be able to
						import any actions and feedbacks.
					</CAlert>

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
										<CButton
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
										</CButton>
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
									<CButton
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
									</CButton>
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
	label: string
	disabled: boolean
}
function ImportToggleField({ label, disabled }: ImportToggleFieldProps) {
	const field = useFieldContext<ImportOrResetType>()

	return (
		<CFormCheck
			disabled={disabled}
			checked={field.state.value !== 'unchanged'}
			onChange={(e) => field.handleChange(e.currentTarget.checked ? 'reset-and-import' : 'unchanged')}
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
		<CFormCheck
			disabled={disabled}
			indeterminate={isAChildChecked && isAChildUnchecked}
			checked={isAChildChecked}
			onChange={(e) => field.handleChange(e.currentTarget.checked ? defaultChecked : defaultUnchecked)}
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

		// These are not user selectable, so simply vary depending on whether this is a full reset or not
		connections: defaultBehaviour,
		userconfig: defaultBehaviour,
	}
}
