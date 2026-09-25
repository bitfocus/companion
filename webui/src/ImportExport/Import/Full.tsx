import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faClock,
	faDownload,
	faFileImport,
	faGlobe,
	faTh,
	faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFormHook, createFormHookContexts, formOptions } from '@tanstack/react-form'
import { when } from 'mobx'
import { useCallback, useContext, useState } from 'react'
import type {
	ClientImportObject,
	ClientImportOrResetSelection,
	ImportOrResetType,
} from '@companion-app/shared/Model/ImportExport.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { Form } from '~/Components/Form.js'
import { TabArea } from '~/Components/TabArea.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CONFIG_OPTION_META, ConfigOptionRow, CONTENT_OPTION_KEYS, SURFACE_CHILD_OPTIONS } from '../ConfigSelection.js'
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
			<TabArea.List className="mb-4">
				<TabArea.Tab value="full">
					<FontAwesomeIcon icon={faGlobe} className="me-1.5" /> Full Import
				</TabArea.Tab>
				<TabArea.Tab value="buttons" disabled={!snapshot.buttons}>
					<FontAwesomeIcon icon={faTh} className="me-1.5" /> Buttons
				</TabArea.Tab>
				<TabArea.Tab value="triggers" disabled={!snapshot.triggers}>
					<FontAwesomeIcon icon={faClock} className="me-1.5" /> Triggers
				</TabArea.Tab>
			</TabArea.List>

			<TabArea.Panel value="full">
				<MyErrorBoundary>
					<FullImportTab snapshot={snapshot} />
				</MyErrorBoundary>
			</TabArea.Panel>
			<TabArea.Panel value="buttons" style={{ height: '100%' }}>
				<div className="flex flex-col h-full space-y-4">
					<MyErrorBoundary>
						{snapshot.buttons ? (
							<ImportPageWizard
								snapshot={snapshot}
								connectionRemap={connectionRemap}
								setConnectionRemap={setConnectionRemap}
								doImport={doSinglePageImport}
							/>
						) : (
							<div className="text-muted p-4">No button configuration found in this snapshot file.</div>
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
						<div className="text-muted p-4">No trigger configuration found in this snapshot file.</div>
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
	formComponents: {},
	fieldContext,
	formContext,
})

interface FullImportTabProps {
	snapshot: ClientImportObject
}

