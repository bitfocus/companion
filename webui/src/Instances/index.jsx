import { CCol, CRow, CTabs, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import { memo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { HelpModal } from './HelpModal'
import { NotifierContext, MyErrorBoundary, socketEmitPromise, SocketContext } from '../util'
import { InstancesList } from './InstanceList'
import { AddInstancesPanel } from './AddInstance'
import { InstanceEditPanel } from './InstanceEditPanel'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export const InstancesPage = memo(function InstancesPage() {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)

	const helpModalRef = useRef()

	const [tabResetToken, setTabResetToken] = useState(nanoid())
	const [activeTab, setActiveTab] = useState('add')
	const [selectedInstanceId, setSelectedInstanceId] = useState(null)
	const doChangeTab = useCallback((newTab) => {
		setActiveTab((oldTab) => {
			if (oldTab !== newTab) {
				setSelectedInstanceId(null)
				setTabResetToken(nanoid())
			}
			return newTab
		})
	}, [])

	const showHelp = useCallback(
		(id) => {
			socketEmitPromise(socket, 'instances:get-help', [id]).then(([err, result]) => {
				if (err) {
					notifier.current.show('Instance help', `Failed to get help text: ${err}`)
					return
				}
				if (result) {
					helpModalRef.current?.show(id, result)
				}
			})
		},
		[socket, notifier]
	)

	const doConfigureInstance = useCallback((id) => {
		setSelectedInstanceId(id)
		setTabResetToken(nanoid())
		setActiveTab(id ? 'edit' : 'add')
	}, [])

	const [instanceStatus, setInstanceStatus] = useState(null)
	useEffect(() => {
		socketEmitPromise(socket, 'instance_status:get', [])
			.then((statuses) => {
				setInstanceStatus(statuses)
			})
			.catch((e) => {
				console.error(`Failed to load instance statuses`, e)
			})

		const patchStatuses = (patch) => {
			setInstanceStatus((oldStatuses) => {
				if (!oldStatuses) return oldStatuses
				return jsonPatch.applyPatch(cloneDeep(oldStatuses) || {}, patch).newDocument
			})
		}
		socket.on('instance_status:patch', patchStatuses)

		return () => {
			socket.off('instance_status:patch', patchStatuses)
		}
	}, [socket])

	return (
		<CRow className="instances-page split-panels">
			<HelpModal ref={helpModalRef} />

			<CCol xl={6} className="instances-panel primary-panel">
				<InstancesList
					instanceStatus={instanceStatus}
					showHelp={showHelp}
					doConfigureInstance={doConfigureInstance}
					selectedInstanceId={selectedInstanceId}
				/>
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
						<CTabContent fade={false} className="remove075right">
							<CTabPane data-tab="add">
								<MyErrorBoundary>
									<AddInstancesPanel showHelp={showHelp} doConfigureInstance={doConfigureInstance} />
								</MyErrorBoundary>
							</CTabPane>
							<CTabPane data-tab="edit">
								<MyErrorBoundary>
									{selectedInstanceId && (
										<InstanceEditPanel
											key={tabResetToken}
											showHelp={showHelp}
											doConfigureInstance={doConfigureInstance}
											instanceId={selectedInstanceId}
											instanceStatus={instanceStatus?.[selectedInstanceId]}
										/>
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
