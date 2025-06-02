import { createFileRoute } from '@tanstack/react-router'
import { EmulatorList } from '~/Emulator/List.js'

export const Route = createFileRoute('/emulator/')({
	component: EmulatorList,
})
