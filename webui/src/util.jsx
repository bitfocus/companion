import React, { useEffect } from 'react'
import pTimeout from 'p-timeout'
import { CAlert, CButton, CCol } from '@coreui/react'
import { ErrorBoundary } from 'react-error-boundary'
import { PRIMARY_COLOR } from './Constants'
import { BarLoader } from 'react-spinners'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { ParseControlId } from '@companion/shared/ControlId'
import { useEventListener } from 'usehooks-ts'

export const SERVER_URL = window.SERVER_URL === '%REACT_APP_SERVER_URL%' ? undefined : window.SERVER_URL

export const SocketContext = React.createContext(null)
export const EventDefinitionsContext = React.createContext(null)
export const NotifierContext = React.createContext(null)
export const ModulesContext = React.createContext(null)
export const ActionsContext = React.createContext(null)
export const FeedbacksContext = React.createContext(null)
export const InstancesContext = React.createContext(null)
export const VariableDefinitionsContext = React.createContext(null)
export const CustomVariableDefinitionsContext = React.createContext(null)
export const UserConfigContext = React.createContext(null)
export const SurfacesContext = React.createContext(null)
export const PagesContext = React.createContext(null)
export const TriggersContext = React.createContext(null)
export const ButtonRenderCacheContext = React.createContext(null)

export function socketEmitPromise(socket, name, args, timeout, timeoutMessage) {
	const p = new Promise((resolve, reject) => {
		console.log('send', name, ...args)

		socket.emit(name, ...args, (err, res) => {
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
	Object.freeze(Math.prototype)
	Object.freeze(Number.prototype)
	Object.freeze(Object.prototype)
	Object.freeze(RegExp.prototype)
	Object.freeze(String.prototype)
	Object.freeze(Symbol.prototype)

	// prevent constructors of async/generator functions to bypass sandbox
	Object.freeze(async function () {}.__proto__)
	Object.freeze(async function* () {}.__proto__)
	Object.freeze(function* () {}.__proto__)
	Object.freeze(function* () {}.__proto__.prototype)
	Object.freeze(async function* () {}.__proto__.prototype)
}

export function sandbox(serializedFn) {
	// proxy handler
	const proxyHandler = {
		has: () => true,
		get: (obj, prop) => Reflect.get(obj, prop),
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

function ErrorFallback({ error, resetErrorBoundary }) {
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

export function MyErrorBoundary({ children }) {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}

export function KeyReceiver({ children, ...props }) {
	return (
		<div {...props} style={{ ...props.style, outline: 'none' }}>
			{children}
		</div>
	)
}

// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMountEffect = (fun) => useEffect(fun, [])

export function LoadingBar(props) {
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

export function LoadingRetryOrError({ error, dataReady, doRetry }) {
	return (
		<>
			{error && (
				<CCol sm={12}>
					<CAlert color="danger" role="alert">
						<p>{error}</p>
						{!dataReady && (
							<CButton color="primary" onClick={doRetry}>
								Retry
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

export function FormatButtonControlId(controlId) {
	const parsed = ParseControlId(controlId)

	if (parsed && parsed.type === 'bank') {
		return `${parsed.page}.${parsed.bank}`
	} else {
		return controlId
	}
}

export function applyPatchOrReplaceSubObject(oldDefinitions, key, patch, defVal = {}) {
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
export function applyPatchOrReplaceObject(oldObj, patch) {
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
export function useOnClickOutsideExt(refs, handler, mouseEvent = 'mousedown') {
	useEventListener(mouseEvent, (event) => {
		for (const ref of refs) {
			const el = ref?.current

			// Do nothing if clicking ref's element or descendent elements
			if (!el || el.contains(event.target)) {
				return
			}
		}

		handler(event)
	})
}
