exports.models = [
	{
		identifier: 'unknown model',
		productId: [999],
		columns: 4,
		rows: 6,
		hasPS: false,
		banks: 2,
		bankSize: 32,
	},
	{
		identifier: 'XK-24',
		productId: [1029, 1028, 1027, 1249],
		columns: 4,
		rows: 6,
		hasPS: true,
		banks: 2,
		bankSize: 32,
	},
	{
		// This has not been tested
		identifier: 'XK-4',
		productId: [1127, 1128, 1129, 1253, 1049],
		columns: 4,
		rows: 1,
		hasPS: false, // unknown
		banks: 1, // only has blue light
		bankSize: 32, // unknown
	},
	{
		// This has not been tested
		identifier: 'XK-8',
		productId: [1130, 1131, 1132, 1252],
		columns: 8,
		rows: 1,
		hasPS: false, // unknown
		banks: 1, // only has blue light
		bankSize: 32, // unknown
	},
	{
		// This has not been tested
		identifier: 'XK-12 Jog',
		productId: [1062, 1064],
		columns: 4,
		rows: 3,
		hasPS: true,
		hasJog: true,
		jogByte: 8,
		hasShuttle: true,
		shuttleByte: 9,
		banks: 2,
		bankSize: 32,
	},
	{
		// This has not been tested
		identifier: 'XK-12 Joystick',
		productId: [1065, 1067],
		columns: 4,
		rows: 3,
		hasPS: true,
		hasJoystick: true,
		banks: 2,
		bankSize: 32,
	},
	{
		// This has not been tested
		identifier: 'XK-16',
		productId: [1269, 1270, 1050, 1051, 1251],
		columns: 4,
		rows: 4, // not really rows, but the data comes like that (it is physically one row)
		hasPS: false, // unknown
		banks: 1, // only has blue light
		bankSize: 32, // unknown
	},
	{
		// This has not been tested
		identifier: 'XR-32',
		productId: [1279, 1280, 1281, 1282],
		columns: 16,
		rows: 2,
		hasPS: false, // unknown
		bankSize: 128,
	},
	{
		// This has not been tested
		identifier: 'XK-60',
		productId: [1239, 1240, 1121, 1122, 1123, 1254],
		columns: 10,
		rows: 8,
		hasPS: true,
		banks: 2,
		bankSize: 80,
	},
	{
		identifier: 'XK-80',
		productId: [1237, 1238, 1089, 1090, 1091, 1250],
		columns: 10,
		rows: 8,
		hasPS: true,
		banks: 2,
		bankSize: 80,
	},
	{
		identifier: 'XKE-124 T-bar',
		productId: [1275, 1276, 1277, 1278],
		columns: 16,
		rows: 8,
		hasPS: false,
		hasTbar: true,
		tbarByte: 30,
		tbarByteRaw: 31,
		banks: 2,
		bankSize: 128,
		disableKeys: [108, 109, 110, 111],
	},
	{
		identifier: 'XKE-128',
		productId: [1227, 1228, 1229, 1230],
		columns: 16,
		rows: 8,
		hasPS: false, // unknown
		banks: 2,
		bankSize: 128,
	},
	{
		identifier: 'XK-68 Jog-Shuttle',
		productId: [1114, 1116],
		columns: 10,
		rows: 8,
		hasPS: true,
		hasJog: true,
		jogByte: 18,
		hasShuttle: true,
		shuttleByte: 19,
		banks: 2,
		bankSize: 80,
		disableKeys: [29, 30, 31, 37, 38, 39, 45, 46, 47, 53, 54, 55],
	},
	{
		identifier: 'XKE-64 JogT-bar',
		productId: [1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332],
		columns: 10,
		rows: 8,
		hasPS: false,
		hasTbar: true,
		tbarByte: 19,
		tbarByteRaw: 17,
		hasJog: true,
		jogByte: 20,
		hasShuttle: true,
		shuttleByte: 21,
		banks: 2,
		bankSize: 80,
	},
]
