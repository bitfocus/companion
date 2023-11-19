import React, {
	FormEvent,
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react'
import {
	CAlert,
	CButton,
	CForm,
	CFormGroup,
	CInput,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faUndo } from '@fortawesome/free-solid-svg-icons'
import CSwitch from '../CSwitch'
import { SocketContext, UserConfigContext } from '../util'
import type { UserConfigGridSize, UserConfigModel } from '@companion/shared/Model/UserConfigModel'

interface GridConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export function GridConfig({ config, setValue, resetValue }: GridConfigProps) {
	const gridSizeRef = useRef<GridSizeModalRef>(null)

	const editGridSize = useCallback(() => {
		gridSizeRef.current?.show()
	}, [])

	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Grid
					<GridSizeModal ref={gridSizeRef} />
				</th>
			</tr>

			<tr>
				<td>Min Column</td>
				<td>
					<div className="form-check form-check-inline mr-1">{config.gridSize?.minColumn}</div>
				</td>
				<td></td>
			</tr>
			<tr>
				<td>Max Column</td>
				<td>
					<div className="form-check form-check-inline mr-1">{config.gridSize?.maxColumn}</div>
				</td>
				<td></td>
			</tr>
			<tr>
				<td>Min Row</td>
				<td>
					<div className="form-check form-check-inline mr-1">{config.gridSize?.minRow}</div>
				</td>
				<td></td>
			</tr>
			<tr>
				<td>Max Row</td>
				<td>
					<div className="form-check form-check-inline mr-1">{config.gridSize?.maxRow}</div>
				</td>
				<td></td>
			</tr>
			<tr>
				<td></td>
				<td colSpan={2}>
					<div className="form-check form-check-inline mr-1">
						<CButton onClick={editGridSize} color="success">
							<FontAwesomeIcon icon={faCog} />
							&nbsp;Edit Grid Size
						</CButton>
					</div>
				</td>
			</tr>
			<tr>
				<td>Allow expanding in grid view</td>
				<td>
					<div className="form-check form-check-inline mr-1 float-right">
						<CSwitch
							color="success"
							checked={config.gridSizeInlineGrow}
							size={'lg'}
							onChange={(e) => setValue('gridSizeInlineGrow', e.currentTarget.checked)}
						/>
					</div>
				</td>
				<td>
					<CButton onClick={() => resetValue('gridSizeInlineGrow')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
}

interface GridSizeModalProps {
	// Nothing
}
interface GridSizeModalRef {
	show(): void
}

const GridSizeModal = forwardRef<GridSizeModalRef, GridSizeModalProps>(function GridSizeModal(_props, ref) {
	const socket = useContext(SocketContext)
	const userConfig = useContext(UserConfigContext)
	const [show, setShow] = useState(false)

	const [newGridSize, setNewGridSize] = useState<UserConfigGridSize | null>(null)

	const buttonRef = useRef<HTMLElement>()

	const buttonFocus = () => {
		if (buttonRef.current) {
			buttonRef.current.focus()
		}
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setNewGridSize(null)
	}, [])
	const doAction = useCallback(
		(e: FormEvent) => {
			if (e) e.preventDefault()

			setShow(false)
			setNewGridSize(null)

			if (!newGridSize) return

			console.log('set gridSize', newGridSize)
			socket.emit('set_userconfig_key', 'gridSize', newGridSize)
		},
		[socket, newGridSize]
	)

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[]
	)

	useEffect(() => {
		if (show) {
			setNewGridSize((oldGridSize) => {
				if (!oldGridSize && userConfig) return userConfig.gridSize
				return oldGridSize
			})
		}
	}, [show, userConfig])

	const setMinColumn = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						minColumn: newValue,
				  }
				: null
		)
	}, [])
	const setMaxColumn = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						maxColumn: newValue,
				  }
				: null
		)
	}, [])
	const setMinRow = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						minRow: newValue,
				  }
				: null
		)
	}, [])
	const setMaxRow = useCallback((e) => {
		const newValue = Number(e.currentTarget.value)
		setNewGridSize((oldSize) =>
			oldSize
				? {
						...oldSize,
						maxRow: newValue,
				  }
				: null
		)
	}, [])

	const isReducingSize =
		newGridSize &&
		userConfig?.gridSize &&
		(newGridSize.minColumn > userConfig.gridSize.minColumn ||
			newGridSize.maxColumn < userConfig.gridSize.maxColumn ||
			newGridSize.minRow > userConfig.gridSize.minRow ||
			newGridSize.maxRow < userConfig.gridSize.maxRow)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
			<CModalHeader closeButton>
				<h5>Configure Grid Size</h5>
			</CModalHeader>
			<CModalBody>
				<CForm onSubmit={doAction}>
					<CFormGroup>
						<CLabel>Min Column</CLabel>
						<CInput type="number" value={newGridSize?.minColumn} max={0} step={1} onChange={setMinColumn} />
					</CFormGroup>
					<CFormGroup>
						<CLabel>Max Column</CLabel>
						<CInput type="number" value={newGridSize?.maxColumn} min={0} step={1} onChange={setMaxColumn} />
					</CFormGroup>
					<CFormGroup>
						<CLabel>Min Row</CLabel>
						<CInput type="number" value={newGridSize?.minRow} max={0} step={1} onChange={setMinRow} />
					</CFormGroup>
					<CFormGroup>
						<CLabel>Max Row</CLabel>
						<CInput type="number" value={newGridSize?.maxRow} min={0} step={1} onChange={setMaxRow} />
					</CFormGroup>
				</CForm>
				{isReducingSize && (
					<CAlert color="danger">
						By reducing the grid size, any buttons outside of the new boundaries will be deleted.
					</CAlert>
				)}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton innerRef={buttonRef} color="primary" onClick={doAction}>
					Save
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
