import { useLocation } from '@tanstack/react-router'
import { activePageIdForPath, SURFACES_SECTION } from '~/Layout/navRegistry.js'
import { PageTabs } from '~/Layout/PageTabs'

export function SurfacesNav(): React.JSX.Element {
	const pathname = useLocation().pathname

	return <PageTabs tabs={SURFACES_SECTION.pages} activeTab={activePageIdForPath(SURFACES_SECTION, pathname)} />
}
