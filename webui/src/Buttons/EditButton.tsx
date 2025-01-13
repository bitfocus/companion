import {
	CDropdown,
	CDropdownToggle,
	CDropdownItem,
	CDropdownMenu,
	CButton,
	CButtonGroup,
	CModalHeader,
	CModalBody,
	CModalFooter,
	CForm,
	CFormLabel,
	CFormInput,
	CNavItem,
	CNavLink,
	CNav,
	CCol,
	CFormSwitch,
} from '@coreui/react'
import {
	faChevronLeft,
	faChevronRight,
	faCopy,
	faPencil,
	faPlay,
	faPlus,
	faRedo,
	faTrash,
	faTrashAlt,
	faUndo,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, {
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
	useMemo,
	FormEvent,
} from 'react'
import { nanoid } from 'nanoid'
import { ButtonPreviewBase } from '../Components/ButtonPreview.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { KeyReceiver, LoadingRetryOrError, SocketContext, MyErrorBoundary } from '../util.js'
import { ControlEntitiesEditor } from '../Controls/EntitiesEditor.js'
import jsonPatch from 'fast-json-patch'
import { ButtonStyleConfig } from '../Controls/ButtonStyleConfig.js'
import { ControlOptionsEditor } from '../Controls/ControlOptionsEditor.js'
import { cloneDeep } from 'lodash-es'
import { GetStepIds } from '@companion-app/shared/Controls.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ActionSetId, ActionSetsModel, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import { NormalButtonSteps, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { CModalExt } from '../Components/CModalExt.js'
import { EntityModelType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'

interface EditButtonProps {
	location: ControlLocation
	onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export const EditButton = observer(function EditButton({ location, onKeyUp }: EditButtonProps) {
	const { socket, pages } = useContext(RootAppStoreContext)

	const controlId = pages.getControlIdAtLocation(location)

	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const [previewImage, setPreviewImage] = useState<string | null>(null)
	const [config, setConfig] = useState<SomeButtonModel | null | false>(null)
	const [runtimeProps, setRuntimeProps] = useState<Record<string, any> | null | false>(null)

	const configRef = useRef<SomeButtonModel>()
	configRef.current = config || undefined // update the ref every render

	const [configError, setConfigError] = useState<string | null>(null)

	const [reloadConfigToken, setReloadConfigToken] = useState(nanoid())

	useEffect(() => {
		if (!controlId) {
			setConfig(false)
			setRuntimeProps({})
			setConfigError(null)
			setPreviewImage(null)

			return
		}

		setConfig(null)
		setConfigError(null)
		setPreviewImage(null)
		setRuntimeProps(null)

		socket
			.emitPromise('controls:subscribe', [controlId])
			.then((config) => {
				console.log(config)
				setConfig((config as any)?.config ?? false)
				setRuntimeProps(config?.runtime ?? {})
				setConfigError(null)
			})
			.catch((e) => {
				console.error('Failed to load control config', e)
				setConfig(null)
				setConfigError('Failed to load control config')
			})

		const unsubConfig = socket.on(`controls:config-${controlId}`, (patch) => {
			setConfig((oldConfig) => {
				if (!oldConfig) return oldConfig
				if (patch === false) {
					return false
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig), patch).newDocument
				}
			})
		})
		const unsubRuntimeProps = socket.on(`controls:runtime-${controlId}`, (patch) => {
			setRuntimeProps((oldProps) => {
				if (!oldProps) return oldProps
				if (patch === false) {
					return {}
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldProps), patch).newDocument
				}
			})
		})

		const unsubPreview = socket.on(`controls:preview-${controlId}`, (img) => {
			setPreviewImage(img)
		})

		return () => {
			unsubConfig()
			unsubRuntimeProps()
			unsubPreview()

			socket.emitPromise('controls:unsubscribe', [controlId]).catch((e) => {
				console.error('Failed to unsubscribe bank config', e)
			})
		}
	}, [socket, controlId, reloadConfigToken])

	const setButtonType = useCallback(
		(newType: string) => {
			let show_warning = false

			const currentType = configRef.current?.type
			if (currentType === newType) {
				// No point changing style to itself
				return
			}

			if (currentType && currentType !== 'pageup' && currentType !== 'pagedown' && currentType !== 'pagenum') {
				if (newType === 'pageup' || newType === 'pagedown' || newType === 'pagenum') {
					show_warning = true
				}
			}

			const doChange = () => {
				socket.emitPromise('controls:reset', [location, newType]).catch((e) => {
					console.error(`Set type failed: ${e}`)
				})
			}

			if (show_warning) {
				resetModalRef.current?.show(
					`Change style`,
					`Changing to this button style will erase actions and feedbacks configured for this button - continue?`,
					'OK',
					() => {
						doChange()
					}
				)
			} else {
				doChange()
			}
		},
		[socket, location, configRef]
	)

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])
	const clearButton = useCallback(() => {
		resetModalRef.current?.show(
			`Clear button ${formatLocation(location)}`,
			`This will clear the style, feedbacks and all actions`,
			'Clear',
			() => {
				socket.emitPromise('controls:reset', [location]).catch((e) => {
					console.error(`Reset failed: ${e}`)
				})
			}
		)
	}, [socket, location])

	const hotPressDown = useCallback(() => {
		socket
			.emitPromise('controls:hot-press', [location, true, 'edit'])
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [socket, location])
	const hotPressUp = useCallback(() => {
		socket
			.emitPromise('controls:hot-press', [location, false, 'edit'])
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [socket, location])
	const hotRotateLeft = useCallback(() => {
		socket
			.emitPromise('controls:hot-rotate', [location, false, 'edit'])
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [socket, location])
	const hotRotateRight = useCallback(() => {
		socket
			.emitPromise('controls:hot-rotate', [location, true, 'edit'])
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [socket, location])

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const hasConfig = !!config || config === false
	const hasRuntimeProps = !!runtimeProps || runtimeProps === false
	const dataReady = !loadError && hasConfig && hasRuntimeProps

	// Tip: This query needs to match the page layout. It doesn't need to be reactive, as the useElementSize will force a re-render
	// const isTwoColumn = window.matchMedia('(min-width: 1200px)').matches
	// const [, { height: hintHeight }] = useElementSize()

	return (
		<KeyReceiver onKeyUp={onKeyUp} tabIndex={0} className="edit-button-panel flex-form">
			<GenericConfirmModal ref={resetModalRef} />
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
			{hasConfig && dataReady && (
				<>
					<CCol sm={12}>
						<ButtonPreviewBase fixedSize preview={previewImage} right={true} />
						{(!config || config.type === undefined) && (
							<MyErrorBoundary>
								{' '}
								<CDropdown className="" style={{ display: 'inline-block', marginRight: -4, position: 'inherit' }}>
									<CButtonGroup>
										{/* This could be simplified to use the split property on CDropdownToggle, but then onClick doesnt work https://github.com/coreui/coreui-react/issues/179 */}
										<CButton color="danger" onClick={() => setButtonType('button')}>
											Create button
										</CButton>
										<CDropdownToggle
											caret
											color="danger"
											style={{ opacity: 0.7, paddingLeft: 14, paddingRight: 16 }}
											className="dropdown-toggle dropdown-toggle-split"
										>
											<span className="sr-only">Toggle Dropdown</span>
										</CDropdownToggle>
									</CButtonGroup>
									<CDropdownMenu>
										<CDropdownItem onClick={() => setButtonType('button')}>Regular button</CDropdownItem>
										<CDropdownItem onClick={() => setButtonType('pageup')}>Page up</CDropdownItem>
										<CDropdownItem onClick={() => setButtonType('pagenum')}>Page number</CDropdownItem>
										<CDropdownItem onClick={() => setButtonType('pagedown')}>Page down</CDropdownItem>
									</CDropdownMenu>
								</CDropdown>
							</MyErrorBoundary>
						)}
						&nbsp;
						<MyErrorBoundary>
							<CButton color="danger" hidden={!config} onClick={clearButton} title="Clear Button">
								<FontAwesomeIcon icon={faTrashAlt} />
							</CButton>
							&nbsp;
							<CButtonGroup>
								<CButton
									color="warning"
									hidden={!config || config.type !== 'button'}
									onMouseDown={hotPressDown}
									onMouseUp={hotPressUp}
									style={{ color: 'white' }}
									title="Test press button"
								>
									<FontAwesomeIcon icon={faPlay} />
									&nbsp;Test
								</CButton>
							</CButtonGroup>{' '}
						</MyErrorBoundary>
						&nbsp;
						{config && 'options' in config && config?.options?.rotaryActions && (
							<MyErrorBoundary>
								<CButton
									color="warning"
									onMouseDown={hotRotateLeft}
									style={{ color: 'white' }}
									title="Test rotate left"
								>
									<FontAwesomeIcon icon={faUndo} />
								</CButton>
								&nbsp;
								<CButton
									color="warning"
									onMouseDown={hotRotateRight}
									style={{ color: 'white' }}
									title="Test rotate right"
								>
									<FontAwesomeIcon icon={faRedo} />
								</CButton>
							</MyErrorBoundary>
						)}
						{!config && (
							<>
								<h4>Empty button</h4>
								<p className="mt-3">
									To get started, click button above to create a regular button, or use the drop down to make a special
									button.
								</p>
							</>
						)}
					</CCol>
					{controlId && config && (
						<MyErrorBoundary>
							<ButtonStyleConfig
								controlType={config.type}
								style={'style' in config ? config.style : undefined}
								configRef={configRef}
								controlId={controlId}
								mainDialog
							/>
						</MyErrorBoundary>
					)}
					{controlId && config && config.type === 'button' && (
						<>
							<MyErrorBoundary>
								<div style={{ marginLeft: '5px' }}>
									<ControlOptionsEditor
										controlType={config.type}
										options={config.options}
										configRef={configRef}
										controlId={controlId}
									/>
								</div>
							</MyErrorBoundary>
							{runtimeProps && (
								<MyErrorBoundary>
									<TabsSection
										style={config.type}
										location={location}
										controlId={controlId}
										steps={config.steps || {}}
										runtimeProps={runtimeProps}
										rotaryActions={config?.options?.rotaryActions}
										feedbacks={config.feedbacks}
									/>
								</MyErrorBoundary>
							)}
						</>
					)}
				</>
			)}
		</KeyReceiver>
	)
})

interface TabsSectionProps {
	style: 'button' | 'pageup' | 'pagenum' | 'pagedown'
	controlId: string
	location: ControlLocation
	steps: NormalButtonSteps
	runtimeProps: Record<string, any>
	rotaryActions: boolean
	feedbacks: SomeEntityModel[]
}

function TabsSection({ style, controlId, location, steps, runtimeProps, rotaryActions, feedbacks }: TabsSectionProps) {
	const socket = useContext(SocketContext)

	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const tabsScrollRef = useRef<HTMLDivElement>()

	const setTabsRef = useCallback((ref: HTMLDivElement | null) => {
		tabsScrollRef.current = ref ?? undefined
	}, [])

	const clickSelectedStep = useCallback((newStep: string) => {
		setSelectedStep(newStep)

		// Let's reactivate this again if users start setting cars on fire because I removed it. -wv
		/* 
		if (tabsScrollRef.current) {
			tabsScrollRef.current.scrollIntoView({
				block: 'start',
				inline: 'nearest',
				behavior: 'smooth',
			})
		}
		*/
	}, [])

	const keys = useMemo(() => GetStepIds(steps), [steps])
	const [selectedStep, setSelectedStep] = useState(keys.length ? `step:${keys[0]}` : 'feedbacks')

	useEffect(() => {
		const keys2 = keys.map((k) => `step:${k}`)
		keys2.push('feedbacks')

		if (!keys2.includes(selectedStep)) {
			setSelectedStep(keys2[0])
		}
	}, [keys, selectedStep])

	const appendStep = useCallback(
		(e: FormEvent) => {
			if (e) e.preventDefault()

			socket
				.emitPromise('controls:step:add', [controlId])
				.then((newStep) => {
					if (newStep) {
						setSelectedStep(`step:${newStep}`)
						setTimeout(() => setSelectedStep(`step:${newStep}`), 500)
					}
				})
				.catch((e) => {
					console.error('Failed to append step:', e)
				})
		},
		[socket, controlId]
	)
	const removeStep = useCallback(
		(stepId: string) => {
			confirmRef.current?.show('Remove step', 'Are you sure you wish to remove this step?', 'Remove', () => {
				socket.emitPromise('controls:step:remove', [controlId, stepId]).catch((e) => {
					console.error('Failed to delete step:', e)
				})
			})
		},
		[socket, controlId]
	)
	const duplicateStep = useCallback(
		(stepId: string) => {
			socket.emitPromise('controls:step:duplicate', [controlId, stepId]).catch((e) => {
				console.error('Failed to duplicate step:', e)
			})
		},
		[socket, controlId]
	)
	const swapSteps = useCallback(
		(stepId1: string, stepId2: string) => {
			socket
				.emitPromise('controls:step:swap', [controlId, stepId1, stepId2])
				.then(() => {
					setSelectedStep(`step:${stepId2}`)
				})
				.catch((e) => {
					console.error('Failed to swap steps:', e)
				})
		},
		[socket, controlId]
	)
	const setCurrentStep = useCallback(
		(stepId: string) => {
			socket.emitPromise('controls:step:set-current', [controlId, stepId]).catch((e) => {
				console.error('Failed to set step:', e)
			})
		},
		[socket, controlId]
	)

	const appendSet = useCallback(
		(stepId: string) => {
			socket.emitPromise('controls:action-set:add', [controlId, stepId]).catch((e) => {
				console.error('Failed to append set:', e)
			})
		},
		[socket, controlId]
	)
	const removeSet = useCallback(
		(stepId: string, setId: ActionSetId) => {
			confirmRef.current?.show('Remove set', 'Are you sure you wish to remove this group?', 'Remove', () => {
				socket.emitPromise('controls:action-set:remove', [controlId, stepId, setId]).catch((e) => {
					console.error('Failed to delete set:', e)
				})
			})
		},
		[socket, controlId]
	)

	if (style === 'button') {
		const selectedIndex = keys.findIndex((k) => `step:${k}` === selectedStep)
		const selectedKey = selectedIndex >= 0 && keys[selectedIndex]
		const selectedStep2 = selectedKey ? steps[selectedKey] : undefined

		return (
			<div key="button">
				<GenericConfirmModal ref={confirmRef} />

				<div ref={setTabsRef} className={'row-heading'}>
					<CNav variant="tabs">
						{keys.map((stepId, i) => (
							<ActionSetTab
								key={stepId}
								controlId={controlId}
								stepId={stepId}
								stepIndex={i}
								stepOptions={steps[stepId]?.options}
								moreThanOneStep={keys.length > 1}
								isCurrent={runtimeProps.current_step_id === stepId}
								isActiveAndCurrent={
									stepId.toString() === selectedIndex.toString() && runtimeProps.current_step_id === stepId
								}
								active={selectedStep === `step:${stepId}`}
								onClick={() => clickSelectedStep(`step:${stepId}`)}
							/>
						))}

						<CNavItem key="feedbacks" className="nav-steps-special">
							<CNavLink active={selectedStep === 'feedbacks'} onClick={() => clickSelectedStep('feedbacks')}>
								Feedbacks
							</CNavLink>
						</CNavItem>
						{keys.length === 1 && (
							<div className="nav-last">
								<CButton title="Add step" size="sm" onClick={appendStep}>
									<FontAwesomeIcon icon={faPlus} />
								</CButton>
								<CButton title="Duplicate step" size="sm" onClick={() => duplicateStep(keys[0])}>
									<FontAwesomeIcon icon={faCopy} />
								</CButton>
							</div>
						)}
					</CNav>
				</div>

				<div
					className="edit-sticky-body"
					style={
						{
							// minHeight: `calc(${contentHeight - tabsHeight}px - 1rem`,
						}
					}
				>
					<p></p>
					{selectedStep === 'feedbacks' && (
						<div>
							{/* Wrap the entity-category, for :first-child to work */}
							<MyErrorBoundary>
								<ControlEntitiesEditor
									heading="Feedbacks"
									controlId={controlId}
									entities={feedbacks}
									location={location}
									listId="feedbacks"
									entityType={EntityModelType.Feedback}
									entityTypeLabel="feedback"
									onlyFeedbackType={null}
								/>
							</MyErrorBoundary>
						</div>
					)}

					{selectedKey && selectedStep && (
						<>
							<CButtonGroup hidden={keys.length === 1}>
								<CButton
									color="danger"
									title="Move step before"
									disabled={selectedIndex === 0}
									onClick={() => swapSteps(selectedKey, keys[selectedIndex - 1])}
								>
									<FontAwesomeIcon icon={faChevronLeft} />
								</CButton>
								<CButton
									color="danger"
									title="Move step after"
									disabled={selectedIndex === keys.length - 1}
									onClick={() => swapSteps(selectedKey, keys[selectedIndex + 1])}
								>
									<FontAwesomeIcon icon={faChevronRight} />
								</CButton>

								<CButton
									color="success"
									style={{ fontWeight: 'bold', opacity: runtimeProps.current_step_id === selectedKey ? 0.3 : 1 }}
									disabled={runtimeProps.current_step_id === selectedKey}
									onClick={() => setCurrentStep(selectedKey)}
								>
									Select
								</CButton>
								<CButton
									style={{ backgroundColor: '#f0f0f0', marginRight: 1 }}
									title="Add step"
									disabled={keys.length === 1}
									onClick={appendStep}
								>
									<FontAwesomeIcon icon={faPlus} />
								</CButton>
								<CButton
									style={{ backgroundColor: '#f0f0f0' }}
									title="Duplicate step"
									onClick={() => duplicateStep(selectedKey)}
								>
									<FontAwesomeIcon icon={faCopy} />
								</CButton>
								<CButton
									style={{ backgroundColor: '#f0f0f0' }}
									title="Delete step"
									disabled={keys.length === 1}
									onClick={() => removeStep(selectedKey)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</CButton>
							</CButtonGroup>

							<div>
								{/* Wrap the entity-category, for :first-child to work */}

								{rotaryActions && selectedStep2 && (
									<>
										<MyErrorBoundary>
											<ControlEntitiesEditor
												heading="Rotate left actions"
												controlId={controlId}
												location={location}
												listId={{ stepId: selectedKey, setId: 'rotate_left' }}
												// addPlaceholder="+ Add rotate left action"
												entities={selectedStep2.action_sets['rotate_left']}
												entityType={EntityModelType.Action}
												entityTypeLabel="action"
												onlyFeedbackType={null}
											/>
										</MyErrorBoundary>

										<MyErrorBoundary>
											<ControlEntitiesEditor
												heading="Rotate right actions"
												controlId={controlId}
												location={location}
												listId={{ stepId: selectedKey, setId: 'rotate_right' }}
												// addPlaceholder="+ Add rotate right action"
												entities={selectedStep2.action_sets['rotate_right']}
												entityType={EntityModelType.Action}
												entityTypeLabel="action"
												onlyFeedbackType={null}
											/>
										</MyErrorBoundary>
									</>
								)}

								{selectedStep2 && (
									<div className="mt-10">
										<MyErrorBoundary>
											<ControlEntitiesEditor
												heading={`Press actions`}
												controlId={controlId}
												location={location}
												listId={{ stepId: selectedKey, setId: 'down' }}
												// addPlaceholder={`+ Add press action`}
												entities={selectedStep2.action_sets['down']}
												entityType={EntityModelType.Action}
												entityTypeLabel="action"
												onlyFeedbackType={null}
											/>
										</MyErrorBoundary>

										<EditActionsRelease
											controlId={controlId}
											location={location}
											action_sets={selectedStep2.action_sets}
											stepOptions={selectedStep2.options}
											stepId={selectedKey}
											removeSet={removeSet}
										/>
									</div>
								)}
							</div>

							<br />
							<p>
								<CButton onClick={() => appendSet(selectedKey)} color="primary">
									<FontAwesomeIcon icon={faPlus} /> Add duration group
								</CButton>
							</p>
						</>
					)}
				</div>
			</div>
		)
	} else {
		return <div key="else"></div>
	}
}

interface ActionSetTabProps {
	controlId: string
	stepId: string
	stepIndex: number
	stepOptions: ActionStepOptions | undefined
	// if there's more than one step, we need to show the current step
	moreThanOneStep: boolean
	// the current step is the one that is currently being executed
	isCurrent: boolean
	// both selected and the current step
	isActiveAndCurrent: boolean
	active: boolean
	onClick: () => void
}
function ActionSetTab({
	controlId,
	stepId,
	stepIndex,
	stepOptions,
	moreThanOneStep,
	isCurrent,
	isActiveAndCurrent,
	active,
	onClick,
}: Readonly<ActionSetTabProps>) {
	const socket = useContext(SocketContext)

	let linkClassname: string | undefined = undefined

	const name = stepOptions?.name
	const displayText = name ? name + ` (${stepIndex + 1})` : stepIndex === 0 ? 'Step ' + (stepIndex + 1) : stepIndex + 1

	if (moreThanOneStep) {
		if (isActiveAndCurrent) linkClassname = 'selected-and-active'
		else if (isCurrent) linkClassname = 'only-current'
	}

	const renameStep = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			socket.emitPromise('controls:step:rename', [controlId, stepId, e.target.value]).catch((e) => {
				console.error('Failed to rename step:', e)
			})
		},
		[socket, controlId, stepId]
	)

	const [showInputField, setShowInputField] = useState(false)

	const showField = useCallback(() => setShowInputField(true), [setShowInputField])
	const hideField = useCallback(() => setShowInputField(false), [setShowInputField])
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter' || e.key === 'Escape') {
				setShowInputField(false)
			}
		},
		[setShowInputField]
	)

	return (
		<CNavItem className="nav-steps-special">
			{showInputField ? (
				<CNavLink className={linkClassname}>
					<input
						type="text"
						value={name}
						onChange={renameStep}
						onKeyDown={onKeyDown}
						onBlur={hideField}
						autoFocus
					></input>
				</CNavLink>
			) : (
				<CNavLink onDoubleClick={showField} active={active} onClick={onClick} className={linkClassname}>
					{displayText}
				</CNavLink>
			)}
		</CNavItem>
	)
}

