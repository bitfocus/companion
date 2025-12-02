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
	},
	triggers: 'reset-and-import',
	customVariables: 'reset-and-import',
	expressionVariables: 'reset-and-import',
}

const { fieldContext, useFieldContext, formContext } = createFormHookContexts()

const importFormOpts = formOptions({
	defaultValues: defaultFullImportConfig,
})

const { useAppForm } = createFormHook({
	fieldComponents: {
		ImportToggleField,
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
		onSubmit: async ({ value }) => {
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

	const [fullReset, setFullReset] = useState(true)

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
						form.handleSubmit().catch((err) => {
							console.error('Form submission error', err)
						})
					}}
				>
					<table className="table table-responsive-sm mb-3">
						<thead>
							<tr>
								<th>Import</th>
							</tr>
						</thead>
						<tbody>
							{/* <tr>
								<td className="compact">
									<form.AppField name="connections">
										{(field) => <field.ImportToggleField label="Connections" disabled={!snapshot.connections} />}
									</form.AppField>
									{!config.connections && (config.buttons || config.triggers) && (
										<CAlert color="warning">
											Any 'Connections' referenced by an action or feedback will still be imported, but it  will remove all actions, feedbacks, and triggers associated with the connections even
											if 'Buttons' and/or 'Triggers' are not also reset.
										</CAlert>
									)}
								</td>
							</tr> */}

							<tr>
								<td className="compact">
									<form.AppField name="buttons">
										{(field) => <field.ImportToggleField label="Buttons" disabled={!snapshot.buttons} />}
									</form.AppField>
								</td>
							</tr>
							<tr>
								<td className="compact">
									<form.AppField name="triggers">
										{(field) => <field.ImportToggleField label="Triggers" disabled={!snapshot.triggers} />}
									</form.AppField>
								</td>
							</tr>
							<tr>
								<td className="compact">
									<form.AppField name="customVariables">
										{(field) => (
											<field.ImportToggleField label="Custom Variables" disabled={!snapshot.customVariables} />
										)}
									</form.AppField>
								</td>
							</tr>
							<tr>
								<td className="compact">
									<form.AppField name="expressionVariables">
										{(field) => (
											<field.ImportToggleField label="Expression Variables" disabled={!snapshot.expressionVariables} />
										)}
									</form.AppField>
								</td>
							</tr>
							<tr>
								<td className="compact">
									<form.AppField name="surfaces.known">
										{(field) => <field.ImportToggleField label="Surfaces" disabled={!snapshot.surfaces} />}
									</form.AppField>
								</td>
							</tr>

							{/* <tr>
								<td className="compact">
									<form.AppField name="userconfig">
										{(field) => <field.ImportToggleField label="Settings" disabled={!snapshot.userconfig} />}
									</form.AppField>
								</td>
							</tr> */}
						</tbody>
					</table>
					<CAlert color="info" className="margin-top">
						<FontAwesomeIcon icon={faPlug} /> All connections will be imported, as they are required to be able to
						import any actions and feedbacks.
					</CAlert>

					<CCallout color="success">
						<h5>Import Selected Components</h5>
						<p>
							Full Import always resets the selected components before importing them. <br />
							Checking{' '}
							<em>
								<strong>Perform full reset</strong>
							</em>{' '}
							will reset <strong>all</strong> components before importing the selected ones.
							<br />
							Full reset is generally the safer option as it reduces the chance of producing an inconsistent setup.
						</p>
						<form.Subscribe selector={(form) => [form.values]}>
							{([values]) => {
								const anythingEnabled = isAnythingEnabled(sanitiseSelection(values, snapshot, false))
								return (
									<CButton color={fullReset ? 'danger' : 'success'} type="submit" disabled={!anythingEnabled}>
										<FontAwesomeIcon icon={faFileImport} /> Import Selected Components
									</CButton>
								)
							}}
						</form.Subscribe>
						<CFormCheck
							id={'check_full_reset'}
							label={'Perform full reset'}
							checked={fullReset}
							onChange={() => setFullReset((fullReset) => !fullReset)}
							inline
							style={{ marginLeft: '1em' }}
						/>
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
			known: processValue(snapshot.surfaces, values.surfaces.known),
		},
		triggers: processValue(!!snapshot.triggers, values.triggers),
		customVariables: processValue(snapshot.customVariables, values.customVariables),
		expressionVariables: processValue(snapshot.expressionVariables, values.expressionVariables),

		// These are not user selectable, so simply vary depending on whether this is a full reset or not
		connections: defaultBehaviour,
		userconfig: defaultBehaviour,
	}
}
