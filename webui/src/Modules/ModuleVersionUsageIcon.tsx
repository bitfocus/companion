import { faPlug, faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { InlineHelpCustom } from '~/Components/InlineHelp'

interface ModuleVersionUsageIconProps {
	matchingConnections: number
	isInstalled: boolean
}

export const ModuleVersionUsageIcon = observer(function ModuleVersionUsageIcon({
	matchingConnections,
	isInstalled,
}: ModuleVersionUsageIconProps) {
	if (matchingConnections === 0) return null // TODO - needs a placeholder for positioning

	const usageLabel = `${matchingConnections} connection${matchingConnections === 1 ? ' is' : 's are'} using this version`

	return (
		<InlineHelpCustom help={usageLabel}>
			<FontAwesomeIcon icon={isInstalled ? faPlug : faWarning} aria-label={usageLabel} />
		</InlineHelpCustom>
	)
})
