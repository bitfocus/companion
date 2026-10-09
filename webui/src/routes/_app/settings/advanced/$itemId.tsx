import { faCog } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import { ADVANCED_ITEMS } from '~/UserConfig/AdvancedDefinitions.js'
import { SettingsItemPanel } from '~/UserConfig/SettingsItems.js'

function RouteComponent() {
	const { itemId } = Route.useParams()

	return (
		<SettingsItemPanel
			items={ADVANCED_ITEMS}
			itemId={itemId}
			basePath="/settings/advanced"
			icon={faCog}
			helpLabel="Documentation"
		/>
	)
}

export const Route = createFileRoute('/_app/settings/advanced/$itemId')({
	component: RouteComponent,
})
