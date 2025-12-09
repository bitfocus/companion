import React, { useCallback, useContext, useRef, useState } from 'react'
import {
	CAlert,
	CButton,
	CCol,
	CForm,
	CFormLabel,
	CFormSelect,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CModalExt } from '~/Components/CModalExt.js'
import { useForm } from '@tanstack/react-form'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useAllConnectionProducts } from '~/Hooks/useFilteredProducts.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { DropdownChoice } from '@companion-module/base'
import { useComputed } from '~/Resources/util.js'
import { useConnectionVersionSelectOptions } from './useConnectionVersionSelectOptions.js'
import { ModuleVersionsRefresh } from '../ModuleVersionsRefresh.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface ConnectionForceVersionButtonProps {
	connectionId: string
	disabled: boolean
	currentModuleId: string
	currentVersionId: string | null
}

export function ConnectionForceVersionButton({
	connectionId,
	disabled,
	currentModuleId,
	currentVersionId,
}: ConnectionForceVersionButtonProps): React.JSX.Element {
	const { modules } = useContext(RootAppStoreContext)

	const [show, setShow] = useState(false)

	const buttonRef = useRef<HTMLButtonElement>(null)
	const buttonFocus = () => {
		buttonRef.current?.focus()
	}

	const setModuleAndVersionMutation = useMutationExt(trpc.connections.setModuleAndVersion.mutationOptions())

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
		setSaveError(null)
		setShow(true)
	}, [form])
	const doClose = useCallback(() => setShow(false), [setShow])
	const onClosed = useCallback(() => {
		form.reset()
		setSaveError(null)
	}, [form])

	return (
		<>
			<CButton
				color="light"
				title={'Force edit module and version'}
				className={disabled ? 'disabled with-tooltip' : ''}
				onClick={!disabled ? doShow : undefined}
			>
				<FontAwesomeIcon icon={faCog} />
			</CButton>
			{!disabled && (
				<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
					<CModalHeader closeButton>
						<h5>Change connection type</h5>
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
								Companion will help ensure you are using the latest version of modules. But sometimes you may need to
								force a connection to be using a different module manually.
								<CAlert color="danger" className="mt-2 mb-0">
									This can break the connection and corrupt any existing actions and feedbacks. Only use this if you are
									sure of what you are doing.
								</CAlert>
								{!!saveError && (
									<CAlert color="warning" className="mt-2 mb-0">
										Save failed: {saveError}
									</CAlert>
								)}
							</CCol>

							<form.Field
								name="moduleId"
								children={(field) => (
									<>
										<CFormLabel htmlFor={field.name} className="col-sm-3 col-form-label col-form-label-sm">
											Module
										</CFormLabel>
										<CCol sm={9}>
											<SelectedModuleDropdown
												htmlName={field.name}
												value={field.state.value}
												onChange={(val) => {
													field.handleChange(val)
													form.setFieldValue('versionId', null)
												}}
												onBlur={field.handleBlur}
											/>
										</CCol>
										{/* <FieldInfo field={field} /> */}
									</>
								)}
							/>

							<form.Field
								name="versionId"
								children={(field) => (
									<>
										<CFormLabel htmlFor="colFormExecuteWhileHeld" className="col-sm-3 col-form-label col-form-label-sm">
											Version
											{!!modules.storeList.get(form.state.values.moduleId) && (
												<ModuleVersionsRefresh moduleId={form.state.values.moduleId} />
											)}
										</CFormLabel>
										<CCol sm={9}>
											<SelectedVersionDropdown
												moduleId={form.state.values.moduleId}
												htmlName={field.name}
												value={field.state.value}
												onChange={field.handleChange}
												onBlur={field.handleBlur}
											/>
										</CCol>
									</>
								)}
							/>
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
			)}
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

	const allProducts = useAllConnectionProducts(modules)
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
	const { choices: moduleVersionChoices, loaded: choicesLoaded } = useConnectionVersionSelectOptions(
		moduleId,
		moduleInfo,
		true
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
