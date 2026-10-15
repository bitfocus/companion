import { faCircleExclamation, faCircleInfo, faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useId, useState } from 'react'
import type { JsonValue } from 'type-fest'
import type {
	ClientLinkTransportType,
	LinkTransportConfig,
	LinkTransportState,
} from '@companion-app/shared/Model/Link.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { CopyButton } from '~/Components/CopyButton.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { Note } from '~/Components/Note.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { OptionsVisibility } from '~/Hooks/OptionsVisibility.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { EditPanelConfigField } from '~/Surfaces/EditPanelConfigField.js'
import { TransportStatusBadge } from './LinkStatusBadges.js'
import { useLinkStore } from './LinkStoreContext.js'

export const TransportEditPanel = observer(function TransportEditPanel({
	transport,
}: {
	transport: LinkTransportConfig
}): React.JSX.Element {
	const linkStore = useLinkStore()
	const navigate = useNavigate()

	const doClose = useCallback(() => void navigate({ to: '/link' }), [navigate])

	const transportType = linkStore.transportTypes.get(transport.type)
	const state = linkStore.transportStates.get(transport.id)

	return (
		<>
			<PanelHeader icon={faNetworkWired} title={transport.label}>
				<CloseButton closeFn={doClose} />
			</PanelHeader>

			{transportType ? (
				<TransportEditForm transport={transport} transportType={transportType} state={state} doClose={doClose} />
			) : (
				<div className="secondary-panel-simple-body p-4">
					<StaticAlert color="danger">
						This transport is of an unknown type &quot;{transport.type}&quot;, so it can&apos;t be used. It may have
						been created by a newer version of Companion.
					</StaticAlert>
				</div>
			)}
		</>
	)
})

/** What the transport reports about itself: its status, and facts such as the address it is listening on */
const TransportStateSummary = observer(function TransportStateSummary({
	state,
}: {
	state: LinkTransportState | undefined
}) {
	if (!state || state.status === 'disabled') return null

	return (
		<div className="flex flex-col gap-2 mb-3">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted">Status</span>
				<TransportStatusBadge state={state} />
			</div>

			{state.message && (
				<Note tone={state.status === 'error' ? 'danger' : 'warning'} icon={faCircleExclamation} actions={null}>
					{state.message}
				</Note>
			)}

			{state.info.length > 0 && (
				<dl className="grid grid-cols-3 gap-x-4 gap-y-1 m-0 text-sm">
					{state.info.map((item) => (
						<React.Fragment key={item.label}>
							<dt className="text-muted">{item.label}</dt>
							<dd className="col-span-2 m-0 flex items-center gap-1 min-w-0">
								<code className="truncate" title={item.value}>
									{item.value}
								</code>
								{item.copyable && <CopyButton text={item.value} variant="ghost" />}
							</dd>
						</React.Fragment>
					))}
				</dl>
			)}
		</div>
	)
})

interface FormData {
	label: string
	config: Record<string, JsonValue | undefined>
}

const TransportEditForm = observer(function TransportEditForm({
	transport,
	transportType,
	state,
	doClose,
}: {
	transport: LinkTransportConfig
	transportType: ClientLinkTransportType
	state: LinkTransportState | undefined
	doClose: () => void
}) {
	const [saveError, setSaveError] = useState<string | null>(null)
	const updateMutation = useMutationExt(trpc.link.updateTransport.mutationOptions())

	// Typed loosely, as tanstack-form can't compute the deep keys of a JsonValue
	const defaultConfig: Record<string, any> = transport.config
	const form = useForm({
		defaultValues: { label: transport.label, config: defaultConfig } satisfies FormData,
		onSubmit: async ({ value, formApi }) => {
			setSaveError(null)
			try {
				const result = await updateMutation.mutateAsync({ id: transport.id, label: value.label, config: value.config })
				if (!result.ok) {
					setSaveError(`Some fields are invalid: ${Object.values(result.errors).join(', ')}`)
					return
				}
				// Start from the saved values, so the form is no longer dirty
				formApi.reset(value)
			} catch (err: any) {
				setSaveError(`Failed to save: ${err?.message ?? String(err)}`)
			}
		},
	})

	const handleCancel = useCallback(() => {
		form.reset()
		doClose()
	}, [form, doClose])

	const labelFieldId = useId()

	return (
		<Form
			className="secondary-panel-simple-body flex flex-col pb-0"
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				form.handleSubmit().catch((err) => console.error('Form submission error', err))
			}}
		>
			<div className="flex-auto">
				<Note tone="neutral" icon={faCircleInfo} actions={null} className="mb-3">
					<b>{transportType.name}</b>: {transportType.description}
				</Note>

				<TransportStateSummary state={state} />

				<Grid.Row className="sm:gap-2">
					{saveError && (
						<Grid.Col sm={12}>
							<StaticAlert color="danger">{saveError}</StaticAlert>
						</Grid.Col>
					)}

					<form.Field
						name="label"
						validators={{ onChange: ({ value }) => (!value.trim() ? 'A name is required' : undefined) }}
						children={(field) => (
							<>
								<FormLabel htmlFor={labelFieldId} sm={4} column="sm">
									Name
								</FormLabel>
								<Grid.Col sm={8}>
									<TextInputFieldSimple
										id={labelFieldId}
										value={field.state.value}
										setValue={field.handleChange}
										checkValid={field.state.meta.errors.length === 0}
										onBlur={field.handleBlur}
										immediateValue
									/>
								</Grid.Col>
							</>
						)}
					/>

					<form.Subscribe
						selector={(formState) => formState.values.config}
						children={(config) => (
							<OptionsVisibility options={transportType.configFields} values={config}>
								{(visibility) =>
									transportType.configFields.map((fieldDef) => (
										<form.Field
											key={fieldDef.id}
											name={`config.${fieldDef.id}`}
											validators={{ onChange: ({ value }) => validateInputValue(fieldDef, value).validationError }}
											children={(field) => {
												const isVisible = visibility.get(fieldDef.id) ?? true
												return (
													<>
														<EditPanelConfigField
															definition={fieldDef}
															setValue={(_k, v) => field.handleChange(v)}
															value={field.state.value}
															isVisible={isVisible}
														/>
														{field.state.meta.errors.length > 0 && (
															<Grid.Col sm={{ offset: 4, span: 8 }} className={classNames({ hidden: !isVisible })}>
																<StaticAlert color="warning" className="mt-2">
																	{field.state.meta.errors}
																</StaticAlert>
															</Grid.Col>
														)}
													</>
												)
											}}
										/>
									))
								}
							</OptionsVisibility>
						)}
					/>
				</Grid.Row>
			</div>

			<form.Subscribe
				selector={(formState) => [formState.isDirty, formState.isValid, formState.isSubmitting]}
				children={([isDirty, isValid, isSubmitting]) => (
					<Grid.Row className="connection-form-buttons border-t border-border-alt">
						<Grid.Col sm={12}>
							<Button
								color="primary"
								className="md:me-1"
								disabled={!isDirty || !isValid || isSubmitting}
								type="submit"
								aria-busy={isSubmitting}
							>
								Save {isSubmitting ? '…' : ''}
							</Button>
							<Button type="button" color="secondary" onClick={handleCancel} disabled={isSubmitting}>
								Cancel
							</Button>
						</Grid.Col>
					</Grid.Row>
				)}
			/>
		</Form>
	)
})
