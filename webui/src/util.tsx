import React, { DependencyList, FormEvent, useEffect, useMemo, useState } from 'react'
import pTimeout from 'p-timeout'
import { CAlert, CButton, CCol } from '@coreui/react'
import { ErrorBoundary } from 'react-error-boundary'
import { PRIMARY_COLOR } from './Constants.js'
import { BarLoader } from 'react-spinners'
import { Operation as JsonPatchOperation, applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { useEventListener } from 'usehooks-ts'
import type { LoaderHeightWidthProps } from 'react-spinners/helpers/props.js'
import { Socket } from 'socket.io-client'
import type {
	ClientToBackendEventsMap,
	BackendToClientEventsMap,
	AddCallbackParamToEvents,
	StripNever,
} from '@companion-app/shared/SocketIO.js'
import { computed } from 'mobx'
import { DropTargetMonitor, XYCoord } from 'react-dnd'

export type CompanionSocketType = Socket<BackendToClientEventsMap, AddCallbackParamToEvents<ClientToBackendEventsMap>>

export const SocketContext = React.createContext<CompanionSocketType>(null as any) // TODO - fix this

type IfReturnIsNever<T extends (...args: any[]) => void> = ReturnType<T> extends never ? never : T

type SocketEmitPromiseEvents = StripNever<{
	[K in keyof ClientToBackendEventsMap]: ClientToBackendEventsMap[K] extends (...args: any[]) => any
		? IfReturnIsNever<ClientToBackendEventsMap[K]>
		: never
}>

export function socketEmitPromise<T extends keyof SocketEmitPromiseEvents>(
	socket: CompanionSocketType,
	name: T,
	args: Parameters<SocketEmitPromiseEvents[T]>,
	timeout?: number,
	timeoutMessage?: string
): Promise<ReturnType<SocketEmitPromiseEvents[T]>> {
	const p = new Promise<ReturnType<SocketEmitPromiseEvents[T]>>((resolve, reject) => {
		console.log('send', name, ...args)

		socket.emit(
			name,
			// @ts-expect-error types are unhappy because of the complex setup
			args,
			(err, res) => {
				if (err) reject(err)
				else resolve(res)
			}
		)
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

export function applyPatchOrReplaceSubObject<T extends object | undefined>(
	oldDefinitions: Record<string, T>,
	key: string,
	patch: JsonPatchOperation[] | T | null,
	defVal: T | null
) {
	if (oldDefinitions) {
		const oldEntry = oldDefinitions[key] ?? defVal
		if (!oldEntry) return oldDefinitions

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

export function useComputed<TCb extends (...args: any[]) => any>(cb: TCb, deps: DependencyList): ReturnType<TCb> {
	return useMemo(() => computed(cb), deps).get()
}

/** Type assert that a value is never */
export function assertNever(_val: never): void {
	// Nothing to do
}

export interface DragState {
	draggedOver: string[]
	dragDownwards: boolean
	lastCoords: XYCoord
}

export function checkDragState<TItem extends { dragState: DragState | null }>(
	item: TItem,
	monitor: DropTargetMonitor,
	hoverId: string
): boolean {
	const currentCoords = monitor.getClientOffset()
	const previousCoords = item.dragState?.lastCoords ?? monitor.getInitialClientOffset()
	if (!previousCoords || !currentCoords) return false

	if (currentCoords.y === previousCoords.y) return false
	const isDownwards = currentCoords.y > previousCoords.y

	if (!item.dragState || item.dragState.dragDownwards !== isDownwards) {
		item.dragState = {
			dragDownwards: isDownwards,
			draggedOver: item.dragState ? [hoverId] : [], // If we're changing direction, reset the draggedOver list but don't trigger again for what is currently hovered
			lastCoords: currentCoords,
		}
	} else {
		item.dragState.lastCoords = currentCoords
	}

	// Don't repeat the same swap
	if (item.dragState.draggedOver.includes(hoverId)) {
		return false
	}
	item.dragState.draggedOver.push(hoverId)

	return true
}
