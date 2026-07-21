/* useLocalStorage.ts
 * Drop-in replacement for `usehooks-ts`'s `useLocalStorage` that does NOT
 * live-sync across browser windows/tabs by default.
 *
 * The `usehooks-ts` hook listens for the native `storage` event, which fires in
 * every *other* window/tab of the same origin whenever a key changes. For UI
 * state such as the active tab/step or sidebar toggles that means an action in
 * one window (e.g. selecting "Step 1") is mirrored into every other open window,
 * which is surprising when two screens are being used side by side.
 *
 * This version keeps the same signature and same-document behaviour (it still
 * dispatches/handles the custom `local-storage` event so multiple hooks for the
 * same key within one document stay in sync), but only opts into cross-window
 * syncing when `sync: true` is passed.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'

const IS_SERVER = typeof window === 'undefined'

export interface UseLocalStorageOptions<T> {
	serializer?: (value: T) => string
	deserializer?: (value: string) => T
	/** If `true` (default), initialize by reading localStorage. */
	initializeWithValue?: boolean
	/** If `true`, live-sync the value across windows/tabs via the native `storage` event. Defaults to `false`. */
	sync?: boolean
}

export function useLocalStorage<T>(
	key: string,
	initialValue: T | (() => T),
	options: UseLocalStorageOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
	const {
		initializeWithValue = true,
		sync = false,
		serializer: customSerializer,
		deserializer: customDeserializer,
	} = options

	const serializer = useCallback<(value: T) => string>(
		(value) => (customSerializer ? customSerializer(value) : JSON.stringify(value)),
		[customSerializer]
	)
	const deserializer = useCallback<(value: string) => T>(
		(value) => {
			if (customDeserializer) return customDeserializer(value)
			try {
				return JSON.parse(value) as T
			} catch (error) {
				console.error('Error parsing JSON:', error)
				return initialValue instanceof Function ? initialValue() : initialValue
			}
		},
		[customDeserializer, initialValue]
	)

	const readValue = useCallback((): T => {
		const initialValueToUse = initialValue instanceof Function ? initialValue() : initialValue
		if (IS_SERVER) return initialValueToUse
		try {
			const raw = window.localStorage.getItem(key)
			return raw ? deserializer(raw) : initialValueToUse
		} catch (error) {
			console.warn(`Error reading localStorage key “${key}”:`, error)
			return initialValueToUse
		}
	}, [initialValue, key, deserializer])

	const [storedValue, setStoredValue] = useState<T>(() => {
		if (initializeWithValue) return readValue()
		return initialValue instanceof Function ? initialValue() : initialValue
	})

	// Keep the latest readValue in a ref so the stable callbacks below don't need to be recreated
	const readValueRef = useRef(readValue)
	readValueRef.current = readValue

	const setValue = useCallback(
		(value: T | ((prev: T) => T)) => {
			if (IS_SERVER) {
				console.warn(`Tried setting localStorage key “${key}” even though environment is not a client`)
				return
			}
			const newValue = value instanceof Function ? value(readValueRef.current()) : value
			safeSetLocalStorage(key, serializer(newValue))
			setStoredValue(newValue)
			// Notify other hooks for the same key within this document (not across windows)
			window.dispatchEvent(new StorageEvent('local-storage', { key }))
		},
		[key, serializer]
	)

	const removeValue = useCallback(() => {
		if (IS_SERVER) {
			console.warn(`Tried removing localStorage key “${key}” even though environment is not a client`)
			return
		}
		const defaultValue = initialValue instanceof Function ? initialValue() : initialValue
		try {
			window.localStorage.removeItem(key)
		} catch (error) {
			console.warn(`Error removing localStorage key “${key}”:`, error)
		}
		setStoredValue(defaultValue)
		window.dispatchEvent(new StorageEvent('local-storage', { key }))
	}, [initialValue, key])

	useEffect(() => {
		setStoredValue(readValueRef.current())
	}, [key])

	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key && event.key !== key) return
			setStoredValue(readValueRef.current())
		}

		// Always handle same-document updates; only handle the native (cross-window) `storage` event when opted in
		window.addEventListener('local-storage', handleStorageChange as EventListener)
		if (sync) window.addEventListener('storage', handleStorageChange)

		return () => {
			window.removeEventListener('local-storage', handleStorageChange as EventListener)
			if (sync) window.removeEventListener('storage', handleStorageChange)
		}
	}, [key, sync])

	return [storedValue, setValue, removeValue]
}
