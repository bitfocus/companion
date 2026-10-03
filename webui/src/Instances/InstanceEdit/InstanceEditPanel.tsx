import './InstanceEditPanel.css'
import {
	faArrowsRotate,
	faCircleCheck,
	faCircleExclamation,
	faFlask,
	faLock,
	faPowerOff,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
import { observable } from 'mobx'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useEffect, useId, useMemo, useState } from 'react'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type ClientInstanceConfigBase,
} from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { DismissableAlert, StaticAlert } from '~/Components/Alert.js'
import { Badge } from '~/Components/Badge'
import { Button } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { StaticTextFieldText } from '~/Controls/StaticTextField.js'
import { InstanceEditField } from '~/Instances/InstanceEdit/InstanceEditField.js'
import type { InstanceEditPanelService } from '~/Instances/InstanceEdit/InstanceEditPanelService.js'
import { InstanceEditPanelStore, isConfigFieldSecret } from '~/Instances/InstanceEdit/InstanceEditPanelStore.js'
import { InstanceSecretField } from '~/Instances/InstanceEdit/InstanceSecretField.js'
import { getModuleVersionInfo } from '~/Instances/Util.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { InstanceVersionChangeButton } from '../../Instances/InstanceEdit/InstanceVersionChangeButton.js'

interface InstanceGenericEditPanelProps<TConfig extends ClientInstanceConfigBase> {
	instanceInfo: TConfig
	service: InstanceEditPanelService<TConfig>
	changeModuleDangerMessage: React.ReactNode
	cannotEnableReason?: string | null
}

export const InstanceGenericEditPanel = observer(function InstanceGenericEditPanel<
	TConfig extends ClientInstanceConfigBase,
>({ instanceInfo, service, changeModuleDangerMessage, cannotEnableReason }: InstanceGenericEditPanelProps<TConfig>) {
	const { modules } = useContext(RootAppStoreContext)

	const panelStore = useMemo(() => new InstanceEditPanelStore(service, instanceInfo), [service, instanceInfo])

	// A single subscription drives the config-fields editor: the backend reports the current state
	// (loading / running-with-config / not-running / error) whenever anything relevant changes.
	useSubscription(
		service.watchConfig({
			onStarted: () => panelStore.applyState(null),
			onData: (state) => panelStore.applyState(state),
			onError: (error) => {
				console.error('Error in instance config subscription', error)
				panelStore.applyState({ type: 'error', message: 'Lost connection to the configuration' })
			},
		})
	)

	const moduleInfo = modules.getModuleInfo(panelStore.instanceInfo.moduleType, panelStore.instanceInfo.moduleId)

	const isSaving = observable.box(false)
	const [saveError, setSaveError] = useState<string | null>(null)
	const performSave = useCallback(() => {
		if (isSaving.get()) return
		setSaveError(null)

		// Bail early if the form is not dirty
		if (!panelStore.isDirty()) return

		isSaving.set(true)

		Promise.resolve()
			.then(async () => {
				const error = await service.saveConfig(panelStore)

				setSaveError(error)
				isSaving.set(false)
			})
			.catch((error) => {
				isSaving.set(false)
				setSaveError(`Failed to save ${capitalize(service.moduleTypeDisplayName)}: ${error.message || error}`)
				console.error('Failed to save instance:', error)
			})
	}, [service, panelStore, isSaving])

	// Cmd+S / Ctrl+S keyboard shortcut to save
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 's') {
				e.preventDefault()
				performSave()
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [performSave])

	return (
		<>
			<Form
				className="edit-panel instance-edit-panel flex flex-col flex-1 min-h-0 overflow-hidden relative"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					performSave()
				}}
			>
				<div className="page-scroll edit-panel-scroll">
					{saveError && (
						<StaticAlert color="danger" className="mb-4">
							{saveError}
						</StaticAlert>
					)}

					{/* General Settings */}
					<EditSectionCard title="General Settings">
						<InstanceLabelInputField panelStore={panelStore} />
						<InstanceModuleVersionInputField
							panelStore={panelStore}
							moduleInfo={moduleInfo}
							changeModuleDangerMessage={changeModuleDangerMessage}
						/>
						<InstanceEnabledInputField panelStore={panelStore} cannotEnableReason={cannotEnableReason} />
					</EditSectionCard>

					{/* Dynamic Device Config */}
					<InstanceConfigArea panelStore={panelStore} />

					{/* Danger Zone */}
					<DangerZoneSection panelStore={panelStore} isSaving={isSaving.get()} />
				</div>

				<InstanceFormButtons panelStore={panelStore} isSaving={isSaving.get()} />
			</Form>
		</>
	)
})

