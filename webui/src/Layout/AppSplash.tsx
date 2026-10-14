import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Button } from '~/Components/Button.js'
import { Form } from '~/Components/Form.js'
import { ProgressBar } from '~/Components/ProgressBar.js'
import { SecretTextInputField } from '~/Components/SecretTextInputField.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './AppSplash.css'

interface AppLoadingProps {
	progress: number
	connected: boolean
}

export function AppLoading({ progress, connected }: AppLoadingProps): React.JSX.Element {
	return (
		<div className="app-splash select-none">
			<div className="app-splash-card">
				<div className="app-splash-logo">
					<img src="/img/icons/128x128.png" alt="Bitfocus Companion" />
				</div>

				<h3 className="text-lg font-bold text-body mb-1">
					{connected ? 'Syncing Configuration' : 'Connecting to Companion'}
				</h3>

				<p className="text-xs text-muted mb-6 leading-relaxed">
					{connected ? 'Loading surfaces, modules, and controls…' : 'Establishing real-time connection…'}
				</p>

				{connected ? (
					<div className="w-full space-y-2">
						<ProgressBar className="h-2 rounded-full overflow-hidden" value={progress} />
						<div className="flex justify-between text-2xs text-muted font-mono font-medium px-0.5">
							<span>Loading workspace</span>
							<span>{Math.round(progress)}%</span>
						</div>
					</div>
				) : (
					<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted/60 border border-border/70 text-xs text-muted font-medium shadow-xs">
						<span className="w-2 h-2 rounded-full bg-tone-warning-fill animate-pulse" />
						<span>Locating server…</span>
					</div>
				)}
			</div>
		</div>
	)
}

interface AppAuthWrapperProps {
	setUnlocked: () => void
}

export const AppAuthWrapper = observer(function AppAuthWrapper({ setUnlocked }: AppAuthWrapperProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const [password, setPassword] = useState('')
	const [showError, setShowError] = useState(false)

	const passwordChanged = useCallback((newValue: string) => {
		setPassword(newValue)
		setShowError(false)
	}, [])

	const tryLogin = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			setPassword((currentPassword) => {
				if (currentPassword === userConfig.properties?.admin_password) {
					setShowError(false)
					setUnlocked()
					return ''
				} else {
					setShowError(true)
					// preserve current entered value
					return currentPassword
				}
			})

			return false
		},
		[userConfig, setUnlocked]
	)

	const installName = userConfig.properties?.installName

	const formRef = useRef<HTMLFormElement>(null)
	useEffect(() => {
		formRef.current?.querySelector('input')?.focus()
	}, [])

	return (
		<div className="app-splash fadeIn">
			<div className="app-splash-card">
				<div className="app-splash-logo">
					<img src="/img/icons/128x128.png" alt="Bitfocus Companion" />
					<span className="app-splash-logo-badge">
						<FontAwesomeIcon icon={faLock} />
					</span>
				</div>

				<h3 className="text-lg font-bold text-body mb-1">Companion is locked</h3>
				<p className="text-xs text-muted mb-6 leading-relaxed">
					{installName ? (
						<>
							Enter the admin password to unlock <strong>{installName}</strong>.
						</>
					) : (
						'Enter the admin password to continue.'
					)}
				</p>

				<Form ref={formRef} className="app-lock-form" onSubmit={tryLogin}>
					<div>
						<SecretTextInputField
							id={undefined}
							placeholder="Password"
							value={password}
							setValue={passwordChanged}
							checkValid={showError ? false : undefined}
							immediateValue
						/>
						{showError && <div className="app-lock-error mt-1">Incorrect password, please try again.</div>}
					</div>
					<Button type="submit" color="primary" className="w-full">
						Unlock
					</Button>
				</Form>
			</div>
		</div>
	)
})
