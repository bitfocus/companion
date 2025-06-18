import React, { useCallback, useContext, useMemo, useState } from 'react'
import { MyErrorBoundary } from '~/util.js'
import { CAlert, CButton, CFormCheck, CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faCalendar, faClock, faDownload, faFileImport, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ImportPageWizard } from './Page.js'
import { ImportTriggersTab } from './Triggers.js'
import { ClientImportObject } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface ImportFullWizardProps {
	snapshot: ClientImportObject
	connectionRemap: Record<string, string | undefined>
	setConnectionRemap: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>
}

export function ImportFullWizard({
	snapshot,
	connectionRemap,
	setConnectionRemap,
}: ImportFullWizardProps): React.JSX.Element {
	const { socket, notifier } = useContext(RootAppStoreContext)

	const doSinglePageImport = useCallback(
		(fromPage: number, toPage: number, connectionRemap: Record<string, string | undefined>) => {
			socket
				.emitPromise('loadsave:import-page', [toPage, fromPage, connectionRemap])
				.then((res) => {
					notifier.current?.show(`Import successful`, `Page was imported successfully`, 10000)
					console.log('remap response', res)
					if (res) {
						setConnectionRemap(res)
					}
				})
				.catch((e) => {
					notifier.current?.show(`Import failed`, `Page import failed with: "${e}"`, 10000)
					console.error('import failed', e)
				})
		},
		[socket, notifier, setConnectionRemap]
	)

	const [activeTab, setActiveTab] = useState<'full' | 'buttons' | 'triggers'>('full')

	return (
		<>
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink active={activeTab === 'full'} onClick={() => setActiveTab('full')}>
						<FontAwesomeIcon icon={faGlobe} /> Full Import
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink
						active={activeTab === 'buttons'}
						onClick={() => setActiveTab('buttons')}
						disabled={!snapshot.controls}
					>
						<FontAwesomeIcon icon={faCalendar} /> Buttons
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink
						active={activeTab === 'triggers'}
						onClick={() => setActiveTab('triggers')}
						disabled={!snapshot.triggers}
					>
						<FontAwesomeIcon icon={faClock} /> Triggers
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent className="no-height-limit">
				<CTabPane visible={activeTab === 'full'}>
					<MyErrorBoundary>
						<FullImportTab snapshot={snapshot} />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane visible={activeTab === 'buttons'}>
					<MyErrorBoundary>
						{snapshot.controls ? (
							<ImportPageWizard
								snapshot={snapshot}
								connectionRemap={connectionRemap}
								setConnectionRemap={setConnectionRemap}
								doImport={doSinglePageImport}
							/>
						) : (
							''
						)}
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane visible={activeTab === 'triggers'}>
					<MyErrorBoundary>
						{snapshot.triggers ? (
							<ImportTriggersTab
								snapshot={snapshot}
								connectionRemap={connectionRemap}
								setConnectionRemap={setConnectionRemap}
							/>
						) : (
							''
						)}
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
}

interface FullImportTabProps {
	snapshot: ClientImportObject
}

function FullImportTab({ snapshot }: FullImportTabProps) {
	const { socket, notifier } = useContext(RootAppStoreContext)

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

	const setValue = useCallback((key: string, value: any) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[key]: value,
		}))
	}, [])

	const doImport = useCallback(() => {
		socket
			.emitPromise('loadsave:import-full', [config], 60000)
			.then(() => {
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

			<CButton color="success" href="/int/export/full" target="_blank">
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

			<CAlert color="info" className="margin-top">
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

	const setValue2 = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => setValue(keyName, !!e.currentTarget.checked),
		[setValue, keyName]
	)

	return (
		<div className="indent3">
			<CFormCheck
				id={`check-${keyName}`}
				label={label}
				checked={!disabled && !!config[keyName]}
				onChange={setValue2}
				disabled={disabled}
			/>
		</div>
	)
}
