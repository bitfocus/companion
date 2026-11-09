import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { DrawBounds } from '@companion-app/shared/Graphics/Util.js'
import type { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import type { DisplayedSize } from './DisplayedLocations.js'

/** The size of the content area of a button of a size, which is what is left of it by its decoration */
export function contentSizeOf(size: DisplayedSize, decoration: ButtonGraphicsDecorationType): DisplayedSize {
	const content = GraphicsLayeredButtonRenderer.computeContentBounds(
		new DrawBounds(0, 0, size.width, size.height),
		decoration
	)
	return { width: content.width, height: content.height }
}
