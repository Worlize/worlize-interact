var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message'),
    YouTubePlayer = require('../../model/room_definition/youtube_player');
    
var logger = Log.getLogger('rpc.chatserver_messages.AddYouTubePlayerMessage');

var guidRegexp = /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/;

var AddYouTubePlayerMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.youtubePlayer = null;
    this.roomGuid = null;
    this._encodedMessage = null;
};
util.inherits(AddYouTubePlayerMessage, Message);

AddYouTubePlayerMessage.messageId = "add_youtube_player";
AddYouTubePlayerMessage.acceptFromClient = true;

AddYouTubePlayerMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (err) {
            logger.error("Unable to check whether the current user can author: " + err.toString, user.logNotation);
            return;
        }
        if (!result) {
            logger.error("Unauthorized attempt to add YouTube player.", user.logNotation);
            return;
        }
        self.youtubePlayer = new YouTubePlayer();
        user.currentRoom.definition.items.push(self.youtubePlayer);
        user.currentRoom.definition.save(function(err) {
            if (err) {
                logger.error("Error while adding YouTube player: " + err.toString(), user.logNotation);
                return;
            }
            self.roomGuid = user.currentRoom.guid;
            user.currentRoom.broadcast(self);
        });
    });
};

AddYouTubePlayerMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

AddYouTubePlayerMessage.prototype.getSerializableHash = function() {
    return {
        msg: AddYouTubePlayerMessage.messageId,
        data: {
            room: this.roomGuid,
            player: this.youtubePlayer
        }
    };
};

module.exports = AddYouTubePlayerMessage;
