import { CCol, CRow } from "@coreui/react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { HelpModal } from "./HelpModal";
import { CompanionContext, socketEmit } from "../util";
import { InstanceConfig } from "./InstanceConfig";
import { InstancesList } from "./InstanceList";
import shortid from "shortid";

export function InstancesPage({ resetToken }) {
	const context = useContext(CompanionContext)
	const [selectedInstance, setSelectedInstance] = useState([null, shortid()])
	const helpModalRef = useRef()

	// Clear the selected instance whenever the parent tab changes
	useEffect(() => {
		setSelectedInstance([null, shortid()])
	}, [resetToken])

	const showHelp = useCallback((name) => {
		socketEmit(context.socket, 'instance_get_help', [name]).then(([err, result]) => {
			if (err) {
				alert('Error getting help text');
				return;
			}
			if (result) {
				helpModalRef.current?.show(name, result)
			}
		})
	}, [context.socket])

	const configureInstance = useCallback((id) => {
		console.log('configureInstance', id)
		setSelectedInstance([id, shortid()])
	}, [])

	return (
		<CRow className='instances-page'>
			<HelpModal ref={helpModalRef} />

			<CCol xl={6} className='instances-panel'>
				<InstancesList configureInstance={configureInstance} showHelp={showHelp} />
			</CCol>
			<CCol xl={6} className='instances-panel'>
				{
					selectedInstance[0]
						? <InstanceConfig
							key={selectedInstance[1]}
							instanceId={selectedInstance[0]}
							showHelp={showHelp}
						/>
						: 'No instance specified'
				}
			</CCol>
		</CRow>
	)
}