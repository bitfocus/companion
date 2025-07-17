import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useCallback, useContext } from 'react'
import { BackupRuleEditor } from '../../../../UserConfig/BackupRuleEditor.js'
import { RootAppStoreContext } from '../../../../Stores/RootAppStore.js'
import { MyErrorBoundary, useComputed } from '../../../../util.js'
import { observer } from 'mobx-react-lite'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

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
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Backup Rule</h4>
			<div className="header-buttons">
				<div className="float_right ms-1" onClick={doCloseRule} title="Close">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</div>
			</div>
		</div>
	)
}
