import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { useComputed } from '../../../../Resources/util.js'
import { RootAppStoreContext } from '../../../../Stores/RootAppStore.js'
import { BackupRuleEditor } from '../../../../UserConfig/BackupRuleEditor.js'

const RouteComponent = observer(function RouteComponent() {
	const { userConfig } = useContext(RootAppStoreContext)
	const { ruleId } = Route.useParams()

	const navigate = useNavigate({ from: '/settings/backups/$ruleId' })

	// Find the matching rule in the user config
	const backupRule = userConfig.properties?.backups?.find((rule) => rule.id === ruleId)

	useComputed(() => {
		if (ruleId && !backupRule) {
			void navigate({ to: `/settings/backups` })
		}
	}, [navigate, ruleId, backupRule])

	const doCloseRule = useCallback(() => {
		void navigate({ to: '/settings/backups' })
	}, [navigate])

	return (
		<>
			<BackupRuleEditPanelHeading doCloseRule={doCloseRule} />

			<div className="secondary-panel-simple-body">
				<MyErrorBoundary>
					<BackupRuleEditor ruleId={ruleId} />
				</MyErrorBoundary>
			</div>
		</>
	)
})

export const Route = createFileRoute('/_app/settings/backups/$ruleId')({
	component: RouteComponent,
})

interface BackupRuleEditPanelHeadingProps {
	doCloseRule: () => void
}

function BackupRuleEditPanelHeading({ doCloseRule }: BackupRuleEditPanelHeadingProps) {
	return (
		<div className="flex items-center justify-between gap-3 p-3 bg-surface-muted/40 border-b border-border/70 shrink-0">
			<div className="flex items-center gap-2">
				<span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-muted text-muted text-xs">
					<FontAwesomeIcon icon={faCalendarAlt} />
				</span>
				<h3 className="text-sm font-bold text-body mb-0">Edit Backup Rule</h3>
			</div>
			<div className="flex items-center gap-1.5">
				<ContextHelpButton action="/user-guide/config/settings#backups" />
				<CloseButton closeFn={doCloseRule} />
			</div>
		</div>
	)
}
