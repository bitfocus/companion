/* eslint-disable react-refresh/only-export-components */
import React, { DependencyList, FormEvent, useEffect, useMemo, useState } from 'react'
import { CAlert, CButton, CCol } from '@coreui/react'
import { ErrorBoundary } from 'react-error-boundary'
import { PRIMARY_COLOR } from './Constants.js'
import { BarLoader, PuffLoader } from 'react-spinners'
import { useEventListener } from 'usehooks-ts'
import type { LoaderHeightWidthProps } from 'react-spinners/helpers/props.js'
import { computed } from 'mobx'
import { DropTargetMonitor, XYCoord } from 'react-dnd'
import type { ReadonlyDeep } from 'type-fest'
import { TRPCClientErrorLike } from '@trpc/client'
import { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { joinPaths } from '@tanstack/react-router'

// type VoidIfReturnIsNever<T extends (...args: any[]) => void> =
// 	ReturnType<T> extends never ? (...args: Parameters<T>) => void : never

const freezePrototypes = () => {
	if (Object.isFrozen(console)) {
		return
	}

	// freeze global objects that can be used within the sandbox
	Object.freeze(console)
	Object.freeze(Array.prototype)
	// Object.freeze(Function.prototype) // TODO - this should be enabled, but breaks mobx...
	// @ts-expect-error Suppress error
	Object.freeze(Math.prototype)
	Object.freeze(Number.prototype)
	Object.freeze(Object.prototype)
	Object.freeze(RegExp.prototype)
	Object.freeze(String.prototype)
	Object.freeze(Symbol.prototype)

	// prevent constructors of async/generator functions to bypass sandbox
	// @ts-expect-error Suppress error
	Object.freeze(async function () {}.__proto__)
	// @ts-expect-error Suppress error
	Object.freeze(async function* () {}.__proto__)
	// @ts-expect-error Suppress error
	Object.freeze(function* () {}.__proto__)
	// @ts-expect-error Suppress error
	Object.freeze(function* () {}.__proto__.prototype)
	// @ts-expect-error Suppress error
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
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
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

/**
 * Deeply freeze an object
 * Note: This is done in place
 */
export function deepFreeze<T>(object: ReadonlyDeep<T> | Readonly<T> | T): ReadonlyDeep<T> {
	// Based on https://github.com/anatoliygatt/deep-freeze-node/blob/master/lib/deep-freeze.js

	Object.freeze(object)
	if (typeof object === 'object') {
		deepFreezeInner(object)
	}

	return object as ReadonlyDeep<T>
}
function deepFreezeInner(object: any): void {
	Object.freeze(object)

	for (const propertyKey in object) {
		if (Object.prototype.hasOwnProperty.call(object, propertyKey)) {
			const property = object[propertyKey]
			if (typeof property !== 'object' || !(property instanceof Object) || Object.isFrozen(property)) {
				continue
			}
			deepFreezeInner(property)
		}
	}
}

interface ErrorFallbackProps {
	error: Error | undefined
	resetErrorBoundary: () => void
}
export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps): React.JSX.Element {
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

export function MyErrorBoundary({ children }: React.PropsWithChildren): React.JSX.Element {
	return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
}

type KeyReceiverProps = React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>
export function KeyReceiver({ children, ...props }: KeyReceiverProps): React.JSX.Element {
	return (
		<div {...props} style={{ ...props.style, outline: 'none' }}>
			{children}
		</div>
	)
}

// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMountEffect = (fun: React.EffectCallback): void => useEffect(fun, [])

type LoadingBarProps = LoaderHeightWidthProps
export function LoadingBar(props: LoadingBarProps): React.JSX.Element {
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
	error?: string | TRPCClientErrorLike<any> | null
	dataReady: boolean
	doRetry?: () => void
	autoRetryAfter?: number | null
	design: 'bar' | 'pulse' | 'pulse-xl'
}
export function LoadingRetryOrError({
	error,
	dataReady,
	doRetry,
	autoRetryAfter = null,
	design,
}: LoadingRetryOrErrorProps): React.JSX.Element {
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
						<p>{typeof error === 'string' ? error : error.message}</p>
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
					{design === 'pulse' ? (
						<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
							<PuffLoader loading={true} size={80} color={PRIMARY_COLOR} />
						</div>
					) : design === 'pulse-xl' ? (
						<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
							<PuffLoader loading={true} size={160} color={PRIMARY_COLOR} />
						</div>
					) : (
						<LoadingBar />
					)}
				</CCol>
			)}
		</>
	)
}

/**
 * Slight modification of useClickoutside from usehooks-ts, which expects an array of refs to check
 */
export function useOnClickOutsideExt(
	refs: React.RefObject<HTMLElement>[],
	handler: (e: MouseEvent) => void,
	mouseEvent: 'mousedown' | 'mouseup' = 'mousedown'
): void {
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

export function useComputed<TRes>(cb: () => TRes, deps: DependencyList): TRes {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => computed(cb), [cb, ...deps]).get()
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

export function isCollectionEnabled<TMetaData extends { enabled?: boolean }>(
	collections: CollectionBase<TMetaData>[],
	collectionId: string | null | undefined
): boolean {
	if (!collectionId) return true

	for (const collection of collections) {
		// If found the collection, check if it is enabled
		if (collection.id === collectionId) {
			return !!collection.metaData?.enabled
		}

		if (collection.metaData.enabled && collection.children) {
			const enabled = isCollectionEnabled(collection.children, collectionId)
			if (enabled) return true
		}
	}

	return false
}

export function makeAbsolutePath(path: string): string {
	return joinPaths([import.meta.env.BASE_URL || '/', path])
}

export function base64EncodeUint8Array(buffer: Uint8Array): string {
	// Convert ArrayBuffer to base64 in a cross-browser way
	const uint8Array = new Uint8Array(buffer)
	let binaryString = ''
	for (let i = 0; i < uint8Array.length; i++) {
		binaryString += String.fromCharCode(uint8Array[i])
	}
	return btoa(binaryString)
}
