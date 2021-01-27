import { CCol, CRow } from "@coreui/react";
import { useCallback, useContext, useEffect, useState } from "react";
import { HelpModal } from "./HelpModal";
import { CompanionContext, socketEmit } from "../util";
import { InstanceConfig } from "./InstanceConfig";
import { InstancesList } from "./InstanceList";
import shortid from "shortid";

export function InstancesPage({ resetToken }) {
	const context = useContext(CompanionContext)
	const [helpContent, setHelpContent] = useState(null)
	const [selectedInstance, setSelectedInstance] = useState([null, shortid()])

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
				setHelpContent([name, result])
			} else {
				setHelpContent(null)
			}
		})
	}, [context.socket])
	const closeHelp = useCallback(() => setHelpContent(null), [])

	const configureInstance = useCallback((id) => {
		console.log('configureInstance', id)
		setSelectedInstance([id, shortid()])
	}, [])

	return (
		<CRow className='instances-page'>
			<HelpModal content={helpContent} hide={closeHelp} />

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