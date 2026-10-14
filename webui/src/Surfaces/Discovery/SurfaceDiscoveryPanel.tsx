import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { ContextHelpButton } from '~/Layout/PanelIcons.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable.js'

/** The remote surfaces page's secondary panel while no remote connection is selected. */
export function SurfaceDiscoveryPanel(): React.JSX.Element {
	return (
		<>
			<PanelHeader icon={faMagnifyingGlass} title="Discover Surfaces">
				<ContextHelpButton action="/user-guide/config/surfaces#discover">
					Remote surfaces found on your network. Set one up here to connect it to Companion.
				</ContextHelpButton>
			</PanelHeader>

			<div className="secondary-panel-simple-body">
				<p className="text-sm text-muted mb-3">
					Remote surfaces such as Companion Satellite (1.9.0 and later), Stream Deck Studio and Stream Deck Network Dock
					appear here as they are discovered.
				</p>
				<MyErrorBoundary>
					<SurfaceDiscoveryTable />
				</MyErrorBoundary>
			</div>
		</>
	)
}
