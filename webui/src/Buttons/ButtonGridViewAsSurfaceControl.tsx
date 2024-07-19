import { CButton } from '@coreui/react'
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { GridViewAsController } from './GridViewAs.js'

export interface ButtonGridViewAsSurfaceControlProps {
	gridViewAsController: GridViewAsController
}

export const ButtonGridViewAsSurfaceControl = observer(function ButtonGridViewAsSurfaceControl({
	gridViewAsController,
}: ButtonGridViewAsSurfaceControlProps) {
	if (gridViewAsController.enabled) {
		return (
			<CButton
				color="primary"
				onClick={() => gridViewAsController.setEnabled(false)}
				title="View Full Grid"
				className="btn-right"
			>
				<FontAwesomeIcon icon={faEye} />
			</CButton>
		)
	} else {
		return (
			<CButton
				color="light"
				onClick={() => gridViewAsController.setEnabled(true)}
				title="View As Surface"
				className="btn-right"
			>
				<FontAwesomeIcon icon={faEyeSlash} />
			</CButton>
		)
	}
})
