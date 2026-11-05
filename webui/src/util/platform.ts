/** Apple keyboards use ⌘ where everything else uses Ctrl. On a Mac, Ctrl+click is a right-click. */
export const IS_APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

/** What to call the primary modifier key, in a shortcut shown to the user */
export const PRIMARY_MODIFIER_LABEL = IS_APPLE_PLATFORM ? '⌘' : 'Ctrl'

/** Whether the platform's primary modifier key is held: ⌘ on Apple, Ctrl everywhere else */
export function isPrimaryModifierHeld(e: { ctrlKey: boolean; metaKey: boolean }): boolean {
	return IS_APPLE_PLATFORM ? e.metaKey : e.ctrlKey
}
