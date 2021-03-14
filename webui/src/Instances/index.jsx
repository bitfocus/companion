import { CCol, CRow, CTabs, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import { memo, useCallback, useContext, useRef, useState } from 'react'
import { HelpModal } from './HelpModal'
import { CompanionContext, MyErrorBoundary, socketEmit } from '../util'
import { InstancesList } from './InstanceList'
import { AddInstancesPanel } from './AddInstance'
import { InstanceEditPanel } from './InstanceEditPanel'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import shortid from 'shortid'
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons'

export const InstancesPage = memo(function InstancesPage() {
	const context = useContext(CompanionContext)

	const helpModalRef = useRef()

	const [tabResetToken, setTabResetToken] = useState(shortid())
	const [activeTab, setActiveTab] = useState('add')
	const [selectedInstanceId, setSelectedInstanceId] = useState(null)
	const doChangeTab = useCallback((newTab) => {
		setActiveTab((oldTab) => {
			if (oldTab !== newTab) {
				setSelectedInstanceId(null)
				setTabResetToken(shortid())
			}
			return newTab
		})
	}, [])

	const showHelp = useCallback(
		(name) => {
			socketEmit(context.socket, 'instance_get_help_md', [name]).then(([err, result]) => {
				if (err) {
					context.notifier.current.show('Instance help', `Failed to get help text: ${err}`)
					return
				}
				if (result) {
					helpModalRef.current?.show(name, result)
				}
			})
		},
		[context.socket, context.notifier]
	)

	const doConfigureInstance = useCallback((id) => {
		setSelectedInstanceId(id)
		setTabResetToken(shortid())
		setActiveTab(id ? 'edit' : 'add')
	}, [])

	return (
		<CRow className="instances-page split-panels">
			<HelpModal ref={helpModalRef} />

			<CCol xl={6} className="instances-panel primary-panel">
				<InstancesList showHelp={showHelp} doConfigureInstance={doConfigureInstance} />
			</CCol>

			<CCol xl={6} className="instances-panel secondary-panel add-instances-panel">
				<div className="secondary-panel-inner">
					<CTabs activeTab={activeTab} onActiveTabChange={doChangeTab}>
						<CNav variant="tabs">
							<CNavItem>
								<CNavLink data-tab="add">
									<FontAwesomeIcon icon={faPlus} /> Add connection
								</CNavLink>
							</CNavItem>
							<CNavItem hidden={!selectedInstanceId}>
								<CNavLink data-tab="edit">
									<FontAwesomeIcon icon={faCog} /> Edit connection
								</CNavLink>
							</CNavItem>
						</CNav>
						<CTabContent fade={false}>
							<CTabPane data-tab="add">
								<MyErrorBoundary>
									<AddInstancesPanel showHelp={showHelp} doConfigureInstance={doConfigureInstance} />
								</MyErrorBoundary>
							</CTabPane>
							<CTabPane data-tab="edit">
								<MyErrorBoundary>
									{selectedInstanceId ? (
										<InstanceEditPanel
											key={tabResetToken}
											showHelp={showHelp}
											doConfigureInstance={doConfigureInstance}
											instanceId={selectedInstanceId}
										/>
									) : (
										''
									)}
								</MyErrorBoundary>
							</CTabPane>
						</CTabContent>
					</CTabs>
				</div>
			</CCol>
		</CRow>
	)
})
