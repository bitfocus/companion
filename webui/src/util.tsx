import React, { FormEvent, useEffect, useState } from 'react'
import pTimeout from 'p-timeout'
import { CAlert, CButton, CCol } from '@coreui/react'
import { ErrorBoundary } from 'react-error-boundary'
import { PRIMARY_COLOR } from './Constants.js'
import { BarLoader } from 'react-spinners'
import { Operation as JsonPatchOperation, applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { useEventListener } from 'usehooks-ts'
import { LoaderHeightWidthProps } from 'react-spinners/helpers/props.js'
import { Socket } from 'socket.io-client'
import type { AllVariableDefinitions } from '@companion/shared/Model/Variables.js'
import type { NotificationsManagerRef } from './Components/Notifications.js'
import type {
	ClientConnectionConfig,
	ClientEventDefinition,
	ModuleDisplayInfo,
} from '@companion/shared/Model/Common.js'

export const SocketContext = React.createContext<Socket>(null as any) // TODO - fix this
export const EventDefinitionsContext = React.createContext<Record<string, ClientEventDefinition | undefined>>({})
export const NotifierContext = React.createContext<React.RefObject<NotificationsManagerRef>>({ current: null }) // TODO - this is not good
/*({
	show: () => {
		throw new Error('Not inside of context!')
	},
})*/
export const ModulesContext = React.createContext<Record<string, ModuleDisplayInfo>>({})
export const ActionsContext = React.createContext(null)
export const FeedbacksContext = React.createContext(null)
export const ConnectionsContext = React.createContext<Record<string, ClientConnectionConfig>>({})
export const VariableDefinitionsContext = React.createContext<AllVariableDefinitions>({})
export const CustomVariableDefinitionsContext = React.createContext(null)
export const UserConfigContext = React.createContext(null)
export const SurfacesContext = React.createContext(null)
export const PagesContext = React.createContext(null)
export const TriggersContext = React.createContext(null)
export const RecentActionsContext = React.createContext(null)
export const RecentFeedbacksContext = React.createContext(null)

export function socketEmitPromise(
	socket: Socket,
	name: string,
	args: any[],
	timeout?: number,
	timeoutMessage?: string
): Promise<any> {
	const p = new Promise((resolve, reject) => {
		console.log('send', name, ...args)

		socket.emit(name, ...args, (err: Error, res: any) => {
			if (err) reject(err)
			else resolve(res)
		})
	})

	timeout = timeout ?? 5000
	return pTimeout(p, {
		milliseconds: timeout,
		message: timeoutMessage ?? `Timed out after ${timeout / 1000}s`,
	})
}

const freezePrototypes = () => {
	if (Object.isFrozen(console)) {
		return
	}

	// freeze global objects that can be used within the sandbox
	Object.freeze(console)
	Object.freeze(Array.prototype)
	Object.freeze(Function.prototype)
	// @ts-ignore
	Object.freeze(Math.prototype)
	Object.freeze(Number.prototype)
	Object.freeze(Object.prototype)
	Object.freeze(RegExp.prototype)
	Object.freeze(String.prototype)
	Object.freeze(Symbol.prototype)

	// prevent constructors of async/generator functions to bypass sandbox
	// @ts-ignore
	Object.freeze(async function () {}.__proto__)
	// @ts-ignore
	Object.freeze(async function* () {}.__proto__)
	// @ts-ignore
	Object.freeze(function* () {}.__proto__)
	// @ts-ignore
	Object.freeze(function* () {}.__proto__.prototype)
	// @ts-ignore
	Object.freeze(async function* () {}.__proto__.prototype)
}

export function sandbox(serializedFn: string): (...args: any[]) => any {
	// proxy handler
	const proxyHandler = {
		has: () => true,
		get: (obj: any, prop: any) => Reflect.get(obj, prop),
	}

	// global objects that will be allowed within the sandbox
	const allowList = {
		__proto__: null,
		console,
		Array,
		Math,
		Number,
		Object,
		RegExp,
		String,
		Symbol,
	}

	// limit scope and prevent `window` leak
	const src = `
		with (catchAllProxy) {
			with (configProxy) {
				return (() => {
					"use strict"
					const fn = ${serializedFn}
					return fn(arg0, arg1)
				})()
			}
		}
	`

	freezePrototypes()

	try {
		// eslint-disable-next-line no-new-func
		const scopedFn = new Function('catchAllProxy', src)

		return (arg0, arg1) => {
			// create a sandboxed/proxy version of the context passed to the function
			const configProxy = new Proxy({ ...allowList, arg0, arg1 }, proxyHandler)
			const catchAllProxy = new Proxy({ __proto__: null, configProxy }, proxyHandler)
			// call scoped function with context that only includes config
			return scopedFn(catchAllProxy)
		}
	} catch (error) {
		// log error and gracefully exit
		console.log(`Sandbox: ${error}`)
		return () => true
	}
}

interface ErrorFallbackProps {
	error: Error | undefined
	resetErrorBoundary: () => void
}
function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
	return (
		<CAlert color="danger">
			<p>Something went wrong:</p>
			<pre>{error?.message ?? ''}</pre>
			<CButton color="primary" size="sm" onClick={resetErrorBoundary}>
				Try again
			</CButton>
		</CAlert>
	)
}

