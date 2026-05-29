import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useId, useMemo, useState } from 'react'
import type { JsonValue } from 'type-fest'
import type { CompanionSurfaceConfigField, OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { StaticAlert } from '~/Components/Alert'
import { Button } from '~/Components/Button.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { TextInputFieldSimple } from '~/Components/TextInputField'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import { usePlainOptionsVisibility } from '~/Hooks/useOptionsAndIsVisible'
import { CloseButton } from '~/Layout/PanelIcons'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { EditPanelConfigField } from '../EditPanelConfigField'

interface SurfaceEditPanelProps {
	remoteInfo: OutboundSurfaceInfo
}

export const RemoteSurfaceEditPanel = observer<SurfaceEditPanelProps>(function RemoteSurfaceEditPanel({ remoteInfo }) {
	const navigate = useNavigate()
	const twoPanelMode = useTwoPanelMode()

	const doCloseSurface = useCallback(() => {
		void navigate({ to: '/surfaces/remote' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Settings for {remoteInfo?.displayName}</h4>
				<div className="header-buttons">{!twoPanelMode && <CloseButton closeFn={doCloseSurface} />}</div>
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

	const nameFieldId = useId()
	const integrationFieldId = useId()

	return (
		<Form
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
						<Grid.Col className="fieldtype-textinput" sm={12}>
							<StaticAlert color="danger">{saveError}</StaticAlert>
						</Grid.Col>
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
								<FormLabel htmlFor={nameFieldId} className="col-sm-4 col-form-label col-form-label-sm">
									Name
								</FormLabel>
								<Grid.Col className="fieldtype-textinput" sm={8}>
									<TextInputFieldSimple
										id={nameFieldId}
										value={field.state.value}
										setValue={field.handleChange}
										checkValid={field.state.meta.errors.length === 0}
										onBlur={field.handleBlur}
										immediateValue
									/>
									{field.state.meta.errors.length > 0 && (
										<StaticAlert color="warning" className="mt-2">
											{field.state.meta.errors}
										</StaticAlert>
									)}
								</Grid.Col>
							</>
						)}
					/>

					<FormLabel htmlFor={integrationFieldId} className="col-sm-4 col-form-label col-form-label-sm">
						Surface Integration
					</FormLabel>
					<Grid.Col sm={8} className="flex px-2">
						<span className="text-muted align-self-center">{instanceInfo?.label ?? remoteInfo.instanceId}</span>
					</Grid.Col>

					<form.Subscribe
						selector={(state) => state.values.config}
						children={(config) => (
							<OptionsVisibility options={instanceInfo?.remoteConfigFields ?? []} values={config}>
								{(optionVisibility) => (
									<>
										{instanceInfo?.remoteConfigFields?.map((fieldDef) => (
											<React.Fragment key={fieldDef.id}>
												<form.Field
													name={`config.${fieldDef.id}`}
													validators={{
														onChange: ({ value }) => validateInputValue(fieldDef, value).validationError,
													}}
													children={(field) => {
														const isVisible = optionVisibility.get(fieldDef.id) ?? true
														return (
															<>
																<EditPanelConfigField
																	definition={fieldDef}
																	setValue={(_k, v) => field.handleChange(v)}
																	value={field.state.value}
																	isVisible={isVisible}
																/>
																{field.state.meta.errors.length > 0 && (
																	<Grid.Col
																		sm={{ offset: 4, span: 8 }}
																		className={classNames({ displayNone: !isVisible })}
																	>
																		<StaticAlert color="warning" className="mt-2">
																			{field.state.meta.errors}
																		</StaticAlert>
																	</Grid.Col>
																)}
															</>
														)
													}}
												/>
											</React.Fragment>
										))}
									</>
								)}
							</OptionsVisibility>
						)}
					/>
				</div>
			</div>

			<form.Subscribe
				selector={(state) => [state.isDirty, state.isValid, state.isSubmitting]}
				children={([isDirty, isValid, isSubmitting]) => (
					<div className="row connection-form-buttons border-top">
						<Grid.Col sm={12}>
							<div className="flex flex-row">
								<div className="grow">
									<Button
										color="success"
										className="me-md-1"
										disabled={!isDirty || !isValid || isSubmitting}
										type="submit"
									>
										Save {isSubmitting ? '...' : ''}
									</Button>

									<Button type="button" color="secondary" onClick={handleCancel} disabled={isSubmitting}>
										Cancel
									</Button>
								</div>
							</div>
						</Grid.Col>
					</div>
				)}
			/>
		</Form>
	)
})

// Minimal wrapper component to allow using a hook inside a nested render function
const OptionsVisibility = observer(function OptionsVisibility({
	options,
	values,
	children,
}: {
	options: CompanionSurfaceConfigField[]
	values: Record<string, JsonValue | undefined>
	children: (visibility: ReadonlyMap<string, boolean>) => React.ReactNode
}) {
	const visibility = usePlainOptionsVisibility(options, values)
	return <>{children(visibility)}</>
})
