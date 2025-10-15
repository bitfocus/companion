import React, { useCallback, useContext, useRef, useState } from 'react'
import {
	CAlert,
	CButton,
	CCol,
	CCollapse,
	CForm,
	CFormLabel,
	CFormSelect,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CModalExt } from '~/Components/CModalExt.js'
import { useForm } from '@tanstack/react-form'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useAllModuleProducts } from '~/Hooks/useFilteredProducts.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { DropdownChoice } from '@companion-module/base'
import { useComputed } from '~/Resources/util.js'
import { useModuleVersionSelectOptions } from '~/Instances/useModuleVersionSelectOptions.js'
import { ModuleVersionsRefresh } from '~/Instances/ModuleVersionsRefresh.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface ConnectionChangeVersionButtonProps {
	connectionId: string
	currentModuleId: string
	currentVersionId: string | null
	currentVersionLabel: string | null
}

export function ConnectionChangeVersionButton({
	connectionId,
	currentModuleId,
	currentVersionId,
	currentVersionLabel,
}: ConnectionChangeVersionButtonProps): React.JSX.Element {
	const { modules } = useContext(RootAppStoreContext)

	const [show, setShow] = useState(false)
	const [advancedMode, setAdvancedMode] = useState(false)
	const originalModuleIdRef = useRef(currentModuleId) // The moduleId at the time the modal was opened

	const buttonRef = useRef<HTMLButtonElement>(null)
	const buttonFocus = () => {
		buttonRef.current?.focus()
	}

	const setModuleAndVersionMutation = useMutationExt(trpc.instances.connections.setModuleAndVersion.mutationOptions())

	const [saveError, setSaveError] = useState<string | null>(null)
	const form = useForm({
		defaultValues: {
			moduleId: currentModuleId,
			versionId: currentVersionId,
		},
		onSubmit: async ({ value }) => {
			const error = await setModuleAndVersionMutation.mutateAsync({
				connectionId,
				moduleId: value.moduleId,
				versionId: value.versionId,
			})
			if (error) {
				setSaveError(error)
			} else {
				setSaveError(null)
				setShow(false)
			}
		},
	})

	const doShow = useCallback(() => {
		form.reset()
		originalModuleIdRef.current = currentModuleId
		setSaveError(null)
		setAdvancedMode(false)
		setShow(true)
	}, [form, currentModuleId])
	const doClose = useCallback(() => setShow(false), [setShow])
	const onClosed = useCallback(() => {
		form.reset()
		setSaveError(null)
		setAdvancedMode(false)
	}, [form])

	const toggleAdvancedMode = useCallback(() => {
		setAdvancedMode((prev) => {
			const newMode = !prev
			// When toggling back to simple mode, restore the original module
			if (!newMode) {
				form.setFieldValue('moduleId', originalModuleIdRef.current)
				form.setFieldValue('versionId', currentVersionId)
			}
			return newMode
		})
	}, [form, currentVersionId])

	return (
		<>
			<div className="d-flex align-items-center gap-2">
				<span className="fw-medium">{currentVersionLabel}</span>
				<CButton color="light" size="sm" title="Change module version" onClick={doShow}>
					<FontAwesomeIcon icon={faPencil} />
				</CButton>
			</div>
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
				<CModalHeader closeButton>
					<h5>Change Module Version</h5>
				</CModalHeader>
				<CModalBody>
					<CForm
						className="row g-sm-2"
						onSubmit={(e) => {
							e.preventDefault()
							e.stopPropagation()
							form.handleSubmit().catch((err) => {
								console.error('Error submitting form', err)
							})
						}}
					>
						<CCol sm={12}>
							<CAlert color="warning" className="mb-3">
								Be careful when downgrading the module version. Some features may not be available in older versions.
							</CAlert>
							{!!saveError && (
								<CAlert color="danger" className="mb-3">
									Save failed: {saveError}
								</CAlert>
							)}
						</CCol>

						<form.Subscribe
							selector={(state) => [state.values.moduleId, advancedMode] as const}
							children={([selectedModuleId, isAdvanced]) => {
								// In advanced mode, use the selected module from the form. In simple mode, lock to the original module.
								const effectiveModuleId = isAdvanced ? selectedModuleId : originalModuleIdRef.current

								return (
									<form.Field
										name="versionId"
										children={(field) => (
											<>
												<CFormLabel htmlFor={field.name} className="col-sm-3 col-form-label col-form-label-sm">
													Version
													{!!modules.storeList.get(effectiveModuleId) && (
														<ModuleVersionsRefresh modules={modules} moduleId={effectiveModuleId} />
													)}
												</CFormLabel>
												<CCol sm={9}>
													<SelectedVersionDropdown
														moduleId={effectiveModuleId}
														htmlName={field.name}
														value={field.state.value}
														onChange={field.handleChange}
														onBlur={field.handleBlur}
													/>
												</CCol>
											</>
										)}
									/>
								)
							}}
						/>

						<CCol sm={12} className="mt-3 mb-2">
							<hr className="my-2" />
							<CButton color="link" size="sm" onClick={toggleAdvancedMode} className="p-0 text-decoration-none">
								<span className="me-1">{advancedMode ? '▼' : '▶'}</span>
								Advanced Options
							</CButton>
						</CCol>

						<CCollapse visible={advancedMode} className="row g-sm-2 p-0">
							<CCol sm={12}>
								<CAlert color="danger" className="mt-0 mb-3">
									Changing the module type can break the connection and corrupt any existing actions and feedbacks. Only
									use this if you are sure of what you are doing.
								</CAlert>
							</CCol>

							<CFormLabel htmlFor="moduleId" className="col-sm-3 col-form-label col-form-label-sm">
								Module
							</CFormLabel>
							<CCol sm={9}>
								<form.Field
									name="moduleId"
									children={(field) => (
										<SelectedModuleDropdown
											htmlName={field.name}
											value={field.state.value}
											onChange={(val) => {
												field.handleChange(val)
												form.setFieldValue('versionId', null)
											}}
											onBlur={field.handleBlur}
										/>
									)}
								/>
							</CCol>
						</CCollapse>
					</CForm>
				</CModalBody>
				<CModalFooter>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<>
								<CButton color="secondary" onClick={doClose} disabled={!canSubmit}>
									Cancel
								</CButton>
								<CButton
									ref={buttonRef}
									color="primary"
									type="submit"
									disabled={!canSubmit}
									onClick={() => {
										form.handleSubmit().catch((err) => {
											console.error('Error submitting form', err)
										})
									}}
								>
									Save {isSubmitting ? '...' : ''}
								</CButton>
							</>
						)}
					/>
				</CModalFooter>
			</CModalExt>
		</>
	)
}