interface EditActionsReleaseProps {
	controlId: string
	location: ControlLocation
	action_sets: ActionSetsModel
	stepOptions: ActionStepOptions
	stepId: string
	removeSet: (stepId: string, setId: ActionSetId) => void
}

function EditActionsRelease({
	controlId,
	location,
	action_sets,
	stepOptions,
	stepId,
	removeSet,
}: EditActionsReleaseProps) {
	const socket = useContext(SocketContext)

	const editRef = useRef<EditDurationGroupPropertiesModalRef>(null)

	const configureSet = useCallback(
		(oldId: string | number) => {
			if (editRef.current) {
				const oldIdNumber = Number(oldId)
				if (isNaN(oldIdNumber)) return

				const runWhileHeld = stepOptions.runWhileHeld.includes(oldIdNumber)
				editRef.current?.show(oldIdNumber, runWhileHeld, (newId: number, runWhileHeld: boolean) => {
					if (!isNaN(newId)) {
						socket
							.emitPromise('controls:action-set:rename', [controlId, stepId, oldIdNumber, newId])
							.then(() => {
								socket
									.emitPromise('controls:action-set:set-run-while-held', [controlId, stepId, newId, runWhileHeld])
									.catch((e) => {
										console.error('Failed to set runWhileHeld:', e)
									})
							})
							.catch((e) => {
								console.error('Failed to rename set:', e)
							})
					}
				})
			}
		},
		[socket, controlId, stepId, stepOptions]
	)

	const candidate_sets = Object.entries(action_sets)
		.map((o): [number, SomeEntityModel[] | undefined] => [Number(o[0]), o[1]])
		.filter(([id]) => !isNaN(id))
	candidate_sets.sort((a, b) => a[0] - b[0])

	const components = candidate_sets.map(([id, actions]) => {
		const runWhileHeld = stepOptions.runWhileHeld.includes(Number(id))
		const ident = runWhileHeld ? `Held for ${id}ms` : `Release after ${id}ms`
		return (
			<MyErrorBoundary key={id}>
				<ControlEntitiesEditor
					key={id}
					heading={`${ident} actions`}
					headingActions={[
						<CButton key="rename" color="white" title="Configure" size="sm" onClick={() => configureSet(id)}>
							<FontAwesomeIcon icon={faPencil} />
						</CButton>,
						<CButton key="delete" color="white" title="Delete step" size="sm" onClick={() => removeSet(stepId, id)}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>,
					]}
					controlId={controlId}
					location={location}
					listId={{ stepId, setId: id }}
					// addPlaceholder={`+ Add ${ident} action`}
					entities={actions}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					onlyFeedbackType={null}
				/>
			</MyErrorBoundary>
		)
	})

	return (
		<>
			<EditDurationGroupPropertiesModal ref={editRef} />

			<MyErrorBoundary>
				<ControlEntitiesEditor
					heading={candidate_sets.length ? 'Short release actions' : 'Release actions'}
					controlId={controlId}
					location={location}
					listId={{ stepId, setId: 'up' }}
					// addPlaceholder={candidate_sets.length ? '+ Add key short release action' : '+ Add key release action'}
					entities={action_sets['up']}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					onlyFeedbackType={null}
				/>
			</MyErrorBoundary>

			{components}
		</>
	)
}

