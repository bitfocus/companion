import { Badge, type BadgeProps } from '~/Components/Badge.js'
import type { ModuleInstallationKind } from './ModuleInstallState.js'

const KIND_COLORS: Record<ModuleInstallationKind, BadgeProps['color']> = {
	Development: 'warning',
	Installed: 'success',
	'Built-in': 'primary',
	Available: 'secondary',
}

export function ModuleInstallationBadge({ kind }: { kind: ModuleInstallationKind }): React.JSX.Element {
	return (
		<Badge color={KIND_COLORS[kind]} variant="tonal" className="shrink-0">
			{kind}
		</Badge>
	)
}
