import React from 'react'
import classnames from 'classnames'
import { PREVIEW_BMP_HEADER } from '../Constants'
import { Buffer } from 'buffer'

export function dataToButtonImage(data) {
	const sourceData = Buffer.from(data)
	const imageSize = Math.sqrt(sourceData.length / 3)

	const bmpHeaderSize = 54
	const bmpHeader = Buffer.alloc(bmpHeaderSize)
	bmpHeader.write('BM', 0, 2) // flag
	bmpHeader.writeUInt32LE(sourceData.length + bmpHeaderSize, 2) // filesize
	bmpHeader.writeUInt32LE(0, 6) // reserver
	bmpHeader.writeUInt32LE(bmpHeaderSize, 10) // data start

	bmpHeader.writeUInt32LE(40, 14) // header info size
	bmpHeader.writeUInt32LE(imageSize, 18) // width
	bmpHeader.writeInt32LE(imageSize * -1, 22) // height
	bmpHeader.writeUInt16LE(1, 26) // planes
	bmpHeader.writeUInt16LE(24, 28) // bits per pixel
	bmpHeader.writeUInt32LE(0, 30) // compress
	bmpHeader.writeUInt32LE(sourceData.length, 34) // data size
	bmpHeader.writeUInt32LE(0, 38) // hr
	bmpHeader.writeUInt32LE(0, 42) // vr
	bmpHeader.writeUInt32LE(0, 46) // colors
	bmpHeader.writeUInt32LE(0, 48) // importantColors

	const convertedData = Buffer.alloc(sourceData.length)
	for (let i = 0; i < sourceData.length; i += 3) {
		// convert bgr to rgb
		convertedData.writeUInt8(sourceData.readUInt8(i), i + 2)
		convertedData.writeUInt8(sourceData.readUInt8(i + 1), i + 1)
		convertedData.writeUInt8(sourceData.readUInt8(i + 2), i)
	}

	return 'data:image/bmp;base64,' + Buffer.concat([bmpHeader, convertedData]).toString('base64')
}

export const BlackImage = dataToButtonImage(Buffer.alloc(72 * 72 * 3))
export const RedImage = dataToButtonImage(Buffer.alloc(72 * 72 * 3, Buffer.from([255, 0, 0])))

export const ButtonPreview = React.memo(function (props) {
	const classes = {
		bank: true,
		fixed: !!props.fixedSize,
		drophere: props.canDrop,
		drophover: props.dropHover,
		draggable: !!props.dragRef,
		selected: props.selected,
		clickable: !!props.onClick,
		right: !!props.right,
	}

	return (
		<div
			ref={props.dropRef}
			className={classnames(classes)}
			onMouseDown={() => props?.onClick?.(props.index, true)}
			onMouseUp={() => props?.onClick?.(props.index, false)}
			onTouchStart={(e) => {
				e.preventDefault()
				props?.onClick?.(props.index, true)
			}}
			onTouchEnd={(e) => {
				e.preventDefault()
				props?.onClick?.(props.index, false)
			}}
			onTouchCancel={(e) => {
				e.preventDefault()
				e.stopPropagation()

				props?.onClick?.(props.index, false)
			}}
			onContextMenu={(e) => {
				e.preventDefault()
				e.stopPropagation()
				return false
			}}
		>
			<div className="bank-border">
				<img
					ref={props.dragRef}
					width={72}
					height={72}
					src={props.preview ?? BlackImage}
					alt={props.alt}
					title={props.title}
				/>
			</div>
		</div>
	)
})
