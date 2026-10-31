/** Whether this is somewhere text is being typed, where the keys belong to whatever is being typed in */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false

	if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return true

	// The expression editor, which is neither
	return target.classList.contains('native-edit-context')
}
