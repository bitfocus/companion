import { CCol, CRow } from "@coreui/react";
import { useCallback, useContext, useRef } from "react";
import { HelpModal } from "./HelpModal";
import { CompanionContext, socketEmit } from "../util";
import { InstancesList } from "./InstanceList";

export function InstancesPage({ resetToken }) {
	const context = useContext(CompanionContext)
	const helpModalRef = useRef()

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

	return (
		<CRow className='instances-page'>
			<HelpModal ref={helpModalRef} />

			<CCol xl={6} className='instances-panel'>
				<InstancesList showHelp={showHelp} />
			</CCol>
			<CCol xl={6} className='instances-panel'>
				<p> TODO - add bits will go here</p>
			</CCol>
		</CRow>
	)
}