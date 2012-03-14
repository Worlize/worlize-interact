var Log                    = require('./util/log'),
    fs                     = require('fs'),
    os                     = require('os'),
    url                    = require('url'),
    serverConfig           = require('./config'),
    RoomManager            = require('./model/room_manager'),
    Session                = require('./model/session'),
    User                   = require('./model/user'),
    DisconnectMessage      = require('./rpc/chatserver_messages/disconnect'),
    RoomRedirectMessage    = require('./rpc/chatserver_messages/room_redirect'),
    MessageRouter          = require('./rpc/message_router'),
    redisConnectionManager = require('./model/redis_connection_manager');
    
var logger = Log.getLogger("ChatServer");

function ChatServer(serverId) {
    this.statusUpdateIntervalId = null;
    this.mountPath = null;
    this.mountProtocol = null;
    this.webSocketRouter = null;
    this.userCount = 0;

    this.serverId = serverId;
    this.usersByGuid = {};
    this.roomManager = new RoomManager(this);
    this.roomServerAssignmentsDB = redisConnectionManager.getClient('room_server_assignments');

    // Initialize client message router
    this.messageRouter = new MessageRouter(this, __dirname + "/rpc/chatserver_messages", true);
}

ChatServer.prototype.mount = function(webSocketRouter) {
    this.webSocketRouter = webSocketRouter;
    
    this.mountPath = "/" + this.serverId + "/";
    this.mountProtocol = 'worlize-interact';
    
    this.webSocketRouter.mount(
        this.mountPath,
        this.mountProtocol,
        this.handleWebSocketRequest.bind(this)
    );

    this.addRedisStateInformation();
    this.startRedisStatusUpdates();
    
    this.syncUserCountInterval = setInterval(this.syncUserCount.bind(this), 60000);
    
    logger.info("Worlize ChatServer Ready.");
    logger.info("Handling requests at path '/" + this.serverId + "/', subprotocol 'worlize-interact'");
};

ChatServer.prototype.syncUserCount = function() {
    var oldUserCount = this.userCount;
    this.userCount = Object.keys(this.usersByGuid).length;
    logger.debug("Synchronized userCount.  oldUserCount=" + oldUserCount + " userCount=" + this.userCount);
};

ChatServer.prototype.unmount = function() {
    this.webSocketRouter.unmount(this.mountPath, this.mountProtocol);
    logger.info("Unmounted WebSocket handler for path " + this.mountPath + " and protocol " + this.mountProtocol);
};

ChatServer.prototype.shutDown = function(callback) {
    logger.info("Initiating ShutDown");
    
    if (this.syncUserCountInterval) {
        clearInterval(this.syncUserCountInterval);
    }
    this.stopRedisStatusUpdates();
    this.removeRedisStateInformation();
    this.unmount();
    this.disconnectAllUsers(callback);
};

ChatServer.prototype.disconnectAllUsers = function(callback) {
    var self = this;
    
    var guids = Object.keys(this.usersByGuid);
    if (guids.length !== this.userCount) {
        logger.error("userCount (" + this.userCount + ") does not match " +
                     "number of entries in usersByGuid (" + guids.length +
                     "). Setting userCount to match.");
        this.userCount = guids.length;
    }
    
    // If nobody is connected just call the callback now.
    if (this.userCount === 0) {
        logger.info("No WebSocket connections active, so shutting down immediately.");
        logger.info("ShutDown Complete");
        callback(null);
        return;
    }
    
    function handleUserCloseCallback() {
        if (self.userCount === 0) {
            logger.info("ShutDown Complete");
            callback(null);
        }
    }

    var disconnectMessage = new DisconnectMessage(this);
    disconnectMessage.errorCode = 1005;
    disconnectMessage.errorMessage = "Server is shutting down.";
    
    for (var i=0,len=guids.length; i < len; i++) {
        var guid = guids[i];
        var user = this.usersByGuid[guid];
        user.connection.once('close', handleUserCloseCallback);
        user.sendMessage(disconnectMessage);
        user.connection.drop(1000);
    }
};

