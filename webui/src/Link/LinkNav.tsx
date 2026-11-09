import { useLocation } from '@tanstack/react-router'
import { activePageIdForPath, LINK_SECTION } from '~/Layout/navRegistry.js'
import { PageTabs } from '~/Layout/PageTabs.js'

export function LinkNav(): React.JSX.Element {
	const pathname = useLocation().pathname

	return <PageTabs tabs={LINK_SECTION.pages} activeTab={activePageIdForPath(LINK_SECTION, pathname)} />
}
