import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { BackupRuleEditor } from '../../../../UserConfig/BackupRuleEditor.js'
import { RootAppStoreContext } from '../../../../Stores/RootAppStore.js'
import { MyErrorBoundary, useComputed } from '../../../../util.js'
import { observer } from 'mobx-react-lite'

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

	return (
		<div className="secondary-panel-simple">
			<div className="secondary-panel-simple-body">
				<MyErrorBoundary>
					<BackupRuleEditor ruleId={ruleId} />
				</MyErrorBoundary>
			</div>
		</div>
	)
})

export const Route = createFileRoute('/_app/settings/backups/$ruleId')({
	component: RouteComponent,
})