type EditDurationCompleteCallback = (duration: number, whileHeld: boolean) => void

interface EditDurationGroupPropertiesModalRef {
	show(duration: number, whileHeld: boolean, completeCallback: EditDurationCompleteCallback): void
}

interface EditDurationGroupPropertiesModalProps {
	// Nothing
}

const EditDurationGroupPropertiesModal = forwardRef<
	EditDurationGroupPropertiesModalRef,
	EditDurationGroupPropertiesModalProps
>(function EditDurationGroupPropertiesModal(_props, ref) {
	const [data, setData] = useState<[number, EditDurationCompleteCallback] | null>(null)
	const [show, setShow] = useState(false)

	const [newDurationValue, setNewDurationValue] = useState<number | null>(null)
	const [newWhileHeldValue, setNewWhileHeldValue] = useState<boolean | null>(null)

	const buttonRef = useRef<HTMLButtonElement>(null)

	const buttonFocus = () => {
		buttonRef.current?.focus()
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doAction = useCallback(
		(e: FormEvent) => {
			if (e) e.preventDefault()

			setData(null)
			setShow(false)
			setNewDurationValue(null)
			setNewWhileHeldValue(null)

			// completion callback
			const cb = data?.[1]
			if (!cb || newDurationValue === null || newWhileHeldValue === null) return
			cb(newDurationValue, newWhileHeldValue)
		},
		[data, newDurationValue, newWhileHeldValue]
	)

	useImperativeHandle(
		ref,
		() => ({
			show(duration, whileHeld, completeCallback) {
				setNewDurationValue(duration)
				setNewWhileHeldValue(whileHeld)
				setData([duration, completeCallback])
				setShow(true)

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[]
	)

	const onDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setNewDurationValue(Number(e.target.value))
	}, [])

	const onWhileHeldChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setNewWhileHeldValue(!!e.target.checked)
	}, [])

	return (
		<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
			<CModalHeader closeButton>
				<h5>Change delay group properties</h5>
			</CModalHeader>
			<CModalBody>
				<CForm className="row g-3" onSubmit={doAction}>
					<CFormLabel htmlFor="colFormPressDuration" className="col-sm-4 col-form-label col-form-label-sm">
						Press duration
					</CFormLabel>
					<CCol sm={8}>
						<CFormInput
							name="colFormPressDuration"
							type="number"
							value={newDurationValue || ''}
							min={1}
							step={1}
							style={{ color: !newDurationValue || newDurationValue <= 0 ? 'red' : undefined }}
							onChange={onDurationChange}
						/>
					</CCol>

					<CFormLabel htmlFor="colFormExecuteWhileHeld" className="col-sm-4 col-form-label col-form-label-sm">
						Execute while held
					</CFormLabel>
					<CCol sm={8}>
						<CFormSwitch
							name="colFormExecuteWhileHeld"
							size="xl"
							checked={!!newWhileHeldValue}
							onChange={onWhileHeldChange}
						/>
					</CCol>
				</CForm>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton ref={buttonRef} color="primary" onClick={doAction}>
					Save
				</CButton>
			</CModalFooter>
		</CModalExt>
	)
})
