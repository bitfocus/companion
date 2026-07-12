import { faCheck, faCircleExclamation, faGear } from '@fortawesome/free-solid-svg-icons'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
import { capitalize } from 'lodash-es'
import { observable } from 'mobx'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useId, useMemo, useState } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { ClientInstanceConfigBase, InstanceVersionUpdatePolicy } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { DismissableAlert, StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
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

	return (
		<>
			<Form
				className="secondary-panel-simple-body d-flex flex-column pb-0"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					performSave()
				}}
			>
				<div className="flex-fill">
					<div className="row edit-connection">
						{saveError && (
							<Grid.Col className="fieldtype-textinput" sm={12}>
								<StaticAlert color="danger">{saveError}</StaticAlert>
							</Grid.Col>
						)}

						<InstanceLabelInputField panelStore={panelStore} />
						<InstanceEnabledInputField panelStore={panelStore} cannotEnableReason={cannotEnableReason} />

						<InstanceModuleVersionInputField
							panelStore={panelStore}
							moduleInfo={moduleInfo}
							changeModuleDangerMessage={changeModuleDangerMessage}
						/>

						<InstanceVersionUpdatePolicyInputField panelStore={panelStore} />

						<InstanceConfigArea panelStore={panelStore} />
					</div>
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
		<>
			<FormLabel htmlFor={labelId} className="col-sm-4 col-form-label col-form-label-sm">
				Label
			</FormLabel>
			<Grid.Col className={`fieldtype-textinput`} sm={8}>
				<TextInputFieldSimple
					id={labelId}
					setValue={panelStore.setLabelValue}
					checkValid={panelStore.checkLabelIsValid}
					value={panelStore.labelValue}
					immediateValue
				/>
			</Grid.Col>
		</>
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
		<>
			<FormLabel htmlFor={moduleVersionId} className="col-sm-4 col-form-label col-form-label-sm">
				Module Version
			</FormLabel>
			<Grid.Col className={`fieldtype-textinput`} sm={8}>
				<div className="d-flex align-items-center gap-2">
					<span className="fw-medium">{moduleVersion?.displayName ?? panelStore.instanceInfo.moduleVersionId}</span>

					<InstanceVersionChangeButton
						id={moduleVersionId}
						service={panelStore.service}
						currentModuleId={panelStore.instanceInfo.moduleId}
						currentVersionId={panelStore.instanceInfo.moduleVersionId}
						changeModuleDangerMessage={changeModuleDangerMessage}
					/>
				</div>
			</Grid.Col>
		</>
	)
})

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
		<>
			<FormLabel htmlFor={enabledId} className="col-sm-4 col-form-label col-form-label-sm">
				Enabled
			</FormLabel>
			<Grid.Col className={`fieldtype-textinput`} sm={8}>
				<SwitchInputField
					id={enabledId}
					value={isEnabled}
					setValue={panelStore.setEnabled}
					disabled={!canToggle}
					tooltip={cannotEnableReason || undefined}
				/>

				{cannotEnableReason && !isEnabled && (
					<div className="text-danger mt-1" style={{ fontSize: '0.875em' }}>
						{cannotEnableReason}
					</div>
				)}
			</Grid.Col>
		</>
	)
})

const UpdatePolicyOptions: DropdownChoice[] = [
	{ id: 'manual', label: 'Disabled' },
	{ id: 'stable', label: 'Stable' },
	{ id: 'beta', label: 'Stable and Beta' },
]