interface SelectedModuleDropdownProps {
	htmlName: string
	value: string
	onChange: (value: string) => void
	onBlur: () => void
}

const SelectedModuleDropdown = observer(function SelectedModuleDropdown({
	htmlName,
	value,
	onChange,
	onBlur,
}: SelectedModuleDropdownProps) {
	const { modules } = useContext(RootAppStoreContext)

	const allProducts = useAllModuleProducts(modules)
	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []

		// If the current value is missing, add it with some formatting
		const hasCurrent = allProducts.find((p) => p.id === value)
		if (!hasCurrent) choices.push({ id: value, label: `Unknown module: ${value}` })

		// Push all the products. Use an object as an easy way to deduplicate by id
		const choicesObj: Record<string, DropdownChoice> = {}
		for (const product of allProducts) {
			choicesObj[product.id] = { id: product.id, label: product.name }
		}

		return Object.values(choicesObj).sort((a, b) => a.label.localeCompare(b.label))
	}, [allProducts, value])

	return (
		<DropdownInputField
			htmlName={htmlName}
			choices={choices}
			value={value}
			setValue={(value) => onChange(String(value))}
			onBlur={onBlur}
		/>
	)
})

interface SelectedVersionDropdownProps {
	moduleId: string
	htmlName: string
	value: string | null
	onChange: (value: string | null) => void
	onBlur: () => void
}
const SelectedVersionDropdown = observer(function SelectedVersionDropdown({
	moduleId,
	htmlName,
	value,
	onChange,
	onBlur,
}: SelectedVersionDropdownProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.modules.get(moduleId)
	const { choices: moduleVersionChoices, loaded: choicesLoaded } = useModuleVersionSelectOptions(
		modules,
		moduleId,
		moduleInfo,
		false
	)

	return (
		<CFormSelect
			name={htmlName}
			value={value as string}
			onChange={(e) => onChange(e.currentTarget.value)}
			onBlur={onBlur}
		>
			{moduleVersionChoices.map((v) => (
				<option key={v.value} value={v.value}>
					{v.label}
				</option>
			))}
			{!moduleVersionChoices.length && (
				<option value={null as any}>{choicesLoaded ? 'No compatible versions found' : 'Loading...'}</option>
			)}
		</CFormSelect>
	)
})
