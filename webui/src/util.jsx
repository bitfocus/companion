import React, { useEffect } from 'react'
import pTimeout from 'p-timeout'
import { CAlert, CButton, CCol } from '@coreui/react'
import { ErrorBoundary } from 'react-error-boundary'
import { PRIMARY_COLOR } from './Constants'
import { BarLoader } from 'react-spinners'

export const SERVER_URL = window.SERVER_URL === '%REACT_APP_SERVER_URL%' ? undefined : window.SERVER_URL

export const StaticContext = React.createContext({
	socket: undefined,
})
export const ActionsContext = React.createContext(null)
export const FeedbacksContext = React.createContext(null)
export const InstancesContext = React.createContext(null)
export const VariableDefinitionsContext = React.createContext(null)
export const CustomVariableDefinitionsContext = React.createContext(null)
export const UserConfigContext = React.createContext(null)

export function socketEmit(socket, name, args, timeout, timeoutMessage) {
	const p = new Promise((resolve, reject) => {
		console.log('send', name, ...args)

		socket.emit(name, ...args, (...res) => resolve(res))
	})

	timeout = timeout ?? 5000
	return pTimeout(p, timeout, timeoutMessage ?? `Timed out after ${timeout / 1000}s`)
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
					return fn(config)
				})()
			}
		}
	`

	freezePrototypes()

	try {
		// eslint-disable-next-line no-new-func
		const scopedFn = new Function('catchAllProxy', src)

		return (config) => {
			// create a sandboxed/proxy version of the context passed to the function
			const configProxy = new Proxy({ ...allowList, config }, proxyHandler)
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
			<pre>{error.message}</pre>
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
			css={{ margin: '0 auto', display: 'inherit' }}
			color={PRIMARY_COLOR}
			{...props}
		/>
	)
}

export function LoadingRetryOrError({ error, dataReady, doRetry }) {
	return (
		<>
			{error ? (
				<CCol sm={12}>
					<CAlert color="danger" role="alert">
						<p>{error}</p>
						{!dataReady ? (
							<CButton color="primary" onClick={doRetry}>
								Retry
							</CButton>
						) : (
							''
						)}
					</CAlert>
				</CCol>
			) : (
				''
			)}
			{!dataReady && !error ? (
				<CCol sm={12}>
					<LoadingBar />
				</CCol>
			) : (
				''
			)}
		</>
	)
}
