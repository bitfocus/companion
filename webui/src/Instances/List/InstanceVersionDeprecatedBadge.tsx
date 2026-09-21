import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { Badge } from '~/Components/Badge.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'
import { useModuleStoreInfo } from '~/Modules/useModuleStoreInfo.js'

interface InstanceVersionDeprecatedBadgeProps {
	moduleType: ModuleInstanceType
	moduleId: string
	moduleVersionId: string | null
	/** What to call the instance in the tooltip, eg 'connection' */
	labelStr: string
	className: string | undefined
}

/**
 * Marks a row running a version which the store has deprecated. A version is only deprecated when
 * something about it is broken or flawed, so this is something to act on rather than a note: the
 * badge is shown in the version column, with the store's reason for it in the tooltip.
 */
export const InstanceVersionDeprecatedBadge = observer(function InstanceVersionDeprecatedBadge({
	moduleType,
	moduleId,
	moduleVersionId,
	labelStr,
	className,
}: InstanceVersionDeprecatedBadgeProps) {
	const moduleStoreInfo = useModuleStoreInfo(moduleType, moduleId)

	// 'dev' and 'builtin' versions don't come from the store, so can never be deprecated by it
	const deprecationReason = moduleVersionId
		? moduleStoreInfo?.versions.find((version) => version.id === moduleVersionId)?.deprecationReason
		: null
	if (!deprecationReason) return null

	return (
		<InlineHelpCustom
			help={`This version has a known problem and should not be used: ${deprecationReason} Change this ${labelStr} to a different version.`}
			className={className}
		>
			<Badge color="danger" icon={faTriangleExclamation}>
				Deprecated
			</Badge>
		</InlineHelpCustom>
	)
})
