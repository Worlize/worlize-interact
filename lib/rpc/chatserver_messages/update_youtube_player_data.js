var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message')
    _ = require('underscore');
    
var logger = Log.getLogger('rpc.chatserver_messages.UpdateYouTubePlayerDataMessage');

var UpdateYouTubePlayerDataMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.youtubePlayer = null;
    this.roomGuid = null;
    this._encodedMessage = null;
};
util.inherits(UpdateYouTubePlayerDataMessage, Message);

UpdateYouTubePlayerDataMessage.messageId = "update_youtube_player_data";
UpdateYouTubePlayerDataMessage.acceptFromClient = true;

UpdateYouTubePlayerDataMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to update YouTube Player data.", user.logNotation);
            return;
        }
        if (message.data.data) {
            if (typeof(message.data.guid) !== 'string') {
                logger.error("YouTube Player guid must be specified as a string.", user.logNotation);
                return;
            }
            
            if (!_.isObject(message.data)) {
                logger.error("User attempted to set non-object as YouTube Player Data", user.logNotation);
                return;
            }
            
            self.youtubePlayer = user.currentRoom.definition.getItemByGuid(message.data.guid);
            self.roomGuid = user.currentRoom.guid;
            
            if (self.youtubePlayer) {
                self.youtubePlayer.data = message.data.data;
                
                user.currentRoom.definition.save(function(err) {
                    if (err) {
                        logger.error("There was an error while updating YouTube Player data: " + err.toString(), user.logNotation);
                        return;
                    }
                    user.currentRoom.broadcast(self);
                });
            }
            else {
                logger.error("Tried to update data of nonexistent YouTube Player " + message.data.guid, user.logNotation);
            }
        }
    });
};

UpdateYouTubePlayerDataMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

UpdateYouTubePlayerDataMessage.prototype.getSerializableHash = function() {
    return {
        msg: UpdateYouTubePlayerDataMessage.messageId,
        data: {
            room: this.roomGuid,
            player: this.youtubePlayer
        }
    };
};

module.exports = UpdateYouTubePlayerDataMessage;