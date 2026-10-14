import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { PanelHeader } from '~/Layout/PanelHeader.js'
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
		<PanelHeader icon={faCalendarAlt} title="Edit Backup Rule">
			<ContextHelpButton action="/user-guide/config/settings#backups" />
			<CloseButton closeFn={doCloseRule} />
		</PanelHeader>
	)
}
