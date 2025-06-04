import React, { FormEvent, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CAlert, CButton, CCol, CForm, CFormInput, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigProps } from '../Components/Common.js'
import { UserConfigStaticTextRow } from '../Components/UserConfigStaticTextRow.js'

export const GridConfig = observer(function GridConfig(props: UserConfigProps) {
	const gridSizeRef = useRef<GridSizeModalRef>(null)

	const editGridSize = useCallback(() => {
		gridSizeRef.current?.show()
	}, [])

	return (
		<>
			<GridSizeModal ref={gridSizeRef} />
			<UserConfigHeadingRow label="Button Grid" />

			<UserConfigStaticTextRow
				label="Grid Size"
				text={
					<>
						<div>
							{props.config.gridSize.maxRow - props.config.gridSize.minRow + 1} rows x{' '}
							{props.config.gridSize.maxColumn - props.config.gridSize.minColumn + 1} columns
						</div>
						<CButton onClick={editGridSize} color="secondary" size="sm" style={{ marginTop: 4 }}>
							Edit size
						</CButton>
					</>
				}
			/>
			<UserConfigStaticTextRow
				label={<em>Current grid rows</em>}
				text={`${props.config.gridSize.minRow} to ${props.config.gridSize.maxRow}`}
			/>
			<UserConfigStaticTextRow
				label={<em>Current grid columns</em>}
				text={`${props.config.gridSize.minColumn} to ${props.config.gridSize.maxColumn}`}
			/>

			<UserConfigSwitchRow userConfig={props} label="Allow expanding in grid view" field="gridSizeInlineGrow" />

			<UserConfigSwitchRow
				userConfig={props}
				label="Prompt to expand grid when attaching new surface"
				field="gridSizePromptGrow"
			/>
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
