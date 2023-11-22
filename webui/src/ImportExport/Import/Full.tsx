import React, { useCallback, useContext, useMemo, useState } from 'react'
import ClassNames from 'classnames'
import { MyErrorBoundary, NotifierContext, SocketContext, socketEmitPromise } from '../../util'
import {
	CAlert,
	CButton,
	CInputCheckbox,
	CLabel,
	CNav,
	CNavItem,
	CNavLink,
	CTabContent,
	CTabPane,
	CTabs,
} from '@coreui/react'
import { faCalendar, faClock, faDownload, faFileImport, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ImportPageWizard } from './Page'
import { ImportTriggersTab } from './Triggers'
import { ClientImportObject } from '@companion/shared/Model/ImportExport'

interface ImportFullWizardProps {
	snapshot: ClientImportObject
	instanceRemap: Record<string, string | undefined>
	setInstanceRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
}

export function ImportFullWizard({ snapshot, instanceRemap, setInstanceRemap }: ImportFullWizardProps) {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)

	const doSinglePageImport = useCallback(
		(fromPage: number, toPage: number, instanceRemap: Record<string, string | undefined>) => {
			socketEmitPromise(socket, 'loadsave:import-page', [toPage, fromPage, instanceRemap])
				.then((res) => {
					notifier.current?.show(`Import successful`, `Page was imported successfully`, 10000)
					console.log('remap response', res)
					if (res) {
						setInstanceRemap(res)
					}
				})
				.catch((e) => {
					notifier.current?.show(`Import failed`, `Page import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[socket, notifier, setInstanceRemap]
	)

	return (
		<CTabs activeTab="full">
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink data-tab="full">
						<FontAwesomeIcon icon={faGlobe} /> Full Import
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink data-tab="buttons" disabled={!snapshot.controls}>
						<FontAwesomeIcon icon={faCalendar} /> Buttons
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink data-tab="triggers" disabled={!snapshot.triggers}>
						<FontAwesomeIcon icon={faClock} /> Triggers
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent fade={false} className="no-height-limit">
				<CTabPane data-tab="full">
					<MyErrorBoundary>
						<FullImportTab snapshot={snapshot} />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane data-tab="buttons">
					<MyErrorBoundary>
						{snapshot.controls ? (
							<ImportPageWizard
								snapshot={snapshot}
								instanceRemap={instanceRemap}
								setInstanceRemap={setInstanceRemap}
								doImport={doSinglePageImport}
							/>
						) : (
							''
						)}
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane data-tab="triggers">
					<MyErrorBoundary>
						{snapshot.triggers ? (
							<ImportTriggersTab
								snapshot={snapshot}
								instanceRemap={instanceRemap}
								setInstanceRemap={setInstanceRemap}
							/>
						) : (
							''
						)}
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</CTabs>
	)
}

interface FullImportTabProps {
	snapshot: ClientImportObject
}

function FullImportTab({ snapshot }: FullImportTabProps) {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)

	const snapshotKeys = useMemo(() => {
		const keys: string[] = []

		for (const [key, val] of Object.entries(snapshot)) {
			if (val) keys.push(key)
		}

		{
			const i = keys.indexOf('instances')
			if (i !== -1) keys[i] = 'connections'
		}
		{
			const i = keys.indexOf('controls')
			if (i !== -1) keys[i] = 'buttons'
		}

		return keys
	}, [snapshot])

	const [config, setConfig] = useState(() => ({
		// connections: true,
		buttons: true,
		surfaces: true,
		triggers: true,
		customVariables: true,
		// userconfig: true,
	}))

	const validConfigKeys = Object.entries(config).filter(([k, v]) => v && snapshotKeys.includes(k))
	// console.log('validkeys', validConfigKeys)

	const setValue = useCallback((key, value) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[key]: value,
		}))
	}, [])

	const doImport = useCallback(() => {
		socketEmitPromise(socket, 'loadsave:import-full', [config], 60000)
			.then((_res) => {
				// notifier.current.show(`Import successful`, `Page was imported successfully`, 10000)
				window.location.reload()
			})
			.catch((e) => {
				console.log('import failed', e)
				notifier.current?.show(`Import failed`, `Full import failed with: "${e?.message ?? e}"`, 10000)
			})
		console.log('do import!')
	}, [socket, notifier, config])

	return (
		<>
			<h5>Full Import</h5>

			<CAlert color="info">If you wish to do a more selective import, check the other tabs.</CAlert>

			<p>It is recommended to export the system configuration first.</p>

			<CButton color="success" href="/int/export/full" target="_new">
				<FontAwesomeIcon icon={faDownload} /> Export
			</CButton>

			<p>&nbsp;</p>

			<p>Perform a full reset, and import the selected components:</p>

			{/* <InputCheckbox
				config={config}
				allowKeys={snapshotKeys}
				keyName="connections"
				setValue={() => null}
				label="Connections"
			/> */}
			{/* {!config.connections && (config.buttons || config.triggers) ? (
				<CAlert color="warning">
					Any 'Connections' referenced by an action or feedback will still be imported, but it  will remove all actions, feedbacks, and triggers associated with the connections even
					if 'Buttons' and/or 'Triggers' are not also reset.
				</CAlert>
			) : (
				''
			)} */}

			<InputCheckbox config={config} allowKeys={snapshotKeys} keyName="buttons" setValue={setValue} label="Buttons" />

			<InputCheckbox config={config} allowKeys={snapshotKeys} keyName="triggers" setValue={setValue} label="Triggers" />

			<InputCheckbox
				config={config}
				allowKeys={snapshotKeys}
				keyName="customVariables"
				setValue={setValue}
				label="Custom Variables"
			/>

			<InputCheckbox config={config} allowKeys={snapshotKeys} keyName="surfaces" setValue={setValue} label="Surfaces" />

			{/* <InputCheckbox
				config={config}
				allowKeys={snapshotKeys}
				keyName="userconfig"
				setValue={setValue}
				label="Settings"
			/> */}

			<CAlert color="info">
				All the connections will be imported, as they are required to be able to import any actions and feedbacks.
			</CAlert>

			<CButton color="warning" onClick={doImport} disabled={validConfigKeys.length === 0}>
				<FontAwesomeIcon icon={faFileImport} /> Reset and Import
			</CButton>
		</>
	)
}

interface InputCheckboxProps {
	config: Record<string, boolean>
	allowKeys: string[]
	keyName: string
	setValue: (key: string, value: any) => void
	label: string
}

function InputCheckbox({ config, allowKeys, keyName, setValue, label }: InputCheckboxProps) {
	const disabled = allowKeys && !allowKeys.includes(keyName)

	const setValue2 = useCallback((e) => setValue(keyName, !!e.currentTarget.checked), [setValue, keyName])

	return (
		<div className="indent3">
			<div className="form-check form-check-inline mr-1">
				<CInputCheckbox
					id={`check-${keyName}`}
					checked={!disabled && !!config[keyName]}
					onChange={setValue2}
					disabled={disabled}
				/>
				<CLabel
					htmlFor={`check-${keyName}`}
					className={ClassNames({
						disabled: disabled,
					})}
				>
					{label}
				</CLabel>
			</div>
		</div>
	)
}
