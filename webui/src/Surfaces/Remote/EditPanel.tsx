import React, { useCallback, useContext, useMemo, useState } from 'react'
import { CCol, CFormLabel, CFormText, CButton, CAlert, CFormInput } from '@coreui/react'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { EditPanelConfigField } from '../EditPanelConfigField'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { JsonValue } from 'type-fest'

interface SurfaceEditPanelProps {
	remoteInfo: OutboundSurfaceInfo
}

export const RemoteSurfaceEditPanel = observer<SurfaceEditPanelProps>(function RemoteSurfaceEditPanel({ remoteInfo }) {
	const navigate = useNavigate()

	const doCloseSurface = useCallback(() => {
		void navigate({ to: '/surfaces/remote' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Settings for {remoteInfo?.displayName}</h4>
				<div className="header-buttons">
					<div className="float_right" onClick={doCloseSurface} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>

			<SurfaceEditPanelContent remoteInfo={remoteInfo} doClose={doCloseSurface} />
		</>
	)
})

interface SurfaceEditPanelContentProps {
	remoteInfo: OutboundSurfaceInfo
	doClose: () => void
}

interface FormData {
	name: string
	config: Record<string, JsonValue | undefined>
}

const SurfaceEditPanelContent = observer<SurfaceEditPanelContentProps>(function SurfaceEditPanelContent({
	remoteInfo,
	doClose,
}) {
	const { surfaceInstances } = useContext(RootAppStoreContext)
	const [saveError, setSaveError] = useState<string | null>(null)

	const saveConfigMutation = useMutationExt(trpc.surfaces.outbound.saveConfig.mutationOptions())

	// Get the instance info to access config fields
	const instanceInfo = useMemo(() => {
		if (remoteInfo.type !== 'plugin') return null
		return surfaceInstances.instances.get(remoteInfo.instanceId)
	}, [remoteInfo, surfaceInstances])

	const form = useForm({
		defaultValues: {
			name: remoteInfo.displayName,
			config: remoteInfo.type === 'plugin' ? remoteInfo.config : {},
		} satisfies FormData,
		onSubmit: async ({ value }) => {
			setSaveError(null)

			try {
				await saveConfigMutation.mutateAsync({
					id: remoteInfo.id,
					name: value.name,
					config: value.config,
				})
				console.log('Saved remote surface config')
			} catch (err: any) {
				setSaveError(`Failed to save remote surface config: ${err?.message ?? err?.toString() ?? err}`)
			}
		},
	})

	const handleCancel = useCallback(() => {
		form.reset()
		doClose()
	}, [form, doClose])

	return (
		<form
			className="secondary-panel-simple-body d-flex flex-column pb-0"
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				form.handleSubmit().catch((err) => {
					console.error('Form submission error', err)
				})
			}}
		>
			<div className="flex-fill">
				<div className="row g-sm-2">
					{saveError && (
						<CCol className="fieldtype-textinput" sm={12}>
							<CAlert color="danger">{saveError}</CAlert>
						</CCol>
					)}

					<form.Field
						name="name"
						validators={{
							onChange: ({ value }) => {
								if (!value || value.trim() === '') return 'Name is required'
								return undefined
							},
						}}
						children={(field) => (
							<>
								<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Name</CFormLabel>
								<CCol className="fieldtype-textinput" sm={8}>
									<CFormInput
										type="text"
										style={{ color: field.state.meta.errors.length ? 'red' : undefined }}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.length > 0 && (
										<CAlert color="warning" className="mt-2">
											{field.state.meta.errors}
										</CAlert>
									)}
								</CCol>
							</>
						)}
					/>

					<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Surface Integration</CFormLabel>
					<CCol sm={8}>
						<CFormText>{instanceInfo?.label ?? remoteInfo.instanceId}</CFormText>
					</CCol>

					{instanceInfo?.remoteConfigFields?.map((fieldDef) => {
						return (
							<React.Fragment key={fieldDef.id}>
								<form.Field
									name={`config.${fieldDef.id}`}
									validators={{
										onChange: ({ value }) => validateInputValue(fieldDef, value),
									}}
									children={(field) => (
										<>
											<EditPanelConfigField
												definition={fieldDef}
												setValue={(_k, v) => field.handleChange(v)}
												value={field.state.value}
											/>
											{field.state.meta.errors.length > 0 && (
												<CCol sm={{ offset: 4, span: 8 }}>
													<CAlert color="warning" className="mt-2">
														{field.state.meta.errors}
													</CAlert>
												</CCol>
											)}
										</>
									)}
								/>
							</React.Fragment>
						)
					})}
				</div>
			</div>

			<form.Subscribe
				selector={(state) => [state.isDirty, state.isValid, state.isSubmitting]}
				children={([isDirty, isValid, isSubmitting]) => (
					<div className="row connection-form-buttons border-top">
						<CCol sm={12}>
							<div className="flex flex-row">
								<div className="grow">
									<CButton
										color="success"
										className="me-md-1"
										disabled={!isDirty || !isValid || isSubmitting}
										type="submit"
									>
										Save {isSubmitting ? '...' : ''}
									</CButton>

									<CButton color="secondary" onClick={handleCancel} disabled={isSubmitting}>
										Cancel
									</CButton>
								</div>
							</div>
						</CCol>
					</div>
				)}
			/>
		</form>
	)
})
