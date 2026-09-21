import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { Badge } from '~/Components/Badge.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

interface InstanceDeprecatedBadgeProps {
	moduleType: ModuleInstanceType
	moduleId: string
	className: string | undefined
}

/**
 * Marks a row whose module has been deprecated by the store. The reason is only a tooltip, but the
 * word itself is always visible, so a deprecated module can be spotted while scanning the list.
 */
export const InstanceDeprecatedBadge = observer(function InstanceDeprecatedBadge({
	moduleType,
	moduleId,
	className,
}: InstanceDeprecatedBadgeProps) {
	const { modules } = useContext(RootAppStoreContext)

	const deprecationReason = modules.getStoreInfo(moduleType, moduleId)?.deprecationReason
	if (!deprecationReason) return null

	return (
		<InlineHelpCustom
			help={`This module is deprecated and is no longer maintained. ${deprecationReason}`}
			className={className}
		>
			<Badge color="warning" icon={faTriangleExclamation}>
				Deprecated
			</Badge>
		</InlineHelpCustom>
	)
})