ChatServer.prototype.handleWebSocketRequest = function(request) {
    var self = this;
    var parsedUrl = url.parse(request.resource, true);
    var params = parsedUrl.query;
    var sessionId = params['session'];
    var session;
    var user;
    var room;
    var logNotation = {
        ip: request.remoteAddress
    };
    
    logger.info("action=websocket_request WebSocket Request from " + request.remoteAddress + " origin: " + request.origin);
    
    request.on('requestRejected', function() {
        // Log the rejection
        logger.info("Request from " + request.remoteAddress + " rejected.", logNotation);
    });
    
    // TODO: Verify origin of WebSocket request.

    // Make sure the client provided a session guid
    if (typeof(sessionId) !== 'string') {
        request.reject(500);
        return;
    }
    
    // Look up the user's session in the db...
    Session.load(sessionId.toLowerCase(), function(err, result) {
        if (err) {
            // And if we can't find it, disconnect them.
            logger.error("Unable to load session " + sessionId + ": " + err.toString(), logNotation);
            request.reject(404, "Cannot load session");
            return;
        }
        session = result;
        logNotation.user = session.userGuid;
        loadUser();
    });
    
    // If we do get a session...
    function loadUser() {
        // Load the user
        User.load(session.userGuid, session.userName, function(err, result) {
            if (err) {
                // If we can't load the user, drop the connection.
                logger.error("Unable to load user: " + err.toString(), logNotation);
                request.reject(404, "Cannot load user");
                return;
            }
            user = result;

            // Keep the logNotation around as part of the user object so that we
            // can pass it to the logger whenever it's available to make parsing
            // the logs for user sessions more feasible.
            user.logNotation = logNotation;
            
            // Stash a reference to the session in the user object
            user.session = session;
            checkForDuplicateConnections();
        });
    }

    // If we do get the user...
    function checkForDuplicateConnections() {
        // ... check to make sure the user isn't already connected
        var existingUser = self.usersByGuid[user.guid];
        if (existingUser) {
            // If they are, close the old connection.
            logger.warn("action=disconecting_dup Disconnecting other user with same guid: " + existingUser.guid, logNotation);
            disconnectMessage = new DisconnectMessage();
            disconnectMessage.errorCode = 1003;
            disconnectMessage.errorMessage = "You have logged on from another location.";
            disconnectMessage.send(existingUser);
            existingUser.connection.drop(1000); // 1000 = Normal close code
        }
        
        // Continue to next step
        verifyRoomExists();
    }
    
    function verifyRoomExists() {
        // Next we verify that we actually host the room that is being
        // requested
        self.roomManager.verifyRoomIsOnThisServer(session.roomGuid, function(err, result) {
            if (err) {
                logger.error("There was an error while checking which interactivity server hosts room " +
                             session.roomGuid + " - " + err, logNotation);
                request.reject(500, "Unable to verify room server");
                return;
            }

            // If the room isn't hosted on this server, accept the
            // connection just long enough to inform the client.
            if (!result) {
                logger.warn("Requested room '" + session.roomGuid +
                            "' is not hosted here.  Informing client.", logNotation);
                var connection = request.accept(request.origin);
                var redirectMessage = new RoomRedirectMessage();
                redirectMessage.roomGuid = session.roomGuid;
                redirectMessage.send({
                    // fake a user object.
                    logNotation: logNotation,
                    connection: connection
                });
                connection.close();
                return;
            }
            loadRoom();
        });
    }
    
    // If verification is successful, load the room
    function loadRoom() {
        self.roomManager.getRoom(session.roomGuid, function(err, result) {
            if (err) {
                logger.error("Error while loading room " + session.roomGuid +
                             ": " + err, logNotation);
                request.reject(500, "Unable to load requested room");
                return;
            }
            room = result;
            
            // Now that the room is loaded, verify that the user may enter.
            verifyPermissionToEnter();
        });
    }
    
    function verifyPermissionToEnter() {
        if (room.mayUserEnter(user.guid)) {
            establishConnection();
        }
        else {
            logger.warn("Kicked user attempted to enter room '" + session.roomGuid, logNotation);
            var connection = request.accept(request.origin);
            var redirectMessage = new RoomRedirectMessage();
            // Send user back to their home room.
            redirectMessage.roomGuid = "home";
            redirectMessage.send({
                // fake a user object.
                logNotation: logNotation,
                connection: connection
            });
            connection.close();
            
            // If this is an empty room, make sure to unload it
            room.checkIfRoomIsEmpty();
            return;
        }
    }

    // All is well, so we accept the connection.
    function establishConnection() {
        var connection = request.accept(request.origin);
        connection.acceptedAt = (new Date()).valueOf();

        logger.info("action=connection_accept WebSocket connection established for user '" + user.userName + "'", logNotation);
        
        user.connection = connection;
        self.usersByGuid[user.guid] = user;
        
        // Increment the server's user count and update this server's score
        // in the Redis sorted set of servers
        self.userCount ++;
        self.roomServerAssignmentsDB.zadd('serverIds', self.userCount, self.serverId, function(err, result) {
            if (err) {
                logger.error("Unable to update the user count for the server in the redis database: " +
                             err.toString(), logNotation);
            }
        });

        // init detailed logging if we're running at log level debug3
        if (logger.shouldLogLevel('debug3')) {
            (function() {
                if (!self.handleClientMessage.extraDebugging) {
                    var originalMessageHandler = self.handleClientMessage;
                    self.handleClientMessage = function(user, message) {
                        if (message.type === 'utf8') {
                            logger.debug3("Received message: " + message.utf8Data, user.logNotation);
                        }
                        else if (message.type === 'binary') {
                            var msgID = "unknown";
                            var msgIDNum = 0;
                            if (message.binaryData.length >= 4) {
                                msgID = message.binaryData.toString('ascii', 0, 4);
                                msgIDNum = message.binaryData.readUint32BE(0, true);
                            }
                            logger.debug3("Received binary message '" +
                                           msgID + "' (0x" + msgIDNum.toString(16) + ") of " +
                                           message.binaryData.length + " bytes.", user.logNotation);
                        }
                        originalMessageHandler.call(this, user, message);
                    };
                    self.handleClientMessage.extraDebugging = true;
                }

                var originalSendUTF = connection.sendUTF;
                connection.sendUTF = function(data) {
                    logger.debug3("Sending message: " + data, user.logNotation);
                    originalSendUTF.call(connection, data);
                }
            })();
        }

        // Set up the connection's event handlers
        connection.on('close', self.handleClientClose.bind(self, user));
        connection.on('message', self.handleClientMessage.bind(self, user));
        connection.on('error', self.handleClientError.bind(self, user));
        
        // Finally, enter the user into the room.
        room.addUser(user);
        
        // We're done!  The connection is established!
    }
};