function InstanceFieldLabel({ fieldInfo }: { fieldInfo: SomeCompanionInputField }) {
	return (
		<>
			{fieldInfo.label}
			{fieldInfo.tooltip && <InlineHelpIcon className="ms-1">{fieldInfo.tooltip}</InlineHelpIcon>}
		</>
	)
}

const InstanceLabelInputField = observer(function InstanceLabelInputField<TConfig extends ClientInstanceConfigBase>({
	panelStore,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
}): React.JSX.Element {
	const labelId = useId()

	return (
		<div className="edit-field-row">
			<label htmlFor={labelId} className="text-xs font-semibold text-body">
				Label
			</label>
			<TextInputFieldSimple
				id={labelId}
				setValue={panelStore.setLabelValue}
				checkValid={panelStore.checkLabelIsValid}
				value={panelStore.labelValue}
				immediateValue
			/>
		</div>
	)
})

const InstanceModuleVersionInputField = observer(function InstanceModuleVersionInputField<
	TConfig extends ClientInstanceConfigBase,
>({
	panelStore,
	moduleInfo,
	changeModuleDangerMessage,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
	moduleInfo: ClientModuleInfo | undefined
	changeModuleDangerMessage: React.ReactNode
}): React.JSX.Element {
	const moduleVersionId = useId()

	const moduleVersion = getModuleVersionInfo(moduleInfo, panelStore.instanceInfo.moduleVersionId)

	return (
		<div className="edit-field-row">
			<label htmlFor={moduleVersionId} className="text-xs font-semibold text-body">
				Module Version
			</label>
			<div className="instance-module-version-row">
				<span className="instance-module-version-value text-xs font-mono font-medium text-body">
					{moduleVersion?.displayName ?? panelStore.instanceInfo.moduleVersionId}
				</span>
				<UpdatePolicyLabel policy={panelStore.updatePolicy} />

				<InstanceVersionChangeButton
					id={moduleVersionId}
					service={panelStore.service}
					currentModuleId={panelStore.instanceInfo.moduleId}
					currentVersionId={panelStore.instanceInfo.moduleVersionId}
					currentUpdatePolicy={panelStore.updatePolicy}
					changeModuleDangerMessage={changeModuleDangerMessage}
				/>
			</div>
		</div>
	)
})

function UpdatePolicyLabel({ policy }: { policy: InstanceVersionUpdatePolicy }): React.JSX.Element {
	const [icon, label] =
		policy === InstanceVersionUpdatePolicy.Manual
			? [faLock, 'Manual updates']
			: policy === InstanceVersionUpdatePolicy.Stable
				? [faArrowsRotate, 'Stable updates']
				: [faFlask, 'Stable + Beta']

	return (
		<Badge
			tone="neutral"
			className="instance-update-policy"
			indicator={<FontAwesomeIcon icon={icon} className="text-3xs shrink-0" aria-hidden="true" />}
		>
			{label}
		</Badge>
	)
}

const InstanceEnabledInputField = observer(function InstanceEnabledInputField<
	TConfig extends ClientInstanceConfigBase,
>({
	panelStore,
	cannotEnableReason,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
	cannotEnableReason?: string | null
}): React.JSX.Element {
	const enabledId = useId()

	const isEnabled = panelStore.enabled
	const canToggle = !cannotEnableReason || isEnabled

	return (
		<div className="edit-field-row">
			<label htmlFor={enabledId} className="text-xs font-semibold text-body mb-0">
				Enabled
			</label>
			<div className="shrink-0">
				<SwitchInputField
					id={enabledId}
					value={isEnabled}
					setValue={panelStore.setEnabled}
					disabled={!canToggle}
					tooltip={cannotEnableReason || undefined}
				/>
			</div>
			{cannotEnableReason && !isEnabled && (
				<div className="edit-field-help text-danger text-xs">{cannotEnableReason}</div>
			)}
		</div>
	)
})

