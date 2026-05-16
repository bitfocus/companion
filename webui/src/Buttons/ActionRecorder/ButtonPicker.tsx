import { CCol, CForm, CFormLabel, CRow } from '@coreui/react'
import { faHome } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'
import type { LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation, DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { useHasBeenRendered } from '~/Hooks/useHasBeenRendered.js'
import { usePagePicker } from '~/Hooks/usePagePicker.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ButtonGridHeader } from '../ButtonGridHeader.js'
import { ButtonGridIcon, ButtonInfiniteGrid, type ButtonInfiniteGridRef } from '../ButtonInfiniteGrid.js'

interface ButtonPickerProps {
	selectButton: (
		selectedControl: string,
		selectedStep: string,
		selectedSet: ActionSetId,
		mode: 'replace' | 'append'
	) => void
}
export const ButtonPicker = observer(function ButtonPicker({ selectButton }: ButtonPickerProps) {
	const { pages, userConfig } = useContext(RootAppStoreContext)

	const { pageNumber, setPageNumber, changePage } = usePagePicker(pages.data.length, 1)

	const [selectedLocation, setSelectedLocation] = useState<ControlLocation | null>(null)
	const [selectedStep, setSelectedStep] = useState<string | null>(null)
	const [selectedSet, setSelectedSet] = useState<ActionSetId | null>(null)

	const buttonClick = useCallback((location: ControlLocation, pressed: boolean) => {
		if (pressed) setSelectedLocation(location)
	}, [])

	const selectedControl = selectedLocation
		? pages.getControlIdAt(pageNumber, selectedLocation.row, selectedLocation.column)
		: undefined

	// Reset set when control is changed
	useEffect(() => setSelectedSet(null), [selectedControl])

	const replaceActions = useCallback(() => {
		if (selectedControl && selectedStep && selectedSet)
			selectButton(selectedControl, selectedStep, selectedSet, 'replace')
	}, [selectedControl, selectedStep, selectedSet, selectButton])
	const appendActions = useCallback(() => {
		if (selectedControl && selectedStep && selectedSet)
			selectButton(selectedControl, selectedStep, selectedSet, 'append')
	}, [selectedControl, selectedStep, selectedSet, selectButton])

	const { controlConfig: rawControlConfig } = useControlConfig(selectedControl)
	const controlInfo: LayeredButtonModel | null =
		rawControlConfig?.config.type === 'button-layered' ? rawControlConfig.config : null

	const actionStepOptions = useMemo(() => {
		switch (controlInfo?.type) {
			case 'button-layered':
				return Object.keys(controlInfo.steps || {}).map((stepId) => ({
					id: stepId,
					label: `Step ${Number(stepId) + 1}`,
				}))
			default:
				return []
		}
	}, [controlInfo?.type, controlInfo?.steps])

	const selectedStepInfo = selectedStep ? controlInfo?.steps?.[selectedStep] : null
	const actionSetOptions = useMemo(() => {
		switch (controlInfo?.type) {
			case 'button-layered': {
				const sets: DropdownChoice[] = [
					{
						id: 'down',
						label: 'Press',
					},
					{
						id: 'up',
						label: 'Release',
					},
				]

				if (selectedStepInfo?.action_sets?.['rotate_left'] || selectedStepInfo?.action_sets?.['rotate_right']) {
					sets.unshift(
						{
							id: 'rotate_left',
							label: 'Rotate left',
						},
						{
							id: 'rotate_right',
							label: 'Rotate right',
						}
					)
				}

				const candidate_sets = Object.keys(selectedStepInfo?.action_sets || {})
					.map((id) => Number(id))
					.filter((id) => !isNaN(id))
				candidate_sets.sort((a, b) => a - b)

				for (const set of candidate_sets) {
					sets.push({
						id: set,
						label: `Release after ${set}ms`,
					})
				}

				return sets
			}
			default:
				return []
		}
	}, [controlInfo?.type, selectedStepInfo])

	useEffect(() => {
		setSelectedStep((oldStep) => {
			if (actionStepOptions.find((opt) => opt.id === oldStep)) {
				return oldStep
			} else {
				return actionStepOptions[0]?.id
			}
		})
	}, [actionStepOptions])

	useEffect(() => {
		setSelectedSet((oldSet) => {
			if (actionSetOptions.find((opt) => opt.id === oldSet)) {
				return oldSet
			} else {
				return (actionSetOptions[0]?.id ?? null) as ActionSetId | null
			}
		})
	}, [actionSetOptions])

	const gridSize = userConfig.properties?.gridSize

	const [hasBeenInView, isInViewRef] = useHasBeenRendered()

	const gridRef = useRef<ButtonInfiniteGridRef>(null)
	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

	return (
		<>
			<ButtonGridHeader pageNumber={pageNumber} changePage={changePage} setPage={setPageNumber}>
				<Button color="light" onClick={resetPosition}>
					<FontAwesomeIcon icon={faHome} /> Home Position
				</Button>
			</ButtonGridHeader>
			<div className="buttongrid" ref={isInViewRef}>
				{hasBeenInView && gridSize && (
					<ButtonInfiniteGrid
						ref={gridRef}
						buttonClick={buttonClick}
						pageNumber={pageNumber}
						selectedButton={selectedLocation}
						gridSize={gridSize}
						ButtonIconFactory={ButtonGridIcon}
						drawScale={1} // TODO
					/>
				)}
			</div>
			<div>
				<CForm className="flex-form" onSubmit={PreventDefaultHandler}>
					<CRow>
						<CCol sm={10} xs={9} hidden={actionStepOptions.length <= 1}>
							<CFormLabel>Step</CFormLabel>

							<SimpleDropdownInputField
								choices={actionStepOptions}
								value={selectedStep ?? ''}
								setValue={setSelectedStep as (val: DropdownChoiceId) => void}
								disabled={!controlInfo}
							/>
						</CCol>
						<CCol sm={10} xs={9} hidden={actionSetOptions.length === 0}>
							<CFormLabel>Action Group</CFormLabel>

							<SimpleDropdownInputField
								choices={actionSetOptions}
								value={selectedSet ?? ''}
								setValue={setSelectedSet as (val: DropdownChoiceId) => void}
								disabled={!controlInfo}
							/>
						</CCol>
						<CCol className="py-1" sm={10} xs={9}>
							<ButtonGroup>
								<Button
									color="primary"
									title="Replace all the actions on the trigger"
									disabled={!selectedControl || !selectedSet}
									onClick={replaceActions}
								>
									Replace
								</Button>
								<Button
									color="info"
									title="Append to the existing actions"
									disabled={!selectedControl || !selectedSet}
									onClick={appendActions}
								>
									Append
								</Button>
							</ButtonGroup>
						</CCol>
					</CRow>
				</CForm>
			</div>
		</>
	)
})
