import { ButtonDecorationRenderer } from '@companion-app/shared/Graphics/ButtonDecorationRenderer.js'
import type { SomeControl } from '../../Controls/IControlFragments.js'

/** Backwards compatibility for modules that expect feedback size */
const moduleFeedbackSize = { width: 72, height: 72 - ButtonDecorationRenderer.DEFAULT_HEIGHT }

/**
 * The size to report to a module for a feedback, so that an advanced feedback can produce an `imageBuffer` of
 * the right dimensions. It is reported for every control which renders a button graphic - which is exactly the
 * controls that own a `drawing` - and omitted for the ones which don't (triggers, expression variables, ...).
 *
 * Note: this deliberately does NOT key off `supportsLayeredStyle`. That flag means "the user may edit this
 * control's layers", which is false for a read-only button such as a preset reference - a button which very
 * much still draws, and whose advanced feedbacks must still be given a size to render into.
 */
export function getFeedbackImageSizeForControl(
	control: SomeControl<any> | undefined
): { width: number; height: number } | undefined {
	return control?.drawing ? moduleFeedbackSize : undefined
}
