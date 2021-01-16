import React from 'react'
import classnames from 'classnames'
import { PREVIEW_BMP_HEADER } from '../Constants';

export const BlackImage = dataToButtonImage(Buffer.concat([PREVIEW_BMP_HEADER, Buffer.alloc(72 * 72 * 3)]))

export function dataToButtonImage(data) {
	const sourceData = Buffer.from(data);

	const convertedData = Buffer.alloc(sourceData.length)
	for (let i = 0; i < sourceData.length; i += 3) {
		// convert bgr to rgb 
		convertedData.writeUInt8(sourceData.readUInt8(i), i + 2)
		convertedData.writeUInt8(sourceData.readUInt8(i + 1), i + 1)
		convertedData.writeUInt8(sourceData.readUInt8(i + 2), i)
	}

	return 'data:image/bmp;base64,' + Buffer.concat([PREVIEW_BMP_HEADER, convertedData]).toString('base64')
}

export function BankPreview(props) {
	return (
		<div
			ref={props.dropRef}
			className={classnames({ bank: true, fixed: !!props.fixedSize, drophere: props.canDrop, drophover: props.dropHover, selected: props.selected })}
			onMouseDown={() => props.onClick(props.index, true)}
			onMouseUp={() => props.onClick(props.index, false)}
		>
			<div className="bank-border">
				<img ref={props.dragRef} width={72} height={72} src={props.preview ?? BlackImage} alt={props.alt} />
			</div>
		</div>
	)
}
