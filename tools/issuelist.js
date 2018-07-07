var request = require("request")

var get = function(url,cb) {
	var options = {
		url: url,
		 headers: {
			'User-Agent': 'request'
		},
		json: true
	};

	request(options, function (error, response, body) {

		if (!error) {
			cb(null, response, body);
			return;
		}

		cb(error, null, null);

	});
};

var lineReader = require('readline').createInterface({
	input: require('fs').createReadStream('.gitmodules')
});

lineReader.on('line', function (line) {
	var found;
	if (found = line.match('companion-module-(.+).git')) {
		(function(module) {
			get("http://api.github.com/repos/bitfocus/companion-module-"+module+"/issues", function(err, response, body) {
				if (err === null) {
					for (var i in body) {
						var issue = body[i];
						console.log("["+module+"] #" + issue.number+ ": " + issue.title);
					}
				}
				else {
					console.log("error:",err);
				}
			});
		})(found[1])
	}
});
