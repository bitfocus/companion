import { faCircleExclamation, faLink, faLinkSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useNavigate } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useId, useMemo } from 'react'
import {
	BUTTON_DECORATION_CHOICES,
	BUTTON_STATUS_ICONS_CHOICES,
} from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { LinkButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonRuntimeProps, LinkButtonStatus } from '@companion-app/shared/Model/Link.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { Button } from '~/Components/Button.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Note } from '~/Components/Note.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { ButtonLocationInput } from './ButtonLocationInput.js'

/** What to tell the user about each status, when it needs explaining */
const STATUS_EXPLANATIONS: Record<LinkButtonStatus, string | null> = {
	unconfigured: 'Choose an installation and a button location.',
	unknown_peer: 'This installation has not been found on any transport.',
	incompatible: 'This installation runs an incompatible version of Companion Link.',
	offline: 'This installation is not reachable right now.',
	denied:
		"This installation doesn't share its buttons with this one. On its Link page, select this installation and turn on sharing its buttons.",
	over_limit:
		'This installation is already sending as many buttons as it can to the installations using it, so it refused this one.',
	loading: null,
	loop: 'This button leads back to itself through other installations, so it would show itself.',
	ok: null,
}

interface LinkButtonEditorProps {
	config: LinkButtonModel
	controlId: string
	runtimeProps: Record<string, any> | false
}

/** Editor for a link button: which installation and which of its buttons to show */
export const LinkButtonEditor = observer(function LinkButtonEditor({
	config,
	controlId,
	runtimeProps,
}: LinkButtonEditorProps) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())
	const setOption = useCallback(
		(key: 'peerId' | 'location' | 'decoration' | 'showStatusIcons', value: string | ExpressionOrValue<string>) => {
			setOptionsFieldMutation
				.mutateAsync({ controlId, key, value })
				.catch((e) => console.error(`Failed to set link button ${key}: ${e}`))
		},
		[setOptionsFieldMutation, controlId]
	)

	const peers = useSubscription(trpc.link.watchPeers.subscriptionOptions())
	const peerChoices = useMemo(() => {
		const choices: DropdownChoice[] = (peers.data ?? [])
			.toSorted((a, b) => a.name.localeCompare(b.name))
			.map((peer) => ({
				id: peer.id,
				label: peer.online ? peer.name : `${peer.name} (offline)`,
			}))

		// Keep the chosen installation selectable even when it hasn't been discovered
		if (config.options.peerId && !choices.some((c) => c.id === config.options.peerId)) {
			choices.unshift({ id: config.options.peerId, label: `Unknown installation (${config.options.peerId})` })
		}
		return choices
	}, [peers.data, config.options.peerId])

	const status = runtimeProps ? (runtimeProps as LinkButtonRuntimeProps).status : null
	const explanation = status ? STATUS_EXPLANATIONS[status] : null

	const peerFieldId = useId()
	const locationFieldId = useId()
	const decorationFieldId = useId()
	const statusIconsFieldId = useId()

	// Nothing to choose from until another installation has been found
	if (peers.data && peerChoices.length === 0) return <NoInstallations />

	return (
		<>
			<Note tone="neutral" icon={faLink} actions={null} className="my-2">
				<strong className="block text-text-strong font-medium">Remote button</strong>
				<div>Shows a button of another Companion installation, and presses it when this one is pressed.</div>
				<div className="mt-1">
					Installations are found through the transports set up on the <Link to="/link">Link</Link> page.
				</div>
			</Note>

			{explanation && (
				<Note tone="warning" icon={faCircleExclamation} actions={null} className="my-2">
					{explanation}
				</Note>
			)}

			<Form row className="gap-2" onSubmit={PreventDefaultHandler}>
				<FormLabel htmlFor={peerFieldId} sm={4} column="sm">
					Installation
				</FormLabel>
				<Grid.Col sm={8}>
					<DropdownInputField
						htmlName={peerFieldId}
						choices={peerChoices}
						value={config.options.peerId}
						setValue={(value) => setOption('peerId', String(value ?? ''))}
					/>
				</Grid.Col>

				<FormLabel htmlFor={locationFieldId} sm={4} column="sm">
					Button location
				</FormLabel>
				<Grid.Col sm={8}>
					<ButtonLocationInput
						inputId={locationFieldId}
						controlId={controlId}
						value={config.options.location}
						setValue={(value) => setOption('location', value)}
					/>
					<div className="form-text">
						The location on the other installation. <code>this</code> means the same location as this button.
					</div>
				</Grid.Col>

				<FormLabel htmlFor={decorationFieldId} sm={4} column="sm">
					Decoration
				</FormLabel>
				<Grid.Col sm={8}>
					<DropdownInputField
						htmlName={decorationFieldId}
						choices={BUTTON_DECORATION_CHOICES}
						value={config.options.decoration}
						setValue={(value) => setOption('decoration', String(value))}
					/>
				</Grid.Col>

				<FormLabel htmlFor={statusIconsFieldId} sm={4} column="sm">
					Show status icons
				</FormLabel>
				<Grid.Col sm={8}>
					<DropdownInputField
						htmlName={statusIconsFieldId}
						choices={BUTTON_STATUS_ICONS_CHOICES}
						value={config.options.showStatusIcons}
						setValue={(value) => setOption('showStatusIcons', String(value))}
					/>
					<div className="form-text">
						The button is decorated here, as any button of this installation. With a top bar, a cloud among its status
						icons marks it as a remote button.
					</div>
				</Grid.Col>
			</Form>
		</>
	)
})

/** Shown while no other installation has been found, as there is nothing to choose from */
function NoInstallations(): React.JSX.Element {
	const navigate = useNavigate()

	return (
		<NonIdealState icon={faLinkSlash}>
			<h4 className="my-1 font-semibold text-body">No other installations yet</h4>
			<p className="my-2 text-sm text-muted">
				A remote button shows a button of another Companion installation. Link this installation to another first, by
				adding a Direct connection to it, or by pairing one that connects to this one.
			</p>
			<Button color="primary" size="sm" onClick={() => void navigate({ to: '/link' })} className="mt-2">
				<FontAwesomeIcon icon={faLink} /> Set up Link
			</Button>
		</NonIdealState>
	)
}
