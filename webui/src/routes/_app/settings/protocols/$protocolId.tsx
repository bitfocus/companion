import { faNetworkWired } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { PROTOCOLS } from '~/UserConfig/ProtocolDefinitions.js'
import { SettingsItemPanel } from '~/UserConfig/SettingsItems.js'

function RouteComponent() {
	const { protocolId } = Route.useParams()

	return (
		<SettingsItemPanel
			items={PROTOCOLS}
			itemId={protocolId}
			basePath="/settings/protocols"
			icon={faNetworkWired}
			helpLabel="API reference"
		/>
	)
}

export const Route = createFileRoute('/_app/settings/protocols/$protocolId')({
	component: RouteComponent,
})
