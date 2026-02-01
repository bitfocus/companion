import { createLazyFileRoute } from '@tanstack/react-router'
import { Emulator } from '~/Emulator/Emulator.js'

export const Route = createLazyFileRoute('/_standalone/emulator/$emulatorId')({
	component: Emulator,
})
