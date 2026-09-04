import { MyErrorBoundary } from '~/Resources/Error'
import { SurfaceDiscoveryTable } from '../Discovery/SurfaceDiscoveryTable'

export function SurfaceDiscoveryPanel(): React.JSX.Element {
	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Discover Surfaces</h4>
			</div>

			<div className="secondary-panel-simple-body">
				<div className="fixed-header">
					<p className="mb-2">
						Discovered remote surfaces, such as Companion Satellite, Stream Deck Studio or Stream Deck Network Dock will
						be listed here. You can easily configure them to connect to Companion from here.
						<br />
						This requires Companion Satellite version 1.9.0 and later.
					</p>
				</div>

				<div className="scrollable-content mt-2">
					<MyErrorBoundary>
						<SurfaceDiscoveryTable />
					</MyErrorBoundary>
				</div>
			</div>
		</>
	)
}
