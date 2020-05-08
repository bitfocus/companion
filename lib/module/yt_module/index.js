var instance_skel = require("../../instance_skel");
const {google} = require("googleapis");
var fs = require("fs");
const url = require("url");
const http = require("http");
const opn = require("opn");
const destroyer = require('server-destroy');

function instance(system, id, config) {
	var self = this;

	instance_skel.apply(this, arguments);

    self.actions();
    
	return self;
};

instance.prototype.updateConfig = function(config){
    var self = this;
    self.config = config;
    console.log("Update config YT_module")
    self.destroy();
    self.init();
}

instance.prototype.init = function(){
    console.log("Init YT_module")
    var self = this;
    var yt_dir_path = self.config.path_to_yt_directory;
    var secrets_file_path = yt_dir_path + "client-secret.json";
    var token_path = yt_dir_path + "token.json";

    var scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"];

    if (yt_dir_path) {
        if (fs.lstatSync(secrets_file_path).isFile()) {
            var config_file = fs.readFileSync(secrets_file_path);
            var config_json = JSON.parse(config_file);
            var client_id = config_json["web"]["client_id"];
            var client_secret = config_json["web"]["client_secret"];
            console.log("client_seceret: " + client_secret);
            var redirect_url = config_json["web"]["redirect_uris"][0];

            self.yt_api_handler = new Youtube_api_handler(client_id, client_secret, redirect_url, scopes, token_path);
            if (fs.existsSync(token_path)){
                if (fs.lstatSync(token_path).isFile()){
                    console.log("Token file (token.json) is provided");
            
                    fs.readFile(token_path, (error, token) => {
                        if (error) {
                            let promise = self.yt_api_handler.oauth_login()
                            promise.then(acces_credentials => {
                                self.yt_api_handler.oauth2client.credentials = acces_credentials;
                                self.yt_api_handler.create_yt_service();
                                let get_broadcasts = self.yt_api_handler.get_all_broadcasts();
                                get_broadcasts.then(streams_dict => {
                                    self.yt_api_handler.streams_dict = streams_dict;
                                    console.log(self.yt_api_handler.streams_dict);
                                    self.actions();
                                });
                                get_broadcasts.catch(console.error); 
                            });
                            promise.catch(console.error);    
                        } else {
                            self.yt_api_handler.oauth2client.credentials = JSON.parse(token);
                            self.yt_api_handler.create_yt_service();
                            let get_broadcasts = self.yt_api_handler.get_all_broadcasts();
                            get_broadcasts.then(streams_dict => {
                                self.yt_api_handler.streams_dict = streams_dict;
                                console.log(self.yt_api_handler.streams_dict);
                                self.actions();
                            });
                            get_broadcasts.catch(console.error); 
                        }
                    });
                } else {
                    console.log("Token file (token.json) cannot be used, you need to sign in")
                    let promise = self.yt_api_handler.oauth_login()
                    promise.then(acces_credentials => {
                        self.yt_api_handler.oauth2client.credentials = acces_credentials;
                        self.yt_api_handler.create_yt_service();
                        let get_broadcasts = self.yt_api_handler.get_all_broadcasts();
                        get_broadcasts.then(streams_dict => {
                            self.yt_api_handler.streams_dict = streams_dict;
                            console.log(self.yt_api_handler.streams_dict);
                            self.actions();
                        });
                        get_broadcasts.catch(console.error); 
                    });
                    promise.catch(console.error); 
                }
            } else {
                console.log("Token file (token.json) does not exist, you need to sign in.")
                let promise = self.yt_api_handler.oauth_login()
                    promise.then(acces_credentials => {
                        self.yt_api_handler.oauth2client.credentials = acces_credentials;
                        self.yt_api_handler.create_yt_service();
                        let get_broadcasts = self.yt_api_handler.get_all_broadcasts();
                        get_broadcasts.then(streams_dict => {
                            self.yt_api_handler.streams_dict = streams_dict;
                            console.log(self.yt_api_handler.streams_dict);
                            self.actions();
                        });
                        get_broadcasts.catch(console.error); 
                    });
                    promise.catch(console.error); 
            }
            
        }

    } else {
        console.error("Path to YouTube operating directory is not provided");
    }
};

instance.prototype.destroy = function(){
    var self = this;
    self.stream_to_start_list = [];
    self.stream_to_stop_list = [];
};

instance.prototype.config_fields = function(){
    var self = this;
    return [
        {
            type: 'text',
            id: 'info',
            width: 12,
            label: 'Information',
            value: "The path to the folder should contain / or \\ at the end. (Depends on your system -> Unix: / ; Win: \\)"
        },
        {
            type: "textinput",
            id: "path_to_yt_directory",
            label: "Path to YouTube working directory:",
            width: 4,
            required: true
        }
    ]
};

instance.prototype.actions = function(system){
    var self = this;

    self.streams_list_to_display = [];

    if (self.yt_api_handler !== undefined){    
        for (var key in self.yt_api_handler.streams_dict){
            self.streams_list_to_display.push({id : key, label : self.yt_api_handler.streams_dict[key]});
            }
    }

    self.setActions({
        "start_stream": {
            label: "Start stream",
            options: [{
                type: "dropdown",
                label: "Stream:",
                id: "stream_to_start",
                choices: self.streams_list_to_display
            }]
        },
        "stop_stream": {
            label: "Stop stream",
            options: [{
                type: "dropdown",
                label: "Stream:",
                id: "stream_to_stop",
                choices: self.streams_list_to_display
            }]
        }
    });
    self.system.emit('instance_actions', self.id, self.setActions);
};

