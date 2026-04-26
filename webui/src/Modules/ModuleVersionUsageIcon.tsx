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

	return (
		<InlineHelpCustom help={`${matchingConnections} connections are using this version`}>
			<FontAwesomeIcon
				icon={isInstalled ? faPlug : faWarning}
				aria-label={`${matchingConnections} connections are using this version`}
			/>
		</InlineHelpCustom>
	)
})
