import React from 'react'
import classnames from 'classnames'

// Single pixel of black
export const BlackImage =
	'data:image/bmp;base64,Qk2OAAAAAAAAAIoAAAB8AAAAAQAAAP////8BACAAAwAAAAQAAAAnAAAAJwAAAAAAAAAAAAAA/wAAAAD/AAAAAP8AAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
// Single pixel of red
export const RedImage =
	'data:image/bmp;base64,Qk2OAAAAAAAAAIoAAAB8AAAAAQAAAP////8BACAAAwAAAAQAAAAnAAAAJwAAAAAAAAAAAAAA/wAAAAD/AAAAAP8AAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAA=='

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
			onMouseDown={() => props?.onClick?.(props.location, true)}
			onMouseUp={() => props?.onClick?.(props.location, false)}
			onTouchStart={(e) => {
				e.preventDefault()
				props?.onClick?.(props.location, true)
			}}
			onTouchEnd={(e) => {
				e.preventDefault()
				props?.onClick?.(props.location, false)
			}}
			onTouchCancel={(e) => {
				e.preventDefault()
				e.stopPropagation()

				props?.onClick?.(props.location, false)
			}}
			onContextMenu={(e) => {
				e.preventDefault()
				e.stopPropagation()
				return false
			}}
		>
			<div
				className="bank-border"
				ref={props.dragRef}
				style={{
					backgroundImage: `url(${props.preview})`,
					backgroundSize: '0%',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat',
				}}
			>
				<img width={72} height={72} src={props.preview ?? BlackImage} alt={props.alt} title={props.title} />
			</div>
		</div>
	)
})
