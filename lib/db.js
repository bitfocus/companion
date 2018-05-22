var debug = require('debug')('db');
var fs    = require('fs');

/**
	Simpel KVS som forventer at all data har plass i ram.

	Events: (system objektet)
		* db_loaded(data) - Alle data
		* db_saved(err) - kommandoen db_save ble fullført (eller feilet)

	Svarer på events: (system objektet)
		* db_set(key, value) - Sett key til value
		* db_get(key, cb) - Hent verdi til key i store, emitter svar til 'cb'
		* db_get_multiple([key1,key2], cb) - Henter verdier til flere keys, returnerer som array til 'cb'
		* db_save - Lagrer db fra minne til fil. Svarer med db_saved. (se over)
*/

var lastsave = 0;
var saveInterval = 4000; // Minimum 4 seconds between each save
var dirty = false;

module.exports = exports = function (system,cfgDir) {
	return new db(system, cfgDir);
};

function db(system,cfgDir) {
	debug('new(db)');
	var self = this;
	self._system = system;
	self.db = {};

	try {
		var data = fs.readFileSync(cfgDir + '/db');

		self.db = JSON.parse(data);
		debug('db loaded');
		system.emit('db_loaded', self.db);

	} catch (err) {

		if (err.code == 'ENOENT') {
			debug("readFile(db)","Couldnt read db, loading {}");
			system.emit('db_loaded', {});
		} else {
			throw err;
		}

	}

	system.on("db_all", function(cb) {
		debug("db_all(): returning all database values");
		if (typeof cb == 'function') {
			cb(self.db);
		}
	});

	system.on('db_set', function (key, value) {
		debug('db_set(' + key + ','+value+')');
		self.db[key] = value;
	});

	system.on('db_del', function (key) {
		debug('db_del(' + key + ')');
		delete self.db[key];
	});

	system.on('db_set_multiple', function (keyvalueobj) {
		debug('db_set_multiple:');
		for (var key in keyvalueobj) {
			debug('db_set(' + key + ','+keyvalueobj[key]+')');
			self.db[key] = keyvalueobj[key];
		}
	});


	/*system.on('db_get', function (key, cb) {
		debug('db_get(' + key + ')');
		setImmediate(function () {
			debug('db_get[RETURN](' + key + '): '+self.db[key]);
			system.emit(cb, self.db[key]);
		});
	});*/

	system.on('db_get', function (key, cb) {
		debug('db_get(' + key + ')');
		cb(self.db[key]);
	});
	system.on('db_get_multiple', function (keys, cb) {
		if (typeof keys != 'object' || typeof keys.length == 'undefined') {
			throw new Error('keys is not an array');
		}
		cb(keys.map(function (key) {
			return self.db[key];
		}));
	});

	system.on('db_save', function () {
		if (new Date().getTime() - lastsave > saveInterval) {
			debug("db_save","begin", self.db );

			fs.writeFile(cfgDir + '/db', JSON.stringify(self.db), function (err) {
				if (err) {
					debug('db_save', 'Error saving: ' + err);
					system.emit('db_saved', err);
					return;
				}
				dirty = false;
				debug("db_save","written");
				system.emit('db_saved', null);
			});
			lastsave = new Date().getTime();
		} else {
			dirty = true;
		}
	});

	// Do a save sometime within the next 10 seconds
	system.on('db_dirty', function () {
		dirty = true;
	});

	// If last db_save was not handeled because of throttling, do it now
	setInterval(function () {
		if (new Date().getTime() - lastsave > saveInterval && dirty) {
			system.emit('db_save');
		}
	}, 10000);
};