instance.prototype.action = function(action){
    var self = this;
    if (action.action == "start_stream"){
        streams_starter = self.yt_api_handler.set_broadcast_live(action.options["stream_to_start"]);
        streams_starter.then(response => {
            self.log("info", "YouTube stream was set live successfully");
            return;
        });
        streams_starter.catch(err => {
            self.log("debug", "Error occured during stream state actualization, details: " + err);
            return;
        });
    }
    else if (action.action == "stop_stream"){
        streams_stopper = self.yt_api_handler.set_broadcast_finished(action.options["stream_to_stop"]);
        streams_stopper.then(response => {
            self.log("info", "YouTube stream finished successfully");
            return;
        });
        streams_stopper.catch(err => {
            self.log("debug","Error occured during finishing a stream, details: " + err);
            return;
        });
    }
}

class Youtube_api_handler {
    constructor(client_id, client_secret, redirect_url, scopes, token_path) {
        this.streams_dict = {};
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.redirect_url = redirect_url;
        this.scopes = scopes;
        this.token_path = token_path;
        this.oauth2client = new google.auth.OAuth2(
            this.client_id,
            this.client_secret,
            this.redirect_url
        );
        google.options({auth: this.oauth2client});
    }
    async oauth_login() {
        return new Promise((resolve, reject) => {
            // grab the url that will be used for authorization
            const authorizeUrl = this.oauth2client.generateAuthUrl({
              access_type: 'offline',
              scope: this.scopes.join(' '),
            });
            console.log(authorizeUrl);
            const server = http
              .createServer(async (req, res) => {
                try {
                    console.log(req.url);
                    if (req.url.indexOf("code=") !== -1){
                        const qs = new url.URL(req.url, 'http://localhost:3000')
                        .searchParams;
                        console.log(qs)
                        res.end('Authentication successful! Please return to the Companion.');
                        console.log("Code: " + qs.get("code"));
                        const {tokens} = await this.oauth2client.getToken(qs.get('code'));
                        console.log("Credentials: " + tokens);
                        fs.writeFile(this.token_path, JSON.stringify(tokens), (error) => {
                            if (error) return console.log("Error in saving token, details: " + error);
                        });
                        server.destroy();
                        resolve(tokens);
                    }
                } catch (e) {
                  console.log("Callback request processing error; " + req.url + " detail: " + e);
                  reject(e);
                }
              })
              .listen(3000, () => {
                // open the browser to the authorize url to start the workflow
                opn(authorizeUrl, {wait: false}).then(cp => cp.unref());
              });
            destroyer(server);
            console.log("Server destroyed");
          });
        }
    async create_yt_service() {
        console.log("Creating youtube service.");
        this.youtube_service = google.youtube({
            version : "v3",
            auth : this.oauth2client
        });
    }
    async create_live_broadcast(title, scheduled_start_time, record_from_start, enable_dvr, privacy_status) {
        return new Promise((resolve, reject) => {
            this.youtube_service.liveBroadcasts.insert({
                "part" : "snippet, contentDetails, staus",
                "resource" : {
                    "snippet" : {
                        "title" : title,
                        "scheduledStartTime" : scheduled_start_time,
                    },
                    "contentDetails" : {
                        "recordFromStart" : record_from_start,
                        "enableDvr" : enable_dvr
                    },
                    "status" : {
                        "privacyStatus" : privacy_status
                    }
                }
            }).then(function(response) {
                console.log("Broadcast created successfully ; details: " + response);
                resolve(response);
            }, function(err) {
                console.log("Error during execution of create live broadcast action ; details: " + err);
                reject(err);
            })
        });
    }
    async create_live_stream(){}

    async get_all_broadcasts() {
        return new Promise((resolve, reject) => {
            this.youtube_service.liveBroadcasts.list({
                "part" : "snippet, contentDetails, status",
                "broadcastType" : "all",
                "mine" : true
            }).then(function(response) {
                let streams_dict = {};
                response.data.items.forEach(function(item, index) {
                    streams_dict[item.id] = item.snippet.title;
                })
                resolve(streams_dict);
            }, function(err) {
                Console.log("Error retreaving list of streams")
                reject(err);
            });
        });
    }
    
    async set_broadcast_live(id) {
        return new Promise((resolve, reject) => {
            this.youtube_service.liveBroadcasts.transition({
                "part" : "snippet, contentDetails, status",
                "id" : id,
                "broadcastStatus" : "live"
            }).then(function(response){
                resolve(response);
            }, function(err){
                reject(err);
            });
        });
    }

    async set_broadcast_finished(id) {
        return new Promise((resolve, reject) => {
            this.youtube_service.liveBroadcasts.transition({
                "part" : "snippet, contentDetails, status",
                "id" : id,
                "broadcastStatus" : "complete"
            }).then(function(response){
                resolve(response);
            }, function(err) {
                reject(err);
            });
        });
    }
}


instance_skel.extendedBy(instance); 
exports = module.exports = instance;