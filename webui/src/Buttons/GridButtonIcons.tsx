import { memo, useMemo } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ButtonPreview } from '~/Components/ButtonPreview.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'

/**
 * A grid cell that draws a button but does not interact with the grid's selection or tools - just a
 * preview at a position. The infinite grid uses its own store-coupled cell; these are for the
 * lighter grids elsewhere (the action recorder's button picker, and the import preview).
 */

interface ButtonGridIconBaseProps {
	pageNumber: number
	column: number
	row: number
	image: string | null
	left: number
	top: number

	fixedSize?: boolean
	dropRef?: React.RefCallback<HTMLDivElement>
	dropHover?: boolean
	canDrop?: boolean
	onClick?: (location: ControlLocation, pressed: boolean) => void
	onContextMenu?: (location: ControlLocation, x: number, y: number) => void
	selected?: boolean
	copySource?: boolean
	contextMenuOpen?: boolean
}

export const ButtonGridIconBase = memo(function ButtonGridIconBase({
	pageNumber,
	column,
	row,
	image,
	left,
	top,
	...props
}: ButtonGridIconBaseProps) {
	const location: ControlLocation = useMemo(() => ({ pageNumber, column, row }), [pageNumber, column, row])
	const style = useMemo(() => ({ left, top }), [left, top])

	const title = formatLocation(location)
	return (
		<ButtonPreview
			{...props}
			style={style}
			location={location}
			title={title}
			placeholder={`${location.row}/${location.column}`}
			preview={image}
		/>
	)
})

// This resolves the image itself, so callers never supply one
type ButtonGridIconProps = Omit<ButtonGridIconBaseProps, 'image'>

export const ButtonGridIcon = memo(function ButtonGridIconWithImage({ ...props }: ButtonGridIconProps) {
	const { image, isUsed } = useButtonImageForLocation({
		pageNumber: Number(props.pageNumber),
		column: props.column,
		row: props.row,
	})

	return <ButtonGridIconBase {...props} image={isUsed ? image : null} />
})
