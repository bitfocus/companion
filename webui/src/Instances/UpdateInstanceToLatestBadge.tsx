import { faCircleUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { InstanceVersionUpdatePolicy, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'
import { useModuleStoreInfo } from '~/Modules/useModuleStoreInfo.js'
import { useModuleUpgradeToVersions } from '~/Modules/useModuleUpgradeToVersions.js'
import { getInstanceUpdateMessage } from './InstanceUpdate.js'

interface UpdateInstanceToLatestBadgeProps {
	instance: ClientInstanceConfigBase
	variant?: 'icon' | 'label'
}

export const UpdateInstanceToLatestBadge = observer(function UpdateInstanceToLatestBadge({
	instance,
	variant = 'icon',
}: UpdateInstanceToLatestBadgeProps) {
	// Don't show for dev versions
	if (instance.moduleVersionId === 'dev') return null
	// Return early if manual updates are enabled
	if (variant === 'icon' && instance.updatePolicy === InstanceVersionUpdatePolicy.Manual) return null

	return <UpdateInstanceToLatestBadgeInner instance={instance} variant={variant} />
})

const UpdateInstanceToLatestBadgeInner = observer(function UpdateInstanceToLatestBadgeInner({
	instance,
	variant,
}: UpdateInstanceToLatestBadgeProps) {
	const moduleStoreInfo = useModuleStoreInfo(instance.moduleType, instance.moduleId) // TODO - put these into a central store, to minimise the impact
	const upgradeToVersions = useModuleUpgradeToVersions(instance.moduleType, instance.moduleId)

	const message = getInstanceUpdateMessage(instance, moduleStoreInfo?.versions, upgradeToVersions.length > 0)

	if (!message) return null

	if (variant === 'label') {
		return (
			<span
				title={message}
				className="rounded-md bg-tone-info-fill/10 px-1.5 py-0.5 text-2xs font-medium text-tone-info-text"
			>
				Update available
			</span>
		)
	}

	return (
		<InlineHelpCustom help={message} className="ms-1">
			<FontAwesomeIcon icon={faCircleUp} className="text-tone-info-text" aria-label={message} />
		</InlineHelpCustom>
	)
})