const InstanceVersionUpdatePolicyInputField = observer(function InstanceVersionUpdatePolicyInputField<
	TConfig extends ClientInstanceConfigBase,
>({ panelStore }: { panelStore: InstanceEditPanelStore<TConfig> }): React.JSX.Element {
	const updatePolicyId = useId()

	return (
		<>
			<FormLabel htmlFor={updatePolicyId} className="col-sm-4 col-form-label col-form-label-sm">
				Update Policy
				<InlineHelpIcon className="ms-1">
					How to check whether there are updates available for this {panelStore.service.moduleTypeDisplayName}
				</InlineHelpIcon>
			</FormLabel>
			<Grid.Col className={`fieldtype-textinput`} sm={8}>
				<SimpleDropdownInputField
					id={updatePolicyId}
					value={panelStore.updatePolicy}
					setValue={(value) => panelStore.setUpdatePolicy(value as InstanceVersionUpdatePolicy)}
					choices={UpdatePolicyOptions}
				/>
			</Grid.Col>
		</>
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
			<Grid.Col xs={12}>
				<NonIdealState icon={faCircleExclamation}>
					{panelStore.loadError}
					<br />
					Please check the logs for more information.
				</NonIdealState>
			</Grid.Col>
		)
	}

	// Crashed and not running
	if (panelStore.notRunningReason === 'crashed') {
		return (
			<Grid.Col xs={12}>
				<NonIdealState icon={faCircleExclamation}>
					{displayName} is not running.
					<br />
					Please check the logs for more information.
				</NonIdealState>
			</Grid.Col>
		)
	}

	// Disabled (directly or via its collection), so there is nothing running to configure
	if (panelStore.notRunningReason === 'disabled' || panelStore.notRunningReason === 'missing') {
		return (
			<Grid.Col xs={12}>
				<NonIdealState icon={faGear}>
					<p>{displayName} configuration cannot be edited while it is not running. The fields above can be edited.</p>
				</NonIdealState>
			</Grid.Col>
		)
	}

	// Still starting up / waiting for the config fields
	if (panelStore.isLoading || panelStore.configAndSecrets === null) {
		return (
			<Grid.Col xs={12}>
				<LoadingRetryOrError error={null} dataReady={false} design="pulse" />
			</Grid.Col>
		)
	}

	return (
		<>
			{panelStore.externalChangeWarning && (
				<Grid.Col xs={12}>
					<DismissableAlert color="warning" onClose={panelStore.dismissExternalChangeWarning}>
						This {panelStore.service.moduleTypeDisplayName}'s configuration was changed elsewhere. Your unsaved changes
						have been kept.
					</DismissableAlert>
				</Grid.Col>
			)}
			<InstanceConfigFields panelStore={panelStore} />
		</>
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
			<NonIdealState icon={faCheck}>
				{capitalize(panelStore.service.moduleTypeDisplayName)} has no configuration
			</NonIdealState>
		)
	}

	return (
		<>
			<hr className="my-3" />
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
						{fieldInfo.description && <div className="form-text">{fieldInfo.description}</div>}
					</InstanceFormRow>
				)
			})}
		</>
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

	const doDelete = useCallback(() => panelStore.service.deleteInstance(panelStore.labelValue), [panelStore])

	return (
		<div className="row connection-form-buttons border-top">
			<Grid.Col sm={12}>
				<div className="flex flex-row">
					<div className="grow">
						<Button
							color="success"
							className="me-md-1"
							disabled={isLoading || isSaving || !isValid || !panelStore.isDirty()}
							type="submit"
							title={!isValid ? 'Please fix the errors before saving' : undefined}
						>
							Save {isSaving ? '...' : ''}
						</Button>

						<Button color="secondary" onClick={panelStore.service.closePanel} disabled={isSaving || isLoading}>
							{panelStore.isDirty() ? 'Cancel' : 'Done'}
						</Button>
					</div>

					<div>
						<Button color="danger" onClick={doDelete} disabled={isSaving || isLoading}>
							Delete
						</Button>
					</div>
				</div>
			</Grid.Col>
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
	if (useNewLayout) {
		if (fieldInfo.type === 'static-text') {
			if (!fieldInfo.label && !fieldInfo.value) return null // Skip rendering the fields used to force alignment

			const fieldValueStr = fieldInfo.value?.toString() ?? ''
			const isLong = fieldValueStr.includes('\n') || fieldValueStr.length > 100 // Arbitrary length to consider text "long"

			if (isLong && (!fieldInfo.width || fieldInfo.width > 6)) {
				return (
					<Grid.Col sm={12}>
						{fieldInfo.label ? <FormLabel htmlFor={inputId}>{fieldInfo.label}</FormLabel> : ''}
						<StaticTextFieldText {...fieldInfo} id={inputId} allowImages />
					</Grid.Col>
				)
			}
		}

		return (
			<React.Fragment>
				<FormLabel
					htmlFor={inputId}
					className="col-sm-4 col-form-label col-form-label-sm"
					style={{ display: !isVisible ? 'none' : undefined }}
				>
					<InstanceFieldLabel fieldInfo={fieldInfo} />
				</FormLabel>
				<Grid.Col sm={8} style={{ display: !isVisible ? 'none' : undefined }} className="align-self-center">
					{children}
				</Grid.Col>
			</React.Fragment>
		)
	} else {
		// Hide certain fields when in 'xs' column size, to avoid unexpected padding
		const hideInXs = fieldInfo.type === 'static-text' && !fieldInfo.label && !fieldInfo.value

		return (
			<Grid.Col
				className={classNames(`fieldtype-${fieldInfo.type}`, { 'd-none': hideInXs, 'd-sm-block': hideInXs })}
				sm={fieldInfo.width}
				style={{ display: !isVisible ? 'none' : undefined }}
			>
				<FormLabel htmlFor={inputId}>
					<InstanceFieldLabel fieldInfo={fieldInfo} />
				</FormLabel>

				{children}
			</Grid.Col>
		)
	}
})
