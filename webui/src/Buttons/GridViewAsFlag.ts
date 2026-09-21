import { useLocalStorage } from '~/Hooks/useLocalStorage.js'

/**
 * Whether this browser offers viewing the button grid as one of the surfaces.
 *
 * Browser storage rather than the install's config, because nothing Companion does is different
 * either way - it is a way of looking at the grid while programming it, in the same way the view's
 * own selection is. One person can be trying it out while everybody else sees the grid as it has
 * always been, which is what wanting it behind a flag is for.
 */
export const GRID_VIEW_AS_FLAG_STORAGE_KEY = 'grid-view-as-enabled'

export function useGridViewAsFlag(): [boolean, (enabled: boolean) => void] {
	const [enabled, setEnabled] = useLocalStorage<boolean>(GRID_VIEW_AS_FLAG_STORAGE_KEY, false, {
		// Anything but a plain `true` is off, so a hand-edited value cannot break the page it gates
		deserializer: (raw) => raw === 'true',
	})

	return [enabled, setEnabled]
}
