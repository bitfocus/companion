import { faFileLines, faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { makeAbsolutePath, useComputed } from '~/Resources/util.js'
import type { UserConfigProps } from '~/UserConfig/Components/Common.js'
import { ConfigStaticField, ConfigSwitchField } from '~/UserConfig/Components/ConfigFieldRows.js'
import { useUserConfigProps } from '~/UserConfig/Context.js'
import { PROTOCOLS, type ProtocolDefinition } from '~/UserConfig/ProtocolDefinitions.js'

const RouteComponent = observer(function RouteComponent() {
	const { protocolId } = Route.useParams()
	const navigate = useNavigate({ from: '/settings/protocols/$protocolId' })
	const userConfigProps = useUserConfigProps()

	const protocol = PROTOCOLS.find((p) => p.id === protocolId)

	useComputed(() => {
		if (!protocol) {
			void navigate({ to: '/settings/protocols' })
		}
	}, [navigate, protocol])

	const doClose = useCallback(() => {
		void navigate({ to: '/settings/protocols' })
	}, [navigate])

	if (!protocol) return null

	return (
		<>
			<PanelHeader icon={faNetworkWired} title={protocol.name}>
				<ContextHelpButton action={protocol.docs}>API reference</ContextHelpButton>
				<CloseButton closeFn={doClose} />
			</PanelHeader>

			<div className="secondary-panel-simple-body">
				<MyErrorBoundary>
					{userConfigProps && (
						<div className="edit-panel">
							<EditSectionCard title="Settings">
								<div className="flex items-start justify-between gap-3">
									<p className="text-xs text-muted mb-0">{protocol.description}</p>
									<ProtocolDocsButton protocol={protocol} />
								</div>

								<ProtocolEnabledField protocol={protocol} userConfig={userConfigProps} />
								{protocol.Settings && <protocol.Settings {...userConfigProps} />}
							</EditSectionCard>

							{protocol.Section && <protocol.Section />}
						</div>
					)}
				</MyErrorBoundary>
			</div>
		</>
	)
})

function ProtocolEnabledField({
	protocol,
	userConfig,
}: {
	protocol: ProtocolDefinition
	userConfig: UserConfigProps
}): React.JSX.Element {
	if (protocol.enabledField === null) {
		return <ConfigStaticField label="Enabled" value="Always on" help={`${protocol.name} can't be disabled.`} />
	}

	return <ConfigSwitchField userConfig={userConfig} label="Enabled" field={protocol.enabledField} help={null} />
}

function ProtocolDocsButton({ protocol }: { protocol: ProtocolDefinition }): React.JSX.Element {
	const { docs, docsLabel } = protocol

	const content = (
		<>
			<FontAwesomeIcon icon={faFileLines} className="me-1.5" />
			{docsLabel}
		</>
	)

	if (typeof docs === 'string') {
		return (
			<LinkButtonExternal color="secondary" size="sm" className="shrink-0" href={makeAbsolutePath(docs)}>
				{content}
			</LinkButtonExternal>
		)
	}

	return (
		<Button color="secondary" size="sm" className="shrink-0" onClick={docs}>
			{content}
		</Button>
	)
}

export const Route = createFileRoute('/_app/settings/protocols/$protocolId')({
	component: RouteComponent,
})
