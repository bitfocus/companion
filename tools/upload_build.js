var AWS = require('aws-sdk')
var fs = require('fs')

if (process.argv[2] === undefined) {
	console.error('Missing source filename to upload as first argument')
	process.exit(1)
}
if (process.argv[3] === undefined) {
	console.error('Missing destination filename to upload as second argument')
	process.exit(1)
}

if (process.env.BITFOCUS_KEY === undefined || process.env.BITFOCUS_SECRET === undefined) {
	console.error('Missing one of env variables BITFOCUS_KEY, BITFOCUS_SECRET')
	process.exit(1)
}

var s3server = process.env.BITFOCUS_S3 || 's3.bitfocus.io'

var awsS3Client = new AWS.S3({
	s3ForcePathStyle: true,
	credentials: {
		accessKeyId: process.env.BITFOCUS_KEY,
		secretAccessKey: process.env.BITFOCUS_SECRET,
	},
	maxAsyncS3: 12, // this is the default
	s3RetryCount: 2, // this is the default
	s3RetryDelay: 1000, // this is the default
	multipartUploadThreshold: 20971520, // this is the default (20 MB)
	multipartUploadSize: 15728640, // this is the default (15 MB)
	endpoint: 'https://' + s3server,
})

var s3Stream = require('s3-upload-stream')(awsS3Client)

var up = s3Stream.upload({
	Bucket: 'builds',
	Key: 'companion/' + process.argv[3],
	ACL: 'public-read',
	CacheControl: 'max-age=3600',
})

var res = fs.createReadStream(process.argv[2])

up.on('error', function (error) {
	console.log('UPPPP', error)
})

up.on('uploaded', function (details) {
	console.log('UPP Uploaded')
})

res.pipe(up)
