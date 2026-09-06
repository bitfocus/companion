import { forwardRef, useCallback, useContext, useId, useImperativeHandle, useState } from 'react'
import { API_KEY_SCOPES, type ApiKeyInfo, type ApiTokenScope } from '@companion-app/shared/Model/ApiKeys.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { CopyButton } from '~/Components/CopyButton.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { Modal } from '~/Components/Modal'
import { MultiDropdownInputField } from '~/Components/MultiDropdownInputField.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const SCOPE_CHOICES = API_KEY_SCOPES.map((scope) => ({ id: scope, label: scope }))

export interface RestApiKeyModalRef {
	create(): void
	edit(key: ApiKeyInfo): void
}

interface RestApiKeyModalProps {
	/** Called after a key is created or updated, so the caller can refresh its list. */
	onSaved: () => void
}

export const RestApiKeyModal = forwardRef<RestApiKeyModalRef, RestApiKeyModalProps>(function RestApiKeyModal(
	{ onSaved },
	ref
) {
	const { notifier } = useContext(RootAppStoreContext)

	const createMutation = useMutationExt(trpc.restApiKeys.create.mutationOptions())
	const updateMutation = useMutationExt(trpc.restApiKeys.update.mutationOptions())

	const [show, setShow] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [name, setName] = useState('')
	const [scopes, setScopes] = useState<ApiTokenScope[]>(['read'])
	const [createdToken, setCreatedToken] = useState<string | null>(null)

	useImperativeHandle(
		ref,
		() => ({
			create() {
				setEditingId(null)
				setName('')
				setScopes(['read'])
				setCreatedToken(null)
				setShow(true)
			},
			edit(key) {
				setEditingId(key.id)
				setName(key.name)
				setScopes(key.scopes)
				setCreatedToken(null)
				setShow(true)
			},
		}),
		[]
	)

	const isValid = name.trim().length > 0 && scopes.length > 0

	const doSave = useCallback(
		(e?: React.FormEvent) => {
			e?.preventDefault()
			if (!isValid) return

			if (editingId === null) {
				createMutation
					.mutateAsync({ name: name.trim(), scopes })
					.then((result) => {
						setCreatedToken(result.token)
						onSaved()
					})
					.catch((err) => {
						notifier.show('Error', `Failed to create API key: ${err.message || err}`, 5000)
					})
			} else {
				updateMutation
					.mutateAsync({ id: editingId, name: name.trim(), scopes })
					.then(() => {
						setShow(false)
						onSaved()
					})
					.catch((err) => {
						notifier.show('Error', `Failed to update API key: ${err.message || err}`, 5000)
					})
			}
		},
		[createMutation, updateMutation, editingId, name, scopes, isValid, notifier, onSaved]
	)

	const nameFieldId = useId()
	const title = editingId === null ? 'Create API key' : 'Edit API key'

	return (
		<Modal.Root open={show} onOpenChange={setShow} disableDismiss={!!createdToken}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton={!createdToken}>
							<Modal.Title>{title}</Modal.Title>
						</Modal.Header>

						{createdToken ? (
							<>
								<Modal.Body>
									<StaticAlert color="success">
										<p className="mb-2">
											<strong>Copy your new API key now.</strong> For security it is not stored and cannot be shown
											again.
										</p>
										<div className="flex items-center gap-2">
											<code className="flex-1 min-w-0 break-all">{createdToken}</code>
											<CopyButton text={createdToken} />
										</div>
									</StaticAlert>
								</Modal.Body>
								<Modal.Footer>
									<Button color="primary" onClick={() => setShow(false)}>
										Done
									</Button>
								</Modal.Footer>
							</>
						) : (
							<>
								<Modal.Body>
									<Form onSubmit={doSave}>
										<Grid.Row className="mb-3">
											<FormLabel htmlFor={nameFieldId} sm={3} column="sm">
												Name
											</FormLabel>
											<Grid.Col sm={9}>
												<TextInputFieldSimple
													id={nameFieldId}
													value={name}
													setValue={setName}
													placeholder="e.g. CI deploy"
													immediateValue
												/>
											</Grid.Col>
										</Grid.Row>
										<Grid.Row>
											<FormLabel htmlFor={undefined} sm={3} column="sm">
												Scopes
											</FormLabel>
											<Grid.Col sm={9}>
												<MultiDropdownInputField
													htmlName="rest-api-scopes"
													choices={SCOPE_CHOICES}
													value={scopes}
													setValue={(value) => setScopes(value as ApiTokenScope[])}
												/>
											</Grid.Col>
										</Grid.Row>
									</Form>
								</Modal.Body>
								<Modal.Footer>
									<Modal.Close>Cancel</Modal.Close>
									<Button color="primary" onClick={doSave} disabled={!isValid}>
										{editingId === null ? 'Create' : 'Save'}
									</Button>
								</Modal.Footer>
							</>
						)}
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})
