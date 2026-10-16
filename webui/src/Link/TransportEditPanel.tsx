import { faCircleExclamation, faCircleInfo, faGear, faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
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
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Note } from '~/Components/Note.js'
import { StatusBadge } from '~/Components/StatusBadge.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { OptionsVisibility } from '~/Hooks/OptionsVisibility.js'
import { useSaveShortcut } from '~/Hooks/useSaveShortcut.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { ExperimentalBadge, TransportStatusBadge } from './LinkStatusBadges.js'
import { useLinkStore } from './LinkStoreContext.js'
import { PeerLink } from './PeerLink.js'
import { TransportConfigField } from './TransportConfigField.js'
import { TransportSection } from './TransportSections.js'

export const TransportEditPanel = observer(function TransportEditPanel({
	transport,
}: {
	transport: LinkTransportConfig
}): React.JSX.Element {
	const linkStore = useLinkStore()
	const navigate = useNavigate()

	const doClose = useCallback(() => void navigate({ to: '/link/transports' }), [navigate])

	const transportType = linkStore.transportTypes.get(transport.type)
	const state = linkStore.transportStates.get(transport.id)

	return (
		<>
			<PanelHeader icon={faNetworkWired} title={transport.label}>
				<CloseButton closeFn={doClose} />
			</PanelHeader>

			{transport.builtin && transportType ? (
				<BuiltinTransportBody transport={transport} transportType={transportType} state={state} />
			) : transportType ? (
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
const TransportStatusSection = observer(function TransportStatusSection({
	state,
}: {
	state: LinkTransportState | undefined
}) {
	if (!state || state.status === 'disabled') return null

	return (
		<EditSectionCard title="Status" summary={<TransportStatusBadge state={state} />}>
			{state.message && (
				<Note tone={state.status === 'error' ? 'danger' : 'warning'} icon={faCircleExclamation} actions={null}>
					{state.message}
				</Note>
			)}

			{state.info.map((item) => (
				<div key={item.label} className="edit-field-row">
					<span className="form-label">{item.label}</span>
					<span className="flex items-center gap-1 min-w-0 text-sm">
						<span className="truncate font-mono" title={item.value}>
							<PeerLink peerId={item.peerId}>{item.value}</PeerLink>
						</span>
						{item.copyable && <CopyButton text={item.value} variant="ghost" />}
					</span>
				</div>
			))}
		</EditSectionCard>
	)
})

/**
 * A transport that is part of Link has nothing to edit here: it is switched on and configured in the settings, like
 * Companion's other protocols
 */
const BuiltinTransportBody = observer(function BuiltinTransportBody({
	transport,
	transportType,
	state,
}: {
	transport: LinkTransportConfig
	transportType: ClientLinkTransportType
	state: LinkTransportState | undefined
}) {
	const navigate = useNavigate()
	const doOpenSettings = useCallback(
		() => void navigate({ to: '/settings/protocols/$protocolId', params: { protocolId: 'link' } }),
		[navigate]
	)

	return (
		<div className="edit-panel flex flex-col flex-1 min-h-0 overflow-hidden">
			<div className="page-scroll edit-panel-scroll">
				<TransportStatusSection state={state} />

				{state?.sections.map((section) => (
					<TransportSection key={section.id} transportId={transport.id} section={section} />
				))}

				<EditSectionCard title="General Settings">
					<Note tone="neutral" icon={faCircleInfo} actions={null}>
						<b>{transportType.name}</b>: {transportType.description}
					</Note>
					<div>
						<Button color="secondary" size="sm" onClick={doOpenSettings}>
							<FontAwesomeIcon icon={faGear} className="me-1" /> Open settings
						</Button>
					</div>
				</EditSectionCard>
			</div>
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

	const doSave = useCallback(() => {
		form.handleSubmit().catch((err) => console.error('Form submission error', err))
	}, [form])
	useSaveShortcut(doSave)

	const handleCancel = useCallback(() => {
		form.reset()
		doClose()
	}, [form, doClose])

	const labelFieldId = useId()

	return (
		<Form
			className="edit-panel flex flex-col flex-1 min-h-0 overflow-hidden relative"
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				doSave()
			}}
		>
			<div className="page-scroll edit-panel-scroll">
				{saveError && (
					<StaticAlert color="danger" className="mb-4">
						{saveError}
					</StaticAlert>
				)}

				<TransportStatusSection state={state} />

				{state?.sections.map((section) => (
					<TransportSection key={section.id} transportId={transport.id} section={section} />
				))}

				<EditSectionCard title="General Settings">
					<Note tone="neutral" icon={faCircleInfo} actions={null}>
						<b>{transportType.name}</b>: {transportType.description}
						{transportType.experimental && (
							<div className="mt-1">
								<ExperimentalBadge /> It may change or be removed in a later release.
							</div>
						)}
					</Note>

					<form.Field
						name="label"
						validators={{ onChange: ({ value }) => (!value.trim() ? 'A name is required' : undefined) }}
						children={(field) => (
							<div className="edit-field-row">
								<FormLabel htmlFor={labelFieldId}>Name</FormLabel>
								<TextInputFieldSimple
									id={labelFieldId}
									value={field.state.value}
									setValue={field.handleChange}
									checkValid={field.state.meta.errors.length === 0}
									onBlur={field.handleBlur}
									immediateValue
								/>
							</div>
						)}
					/>
				</EditSectionCard>

				{transportType.configFields.length > 0 && (
					<EditSectionCard title="Configuration">
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
												children={(field) => (
													<TransportConfigField
														definition={fieldDef}
														setValue={(v) => field.handleChange(v)}
														value={field.state.value}
														isVisible={visibility.get(fieldDef.id) ?? true}
														errors={field.state.meta.errors.join(', ') || null}
													/>
												)}
											/>
										))
									}
								</OptionsVisibility>
							)}
						/>
					</EditSectionCard>
				)}
			</div>

			<form.Subscribe
				selector={(formState) => [formState.isDirty, formState.isValid, formState.isSubmitting]}
				children={([isDirty, isValid, isSubmitting]) => (
					<div className="shrink-0 bg-surface border-t border-border px-3 py-2 z-10">
						<div className="max-w-readable flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								{isDirty ? (
									<StatusBadge tone="warning" className="select-none">
										Unsaved Changes
									</StatusBadge>
								) : (
									<span className="text-xs text-muted select-none">No unsaved changes</span>
								)}
							</div>

							<div className="flex items-center gap-2">
								<Button color="secondary" size="sm" onClick={handleCancel} disabled={isSubmitting}>
									{isDirty ? 'Cancel' : 'Done'}
								</Button>
								<Button
									color="primary"
									size="sm"
									disabled={!isDirty || !isValid || isSubmitting}
									type="submit"
									title={!isValid ? 'Please fix the errors before saving' : 'Save changes (Cmd+S / Ctrl+S)'}
									aria-busy={isSubmitting}
								>
									{isSubmitting ? 'Saving...' : 'Save Changes'}
								</Button>
							</div>
						</div>
					</div>
				)}
			/>
		</Form>
	)
})
