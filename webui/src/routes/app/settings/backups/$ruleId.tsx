import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { BackupRuleEditor } from '../../../../UserConfig/BackupRuleEditor.js'
import { RootAppStoreContext } from '../../../../Stores/RootAppStore.js'
import { useComputed } from '../../../../util.js'
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
		<>
			<CNav variant="tabs" role="tablist">
				<CNavItem>
					<CNavLink active>{backupRule?.name || 'Edit Backup Rule'}</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane data-tab="editor" visible>
					<BackupRuleEditor ruleId={ruleId} />
				</CTabPane>
			</CTabContent>
		</>
	)
})

export const Route = createFileRoute('/_app/settings/backups/$ruleId')({
	component: RouteComponent,
})