const DangerZoneSection = observer(function DangerZoneSection<TConfig extends ClientInstanceConfigBase>({
	panelStore,
	isSaving,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
	isSaving: boolean
}): React.JSX.Element {
	const doDelete = useCallback(() => panelStore.service.deleteInstance(panelStore.labelValue), [panelStore])

	return (
		<EditSectionCard title={`Delete ${panelStore.service.moduleTypeDisplayName}`} collapsible danger>
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-xs text-muted mb-0">
						{panelStore.service.moduleType === ModuleInstanceType.Surface
							? 'Delete this surface integration. Its surfaces will disconnect, and any remote surfaces added through it will be removed.'
							: `Delete this ${panelStore.service.moduleTypeDisplayName} and remove its associated actions and feedbacks.`}
					</p>
				</div>
				<Button color="danger" size="sm" onClick={doDelete} disabled={isSaving || panelStore.isLoading}>
					Delete
				</Button>
			</div>
		</EditSectionCard>
	)
})

/**
 * Renders the config-fields area for an instance, driven entirely by the state reported by the config
 * subscription (disabled / loading / running-with-config / crashed / error).
 */
const InstanceConfigArea = observer(function InstanceConfigArea<TConfig extends ClientInstanceConfigBase>({
	panelStore,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
}): React.JSX.Element {
	const displayName = capitalize(panelStore.service.moduleTypeDisplayName)

	// A terminal failure (e.g. incompatible module version) - show the reported reason
	if (panelStore.loadError) {
		return (
			<EditSectionCard title="Configuration">
				<NonIdealState icon={faCircleExclamation}>
					{panelStore.loadError}
					<br />
					Please check the logs for more information.
				</NonIdealState>
			</EditSectionCard>
		)
	}

	// Crashed and not running
	if (panelStore.notRunningReason === 'crashed') {
		return (
			<EditSectionCard title="Configuration">
				<NonIdealState icon={faCircleExclamation}>
					{displayName} is not running.
					<br />
					Please check the logs for more information.
				</NonIdealState>
			</EditSectionCard>
		)
	}

	// Disabled (directly or via its collection), so there is nothing running to configure
	if (panelStore.notRunningReason === 'disabled' || panelStore.notRunningReason === 'missing') {
		return (
			<EditSectionCard title="Configuration">
				<div className="edit-note">
					<FontAwesomeIcon icon={faPowerOff} className="edit-note-icon" />
					Enable this {panelStore.service.moduleTypeDisplayName} to edit its configuration
				</div>
			</EditSectionCard>
		)
	}

	// Still starting up / waiting for the config fields
	if (panelStore.isLoading || panelStore.configAndSecrets === null) {
		return (
			<EditSectionCard title="Configuration">
				<LoadingRetryOrError error={null} dataReady={false} design="pulse" />
			</EditSectionCard>
		)
	}

	return (
		<EditSectionCard title="Configuration">
			{panelStore.externalChangeWarning && (
				<DismissableAlert color="warning" onClose={panelStore.dismissExternalChangeWarning} className="mb-3">
					This {panelStore.service.moduleTypeDisplayName}'s configuration was changed elsewhere. Your unsaved changes
					have been kept.
				</DismissableAlert>
			)}
			<InstanceConfigFields panelStore={panelStore} />
		</EditSectionCard>
	)
})

const InstanceConfigFields = observer(function InstanceConfigFields<TConfig extends ClientInstanceConfigBase>({
	panelStore,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
}): React.JSX.Element {
	const idPrefix = useId()

	const configData = panelStore.configAndSecrets

	if (!configData) {
		return <NonIdealState icon={faCircleExclamation}>No config data loaded</NonIdealState>
	}

	if (configData.fields.length === 0) {
		return (
			<div className="edit-note">
				<FontAwesomeIcon icon={faCircleCheck} className="edit-note-icon edit-note-icon-good" />
				This {panelStore.service.moduleTypeDisplayName} requires no configuration
			</div>
		)
	}

	return (
		<div className={classNames('row edit-connection', configData.useNewLayout && 'instance-edit-horizontal-fields')}>
			{configData.fields.map((fieldInfo) => {
				const isVisible = panelStore.isVisible(fieldInfo)
				if (!isVisible) return null

				const inputId = `${idPrefix}_${fieldInfo.id}`

				const isSecret = isConfigFieldSecret(fieldInfo)
				return (
					<InstanceFormRow
						key={fieldInfo.id}
						inputId={inputId}
						fieldInfo={fieldInfo}
						isVisible={isVisible}
						useNewLayout={configData.useNewLayout}
					>
						{isSecret ? (
							<InstanceSecretField
								inputId={inputId}
								definition={fieldInfo}
								value={configData.secrets[fieldInfo.id]}
								setValue={(value) => panelStore.setConfigValue(fieldInfo.id, value)}
							/>
						) : (
							<InstanceEditField
								inputId={inputId}
								definition={fieldInfo}
								value={configData.config[fieldInfo.id]}
								setValue={(value) => panelStore.setConfigValue(fieldInfo.id, value)}
								moduleType={panelStore.instanceInfo.moduleType}
								instanceId={panelStore.service.instanceId}
							/>
						)}
					</InstanceFormRow>
				)
			})}
		</div>
	)
})

