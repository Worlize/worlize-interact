var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.RemoveYouTubePlayerMessage');

var RemoveYouTubePlayerMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.youtubePlayer = null;
    this.roomGuid = null;
    this._encodedMessage = null;
};
util.inherits(RemoveYouTubePlayerMessage, Message);

RemoveYouTubePlayerMessage.messageId = "remove_youtube_player";
RemoveYouTubePlayerMessage.acceptFromClient = true;

RemoveYouTubePlayerMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to remove YouTube Player.", user.logNotation);
            return;
        }
        if (message.data) {
            if (typeof(message.data.guid) !== 'string') {
                logger.error("YouTube Player guid must be specified as a string.", user.logNotation);
                return;
            }
            
            self.youtubePlayer = user.currentRoom.definition.removeItem(message.data.guid);
            self.roomGuid = user.currentRoom.guid;
            
            if (self.youtubePlayer) {
                user.currentRoom.definition.save(function(err) {
                    if (err) {
                        logger.error("There was an error while deleting a YouTube Player: " + err.toString(), user.logNotation);
                        return;
                    }
                    user.currentRoom.broadcast(self);
                });
            }
            else {
                logger.error("Tried to remove nonexistent YouTube Player " + message.data.guid, user.logNotation);
            }
        }
    });
};

RemoveYouTubePlayerMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

RemoveYouTubePlayerMessage.prototype.getSerializableHash = function() {
    return {
        msg: RemoveYouTubePlayerMessage.messageId,
        data: {
            room: this.roomGuid,
            guid: this.youtubePlayer.guid
        }
    };
};

module.exports = RemoveYouTubePlayerMessage;