function FullImportTab({ snapshot }: FullImportTabProps) {
	const { notifier, importTaskStatus } = useContext(RootAppStoreContext)

	const importFullMutation = useMutationExt(trpc.importExport.importFull.mutationOptions())

	const form = useAppForm({
		...importFormOpts,
		onSubmit: async ({ value, meta }) => {
			const fullReset = meta.fullReset
			const submitConfig = sanitiseSelection(value, snapshot, fullReset)

			try {
				const { runId } = await importFullMutation.mutateAsync({
					config: submitConfig,
				})

				// The import runs as a background task on the server; track it via the shared task status
				// rather than holding the RPC open. First wait (bounded) for the run to appear - the server
				// sets it before returning the runId, so this only covers subscription propagation; if it
				// never shows up, the task didn't start as expected.
				try {
					await when(() => importTaskStatus.get()?.runId === runId, { timeout: 10000 })
				} catch {
					notifier.show(`Import failed`, `The import did not start as expected. Please reload and try again.`, 10000)
					return
				}

				// Then wait (unbounded - a large import legitimately takes a while) for it to complete. The
				// run is alive as long as it is the current task; resolve when it completes, or bail if it
				// is replaced/disappears (e.g. the server restarted), reloading to re-sync in that case.
				await when(() => {
					const task = importTaskStatus.get()
					return task?.runId !== runId || task.status === 'completed'
				})

				const task = importTaskStatus.get()
				if (!task || task.runId !== runId || task.status !== 'completed') {
					console.log('lost track of import run, reloading to re-sync')
					window.location.reload()
					return
				}
				if (task.error) {
					notifier.show(`Import failed`, `Full import failed with: "${task.error}"`, 10000)
					return
				}

				window.location.reload()
			} catch (e) {
				console.log('import failed', stringifyError(e))
				notifier.show(`Import failed`, `Full import failed with: "${stringifyError(e, true)}"`, 10000)
			}
		},
	})

	return (
		<div className="space-y-4">
			{/* Pre-Import Safety / Prerequisite Banner */}
			<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between flex-wrap gap-3">
				<div className="flex items-start gap-3 max-w-2xl">
					<FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 text-lg mt-0.5 shrink-0" />
					<div>
						<h5 className="text-sm font-bold text-body mb-0.5">Pre-Import Recommendation</h5>
						<p className="text-xs text-muted leading-relaxed mb-0">
							Importing will overwrite components selected below. We strongly advise taking a backup of your current
							setup first. Note that all connections are automatically imported to ensure actions and feedbacks resolve
							correctly.
						</p>
					</div>
				</div>
				<LinkButtonExternal color="warning" size="sm" href={makeAbsolutePath('/int/export/full')} className="shrink-0">
					<FontAwesomeIcon icon={faDownload} className="me-1.5" /> Quick Backup Current Config
				</LinkButtonExternal>
			</div>

			{/* Components Selection Cards */}
			<div>
				<div className="mb-2">
					<h5 className="text-sm font-bold text-body mb-0.5">Select Components to Import</h5>
					<p className="text-xs text-muted mb-0">Choose which elements to restore from this snapshot.</p>
				</div>

				<form.AppForm>
					<Form
						onSubmit={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
					>
						<div className="config-selection space-y-4 my-3">
							{/* Surfaces Card */}
							<div className="config-selection-section">
								<div className="config-selection-title">Surfaces</div>
								<div className="config-selection-list">
									<form.AppField name="surfaces">
										{(field) => (
											<field.ImportToggleGroup
												icon={CONFIG_OPTION_META.surfaces.icon}
												label="Surfaces"
												disabled={!snapshot.surfacesInstances && !snapshot.surfacesKnown && !snapshot.surfacesRemote}
												defaultChecked={{
													known: 'reset-and-import',
													instances: 'reset-and-import',
													remote: 'reset-and-import',
												}}
												defaultUnchecked={{
													known: 'unchanged',
													instances: 'unchanged',
													remote: 'unchanged',
												}}
											/>
										)}
									</form.AppField>

									{SURFACE_CHILD_OPTIONS.map((opt) => (
										<form.AppField key={opt.key} name={`surfaces.${opt.key}`}>
											{(field) => (
												<ConfigOptionRow
													icon={opt.icon}
													label={opt.label}
													sub
													disabled={
														opt.key === 'known'
															? !snapshot.surfacesKnown
															: opt.key === 'instances'
																? !snapshot.surfacesInstances
																: !snapshot.surfacesRemote
													}
													value={
														field.state.value !== 'unchanged' &&
														(opt.key === 'known'
															? !!snapshot.surfacesKnown
															: opt.key === 'instances'
																? !!snapshot.surfacesInstances
																: !!snapshot.surfacesRemote)
													}
													setValue={(val) => field.handleChange(val ? 'reset-and-import' : 'unchanged')}
													onBlur={field.handleBlur}
												/>
											)}
										</form.AppField>
									))}
								</div>
							</div>

							{/* Content & Variables Card */}
							<div className="config-selection-section">
								<div className="config-selection-title">Content & Variables</div>
								<div className="config-selection-list">
									{CONTENT_OPTION_KEYS.map((key) => {
										const isSnapshotAvailable =
											key === 'buttons'
												? !!snapshot.buttons
												: key === 'triggers'
													? !!snapshot.triggers
													: key === 'customVariables'
														? !!snapshot.customVariables
														: key === 'expressionVariables'
															? !!snapshot.expressionVariables
															: !!snapshot.imageLibrary

										return (
											<form.AppField key={key} name={key}>
												{(field) => <field.ImportToggleField name={key} disabled={!isSnapshotAvailable} />}
											</form.AppField>
										)
									})}
								</div>
							</div>
						</div>

						{/* Action Choice Cards */}
						<div className="space-y-3 pt-2">
							<div className="rounded-xl border border-emerald-500/30 bg-surface p-4 flex flex-col justify-between gap-3 shadow-xs">
								<div>
									<h5 className="text-sm font-bold text-body mb-1">Import, Preserving Unselected Components</h5>
									<p className="text-xs text-muted leading-relaxed mb-0">
										Resets <strong>only</strong> the selected components before importing. Preserves existing{' '}
										<a href="settings" className="text-primary hover:underline">
											Settings
										</a>{' '}
										and components not included in this import.
									</p>
								</div>
								<form.Subscribe selector={(form) => [form.values]}>
									{([values]) => {
										const anythingEnabled = isAnythingEnabled(sanitiseSelection(values, snapshot, false))
										return (
											<div>
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
													<FontAwesomeIcon icon={faFileImport} className="me-1.5" /> Import (Preserve Unselected)
												</Button>
											</div>
										)
									}}
								</form.Subscribe>
							</div>

							<div className="rounded-xl border border-rose-500/30 bg-surface p-4 flex flex-col justify-between gap-3 shadow-xs">
								<div>
									<h5 className="text-sm font-bold text-body mb-1">Full Reset & Import</h5>
									<p className="text-xs text-muted leading-relaxed mb-0">
										Resets <strong>all</strong> components including{' '}
										<a href="settings" className="text-primary hover:underline">
											Settings
										</a>{' '}
										before importing. This ensures a clean slate and avoids potential conflicts with obsolete
										configurations.
									</p>
								</div>
								<form.Subscribe selector={(form) => [form.values]}>
									{([values]) => {
										const anythingEnabled = isAnythingEnabled(sanitiseSelection(values, snapshot, false))
										return (
											<div>
												<Button
													color="danger"
													type="submit"
													disabled={!anythingEnabled}
													onClick={() => {
														form.handleSubmit({ fullReset: true }).catch((err) => {
															console.error('Form submission error', err)
														})
													}}
												>
													<FontAwesomeIcon icon={faFileImport} className="me-1.5" /> Full Reset & Import
												</Button>
											</div>
										)
									}}
								</form.Subscribe>
							</div>
						</div>
					</Form>
				</form.AppForm>
			</div>
		</div>
	)
}

function ImportToggleField({
	name,
	disabled,
	sub,
}: {
	name: (typeof CONTENT_OPTION_KEYS)[number]
	disabled?: boolean
	sub?: boolean
}) {
	const field = useFieldContext<ImportOrResetType>()
	const meta = CONFIG_OPTION_META[name]

	return (
		<ConfigOptionRow
			icon={meta.icon}
			label={meta.label}
			disabled={disabled}
			sub={sub}
			value={field.state.value !== 'unchanged' && !disabled}
			setValue={(val) => field.handleChange(val ? 'reset-and-import' : 'unchanged')}
			onBlur={field.handleBlur}
		/>
	)
}

function ImportToggleGroup({
	icon,
	label,
	disabled,
	defaultChecked,
	defaultUnchecked,
}: {
	icon: IconDefinition
	label: React.ReactNode
	disabled?: boolean
	defaultChecked: Record<string, ImportOrResetType>
	defaultUnchecked: Record<string, ImportOrResetType>
}) {
	const field = useFieldContext<Record<string, ImportOrResetType>>()

	const isAChildChecked = !!field.state.value && Object.values(field.state.value).some((v) => v !== 'unchanged')
	const isAChildUnchecked = !!field.state.value && Object.values(field.state.value).some((v) => v === 'unchanged')

	return (
		<ConfigOptionRow
			icon={icon}
			label={label}
			disabled={disabled}
			indeterminate={isAChildChecked && isAChildUnchecked}
			value={isAChildChecked && !disabled}
			setValue={(val) => field.handleChange(val ? defaultChecked : defaultUnchecked)}
			onBlur={field.handleBlur}
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