ChatServer.prototype.handleClientMessage = function(user, message) {
    if (message.type === 'utf8') {
        try {
            var decodedMessage = this.messageRouter.decodeMessage(message.utf8Data);
            this.messageRouter.routeMessage(decodedMessage, user);
        }
        catch (e) {
            logger.error("Error while processing incoming message: " + e.toString() +
                         " - Message: " + message.utf8Data, user.logNotation);
        }
        return;
    }
    if (message.type === 'binary') {
        // try {
            this.messageRouter.routeBinaryMessage(message.binaryData, user);
        // }
        // catch (e) {
        //     logger.error("Error while processing incoming binary message: " + e.toString() +
        //                  " - Message length: " + message.binaryData.length, user.logNotation);
        // }
        return;
    }
    logger.error("Unhandled WebSocket message type '" + message.type + "' from user " +
                 user.guid + " - " + user.userName + " - closing connection.", user.logNotation);
    connection.drop(1008); // 1008 = Policy Violation
};

ChatServer.prototype.handleClientClose = function(user) {
    var duration = Math.round(((new Date()).valueOf() - user.connection.acceptedAt) / 1000);
    logger.info("WebSocket Connection Closed action=connection_close duration=" + duration, user.logNotation);
    
    this.userCount --;
    // Update this server's score in the Redis sorted set of servers
    this.roomServerAssignmentsDB.zadd('serverIds', this.userCount, this.serverId, function(err, result) {
        if (err) {
            logger.error("Unable to update the user count for the server in the redis database: " +
                         err.toString(), user.logNotation);
        }
    });

    delete this.usersByGuid[user.guid];
    user.destroy();
};

ChatServer.prototype.handleClientError = function(user, error) {
    logger.error("action=websocket_error WebSocket Error: " + error.toString(), user.logNotation)
};

ChatServer.prototype.addRedisStateInformation = function() {
    // Initialize the state for this interactivity server
    this.roomServerAssignmentsDB.zadd('serverIds', 0, this.serverId, function(err, result) {
        if (err) {
            logger.error("Unable to add the current serverid to the sorted set of server ids in redis: " + err.toString());
        }
    });
};

ChatServer.prototype.removeRedisStateInformation = function() {
    var multi = this.roomServerAssignmentsDB.multi();
    multi.del("serverStatus:" + this.serverId);
    multi.zrem("serverIds", this.serverId);
    multi.exec(function(err, result) {
        if (err) {
            logger.error("Unable to remove redis state information: " + err.toString());
        }
    });
};

ChatServer.prototype.startRedisStatusUpdates = function() {
    var self = this;
    this.updatePresenceDatabase();
    this.statusUpdateIntervalId = setInterval(
        this.updatePresenceDatabase.bind(this),
        500
    );
};

ChatServer.prototype.stopRedisStatusUpdates = function() {
    if (this.statusUpdateIntervalId) {
        clearInterval(this.statusUpdateIntervalId);
        this.statusUpdateIntervalId = null;
    }
};

ChatServer.prototype.updatePresenceDatabase = function() {
    var self = this;
    var obj = {
        server_id: this.serverId,
        port: this.port,
        host: os.hostname(),
        last_checkin: (new Date()).toISOString(),
        user_count: this.userCount
    };
    // This must be updated very frequently to make sure the data is fresh.
    // The key is set to expire in two seconds, and will be refreshed every 0.5 seconds
    this.roomServerAssignmentsDB.setex("serverStatus:" + this.serverId, 2, JSON.stringify(obj), function(err, result) {
        if (err) {
            logger.error("Unable to update serverStatus:" + self.serverId + " key in redis room server database: " + err.toString());
        }
    })
};

module.exports = ChatServer;