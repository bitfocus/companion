import { useCallback, useEffect, useMemo } from 'react'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { dsanMastercueKeymap, keyboardKeymap, logitecKeymap } from './Keymaps.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

type ButtonPressFn = (location: ControlLocation, pressed: boolean) => void

export function useButtonPressHandler(emulatorId: string): ButtonPressFn {
	const pressedMutation = useMutationExt(trpc.surfaces.emulatorPressed.mutationOptions())

	return useCallback(
		(location: ControlLocation, pressed: boolean) => {
			if (!emulatorId) return
			if (pressed) {
				console.log('emulator:press', emulatorId, location)
				pressedMutation.mutate({
					id: emulatorId,
					column: location.column,
					row: location.row,
					pressed: true,
				})
			} else {
				console.log('emulator:release', emulatorId, location)
				pressedMutation.mutate({
					id: emulatorId,
					column: location.column,
					row: location.row,
					pressed: false,
				})
			}
		},
		[pressedMutation, emulatorId]
	)
}

export function useKeyboardListener(emulatorId: string, enableExtendedKeymap: boolean): void {
	const pressedMutation = useMutationExt(trpc.surfaces.emulatorPressed.mutationOptions())

	const keymap = useMemo(() => {
		if (enableExtendedKeymap) {
			return { ...keyboardKeymap, ...logitecKeymap, ...dsanMastercueKeymap }
		} else {
			return keyboardKeymap
		}
	}, [enableExtendedKeymap])

	// Register key handlers
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!emulatorId) return

			const xy = keymap[e.code] ?? keymap[e.keyCode]
			if (xy) {
				console.log('emulator:press', emulatorId, xy)
				pressedMutation.mutate({
					id: emulatorId,
					column: xy[0],
					row: xy[1],
					pressed: true,
				})
			}
		}

		const onKeyUp = (e: KeyboardEvent) => {
			if (!emulatorId) return

			const xy = keymap[e.code] ?? keymap[e.keyCode]
			if (xy) {
				console.log('emulator:release', emulatorId, xy)
				pressedMutation.mutate({
					id: emulatorId,
					column: xy[0],
					row: xy[1],
					pressed: false,
				})
			}
		}

		document.addEventListener('keydown', onKeyDown)
		document.addEventListener('keyup', onKeyUp)

		return () => {
			document.removeEventListener('keydown', onKeyDown)
			document.removeEventListener('keyup', onKeyUp)
		}
	}, [pressedMutation, keymap, emulatorId])
}
