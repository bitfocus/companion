import { VARIABLES_SECTION } from '~/Layout/navRegistry.js'
import { PageTabs } from '~/Layout/PageTabs'

interface VariablesNavProps {
	activeTab: 'connections' | 'custom' | 'expression'
}

export function VariablesNav({ activeTab }: VariablesNavProps): React.JSX.Element {
	return <PageTabs tabs={VARIABLES_SECTION.pages} activeTab={activeTab} />
}
