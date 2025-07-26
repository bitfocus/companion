/* eslint-disable react-refresh/only-export-components */
import React, { DependencyList, FormEvent, useCallback, useEffect } from 'react'
import { useEventListener } from 'usehooks-ts'
import type { ReadonlyDeep } from 'type-fest'
import { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { joinPaths } from '@tanstack/react-router'
import { computedFn } from 'mobx-utils'

// type VoidIfReturnIsNever<T extends (...args: any[]) => void> =
// 	ReturnType<T> extends never ? (...args: Parameters<T>) => void : never

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
	const wrappedCb = useCallback(computedFn(cb), deps)
	return wrappedCb()
}

/** Type assert that a value is never */
export function assertNever(_val: never): void {
	// Nothing to do
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
