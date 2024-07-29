import React, { FormEvent, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
	CAlert,
	CButton,
	CCol,
	CForm,
	CFormInput,
	CFormSwitch,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigGridSize, UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'

interface GridConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const GridConfig = observer(function GridConfig({ config, setValue, resetValue }: GridConfigProps) {
	const gridSizeRef = useRef<GridSizeModalRef>(null)

	const editGridSize = useCallback(() => {
		gridSizeRef.current?.show()
	}, [])

	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					Button Grid
					<GridSizeModal ref={gridSizeRef} />
				</th>
			</tr>

			{config.gridSize && (
				<tr>
					<td>Grid Size</td>
					<td colSpan={2} style={{ textAlign: 'center' }}>
						<div>
							{config.gridSize?.maxRow - config.gridSize?.minRow + 1} rows x{' '}
							{config.gridSize?.maxColumn - config.gridSize?.minColumn + 1} columns
						</div>
						<CButton onClick={editGridSize} color="secondary" size="sm" style={{ marginTop: 4 }}>
							Edit size
						</CButton>
					</td>
				</tr>
			)}

			<tr>
				<td>
					<em>Current minimum</em>
				</td>
				<td colSpan={2} style={{ textAlign: 'center' }}>
					<div className="">
						{config.gridSize?.minRow} rows x {config.gridSize?.minColumn} columns
					</div>
				</td>
				<td></td>
			</tr>
			<tr>
				<td>
					<em>Current maximums</em>
				</td>
				<td colSpan={2} style={{ textAlign: 'center' }}>
					<div className="">
						{config.gridSize?.maxRow} rows x {config.gridSize?.maxColumn} columns
					</div>
				</td>
				<td></td>
			</tr>

			<tr>
				<td>Allow expanding in grid view</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.gridSizeInlineGrow}
						size="xl"
						onChange={(e) => setValue('gridSizeInlineGrow', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('gridSizeInlineGrow')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>
		</>
	)
})

interface GridSizeModalProps {
	// Nothing
}
interface GridSizeModalRef {
	show(): void
}

const GridSizeModal = observer<GridSizeModalProps, GridSizeModalRef>(
	function GridSizeModal(_props, ref) {
		const { userConfig, socket } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)

		const [newGridSize, setNewGridSize] = useState<UserConfigGridSize | null>(null)

		const buttonRef = useRef<HTMLButtonElement | null>(null)

		const buttonFocus = () => {
			setTimeout(() => {
				if (buttonRef.current) {
					buttonRef.current.focus()
				}
			}, 500)
		}

		const doClose = useCallback(() => {
			setShow(false)

			// Delay clearing the data so the modal can animate out
			setTimeout(() => {
				setNewGridSize(null)
			}, 1500)
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
					if (!oldGridSize && userConfig.properties) return userConfig.properties.gridSize
					return oldGridSize
				})
			}
		}, [show, userConfig])

		const setMinColumn = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
		const setMaxColumn = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
		const setMinRow = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
		const setMaxRow = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
			userConfig?.properties?.gridSize &&
			(newGridSize.minColumn > userConfig.properties.gridSize.minColumn ||
				newGridSize.maxColumn < userConfig.properties.gridSize.maxColumn ||
				newGridSize.minRow > userConfig.properties.gridSize.minRow ||
				newGridSize.maxRow < userConfig.properties.gridSize.maxRow)

		return (
			<CModal visible={show} onClose={doClose} onShow={buttonFocus}>
				<CModalHeader closeButton>
					<h5>Configure Grid Size</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={doAction} className="row">
						{newGridSize && (
							<CCol sm={12}>
								New Grid Size: {newGridSize.maxRow - newGridSize.minRow + 1} rows x{' '}
								{newGridSize.maxColumn - newGridSize.minColumn + 1} columns
							</CCol>
						)}
						<CCol sm={12}>
							<CFormInput
								label="Min Row"
								type="number"
								value={newGridSize?.minRow}
								max={0}
								step={1}
								onChange={setMinRow}
							/>
						</CCol>
						<CCol sm={12}>
							<CFormInput
								label="Max Row"
								type="number"
								value={newGridSize?.maxRow}
								min={0}
								step={1}
								onChange={setMaxRow}
							/>
						</CCol>
						<CCol sm={12}>
							<CFormInput
								label="Min Column"
								type="number"
								value={newGridSize?.minColumn}
								max={0}
								step={1}
								onChange={setMinColumn}
							/>
						</CCol>
						<CCol sm={12}>
							<CFormInput
								label="Max Column"
								type="number"
								value={newGridSize?.maxColumn}
								min={0}
								step={1}
								onChange={setMaxColumn}
							/>
						</CCol>
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
					<CButton ref={buttonRef} color="primary" onClick={doAction}>
						Save
					</CButton>
				</CModalFooter>
			</CModal>
		)
	},
	{ forwardRef: true }
)