const InstanceFormButtons = observer(function InstanceFormButtons<TConfig extends ClientInstanceConfigBase>({
	panelStore,
	isSaving,
}: {
	panelStore: InstanceEditPanelStore<TConfig>
	isSaving: boolean
}): React.JSX.Element {
	const isValid = panelStore.isValid()
	const isLoading = panelStore.isLoading
	const isDirty = panelStore.isDirty()

	return (
		<div className="shrink-0 bg-surface border-t border-border px-3 py-2 z-10 flex items-center justify-between gap-3">
			<div className="flex items-center gap-2">
				{isDirty ? (
					<Badge tone="warning" className="select-none">
						Unsaved Changes
					</Badge>
				) : (
					<span className="text-xs text-muted select-none">No unsaved changes</span>
				)}
			</div>

			<div className="flex items-center gap-2">
				<Button color="secondary" size="sm" onClick={panelStore.service.closePanel} disabled={isSaving || isLoading}>
					{isDirty ? 'Cancel' : 'Done'}
				</Button>

				<Button
					color="primary"
					size="sm"
					disabled={isLoading || isSaving || !isValid || !isDirty}
					type="submit"
					title={!isValid ? 'Please fix the errors before saving' : 'Save changes (Cmd+S / Ctrl+S)'}
					aria-busy={isSaving}
				>
					{isSaving ? 'Saving...' : 'Save Changes'}
				</Button>
			</div>
		</div>
	)
})

interface InstanceFormRowProps {
	inputId: string
	fieldInfo: SomeCompanionInputField
	isVisible: boolean
	useNewLayout: boolean
}

const InstanceFormRow = observer(function InstanceFormRow({
	inputId,
	fieldInfo,
	isVisible,
	useNewLayout,
	children,
}: React.PropsWithChildren<InstanceFormRowProps>): React.JSX.Element | null {
	const description = fieldInfo.description?.trim() ? (
		<div
			className="form-text instance-config-description"
			style={{ display: !isVisible && useNewLayout ? 'none' : undefined }}
		>
			{fieldInfo.description}
		</div>
	) : null

	if (useNewLayout) {
		if (fieldInfo.type === 'static-text') {
			if (!fieldInfo.label && !fieldInfo.value) return null // Skip rendering the fields used to force alignment

			const fieldValueStr = fieldInfo.value?.toString() ?? ''
			const isLong = fieldValueStr.includes('\n') || fieldValueStr.length > 100 // Arbitrary length to consider text "long"

			if (isLong && (!fieldInfo.width || fieldInfo.width > 6)) {
				return (
					<div className="instance-edit-static-text">
						{fieldInfo.label ? <FormLabel htmlFor={inputId}>{fieldInfo.label}</FormLabel> : ''}
						<StaticTextFieldText {...fieldInfo} id={inputId} allowImages />
					</div>
				)
			}
		}

		return (
			<React.Fragment>
				<FormLabel htmlFor={inputId} style={{ display: !isVisible ? 'none' : undefined }}>
					<InstanceFieldLabel fieldInfo={fieldInfo} />
				</FormLabel>
				<div style={{ display: !isVisible ? 'none' : undefined }} className="self-center">
					{children}
				</div>
				{/* Its own grid row under the control, so the label centres on the control alone */}
				{description}
			</React.Fragment>
		)
	} else {
		// Hide certain fields when in 'xs' column size, to avoid unexpected padding
		const hideInXs = fieldInfo.type === 'static-text' && !fieldInfo.label && !fieldInfo.value

		return (
			<Grid.Col
				className={classNames(`fieldtype-${fieldInfo.type}`, { hidden: hideInXs, 'sm:block': hideInXs })}
				sm={fieldInfo.width}
				style={{ display: !isVisible ? 'none' : undefined }}
			>
				<FormLabel htmlFor={inputId}>
					<InstanceFieldLabel fieldInfo={fieldInfo} />
				</FormLabel>

				{children}
				{description}
			</Grid.Col>
		)
	}
})