export function MyErrorBoundary({ children }: React.PropsWithChildren<{}>) {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}

type KeyReceiverProps = React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>
export function KeyReceiver({ children, ...props }: KeyReceiverProps) {
	return (
		<div {...props} style={{ ...props.style, outline: 'none' }}>
			{children}
		</div>
	)
}

// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMountEffect = (fun: React.EffectCallback) => useEffect(fun, [])

type LoadingBarProps = LoaderHeightWidthProps
export function LoadingBar(props: LoadingBarProps) {
	return (
		<BarLoader
			loading={true}
			height={4}
			width="50%"
			cssOverride={{ margin: '0 auto', display: 'inherit' }}
			color={PRIMARY_COLOR}
			{...props}
		/>
	)
}

interface LoadingRetryOrErrorProps {
	error?: string | null
	dataReady: boolean
	doRetry?: () => void
	autoRetryAfter?: number | null
}
export function LoadingRetryOrError({ error, dataReady, doRetry, autoRetryAfter = null }: LoadingRetryOrErrorProps) {
	const [countdown, setCountdown] = useState(autoRetryAfter)

	useEffect(() => {
		if (!dataReady && autoRetryAfter) {
			const interval = setInterval(() => {
				setCountdown((c) => {
					if (!c || c <= 0) {
						return autoRetryAfter - 1
					} else {
						return c - 1
					}
				})
			}, 1000)
			return () => clearInterval(interval)
		} else {
			setCountdown(null)
			return
		}
	}, [dataReady, autoRetryAfter])

	useEffect(() => {
		if (countdown === 0 && doRetry) {
			doRetry()
		}
	}, [countdown, doRetry])

	return (
		<>
			{error && (
				<CCol sm={12}>
					<CAlert color="danger" role="alert">
						<p>{error}</p>
						{!dataReady && (
							<CButton color="primary" onClick={doRetry}>
								Retry {countdown && '(' + countdown + ')'}
							</CButton>
						)}
					</CAlert>
				</CCol>
			)}
			{!dataReady && !error && (
				<CCol sm={12}>
					<LoadingBar />
				</CCol>
			)}
		</>
	)
}

export function applyPatchOrReplaceSubObject<T extends object>(
	oldDefinitions: Record<string, T>,
	key: string,
	patch: JsonPatchOperation[],
	defVal: T
) {
	if (oldDefinitions) {
		const oldEntry = oldDefinitions[key] ?? defVal

		const newDefinitions = { ...oldDefinitions }
		if (!patch) {
			delete newDefinitions[key]
		} else if (Array.isArray(patch)) {
			// If its an array we assume it is a patch
			newDefinitions[key] = applyPatch(cloneDeep(oldEntry), patch).newDocument
		} else {
			// If its any other type, then its not a patch and is likely a complete value
			newDefinitions[key] = patch
		}

		return newDefinitions
	} else {
		return oldDefinitions
	}
}
export function applyPatchOrReplaceObject<T extends object>(oldObj: T, patch: JsonPatchOperation[] | T): T {
	const oldEntry = oldObj ?? {}

	if (Array.isArray(patch)) {
		// If its an array we assume it is a patch
		return applyPatch(cloneDeep(oldEntry), patch).newDocument
	} else {
		// If its any other type, then its not a patch and is likely a complete value
		return patch
	}
}

/**
 * Slight modification of useClickoutside from usehooks-ts, which expects an array of refs to check
 */
export function useOnClickOutsideExt(
	refs: React.RefObject<HTMLElement>[],
	handler: (e: MouseEvent) => void,
	mouseEvent: 'mousedown' | 'mouseup' = 'mousedown'
) {
	useEventListener(mouseEvent, (event) => {
		for (const ref of refs) {
			const el = ref?.current

			// Do nothing if clicking ref's element or descendent elements
			if (!el || el.contains(event.target as any)) {
				return
			}
		}

		handler(event)
	})
}

export const PreventDefaultHandler = (e: FormEvent): void => {
	e.preventDefault()
}
