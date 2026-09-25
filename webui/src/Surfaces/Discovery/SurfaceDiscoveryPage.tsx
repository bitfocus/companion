import { faGamepad } from '@fortawesome/free-solid-svg-icons'
import { PageHeader } from '~/Layout/PageHeader'
import { PageIntro } from '~/Layout/PageIntro'
import { MyErrorBoundary } from '~/Resources/Error'
import { SurfacesNav } from '../SurfacesNav'
import { SurfaceDiscoveryTable } from './SurfaceDiscoveryTable'

export function SurfaceDiscoveryPage(): React.JSX.Element {
	return (
		<div className="page-shell">
			<PageHeader icon={faGamepad} title="Surfaces" helpAction="/user-guide/config/surfaces#discover" />

			<div className="page-shell-body">
				<SurfacesNav />

				<div className="page-scroll">
					<PageIntro title="Discover Surfaces">
						Discovered remote surfaces (such as Companion Satellite 1.9.0+, Stream Deck Studio, or Network Dock) will
						appear below.
					</PageIntro>

					<div className="rounded-lg border border-border/70 bg-surface p-4">
						<MyErrorBoundary>
							<SurfaceDiscoveryTable />
						</MyErrorBoundary>
					</div>
				</div>
			</div>
		</div>
	)
}
