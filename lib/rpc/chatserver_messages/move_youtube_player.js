var util = require('util'),
    Log = require('../../util/log'),
    config = require('../../config'),
    MessageEncoder = require('../message_encoder'),
    Message = require('../message');
    
var logger = Log.getLogger('rpc.chatserver_messages.MoveYouTubePlayerMessage');

var MoveYouTubePlayerMessage = function(chatserver) {
    Message.call(this, chatserver);
    this.user = null;
    this.youtubePlayer = null;
    this.roomGuid = null;
    this._encodedMessage = null;
};
util.inherits(MoveYouTubePlayerMessage, Message);

MoveYouTubePlayerMessage.messageId = "move_youtube_player";
MoveYouTubePlayerMessage.acceptFromClient = true;

MoveYouTubePlayerMessage.prototype.receive = function(message, user) {
    var self = this;
    this._encodedMessage = null;
    this.user = user;
    
    user.currentRoom.checkCanAuthor(this.user, function(err, result) {
        if (!result) {
            logger.error("Unauthorized attempt to move YouTube Player.", user.logNotation);
            return;
        }
        if (message.data) {
            if (typeof(message.data.guid) !== 'string') {
                logger.error("YouTube Player guid must be specified as a string.", user.logNotation);
                return;
            }
            
            var x = parseInt(message.data.x, 10);
            var y = parseInt(message.data.y, 10);
            var width = parseInt(message.data.width, 10);
            var height = parseInt(message.data.height, 10);
            if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
                // Non-numeric inputs
                logger.warn("User attempted to set non-numeric position or size.", user.logNotation);
                return;
            }
            
            self.youtubePlayer = user.currentRoom.definition.getItemByGuid(message.data.guid);
            self.roomGuid = user.currentRoom.guid;
            
            if (self.youtubePlayer) {
                try {
                    self.youtubePlayer.move(x, y);
                    self.youtubePlayer.setSize(width, height);
                }
                catch(e) {
                    logger.error("Unable to move/resize YouTube Player: " + e.toString());
                    return;
                }
                
                user.currentRoom.definition.save(function(err) {
                    if (err) {
                        logger.error("There was an error while moving a YouTube Player: " + err.toString(), user.logNotation);
                        return;
                    }
                    user.currentRoom.broadcast(self);
                });
            }
            else {
                logger.error("Tried to move nonexistent YouTube Player " + message.data.guid, user.logNotation);
            }
        }
    });
};

MoveYouTubePlayerMessage.prototype.send = function(user) {
    if (!this._encodedMessage) {
        this._encodedMessage = MessageEncoder.encode(this.getSerializableHash());
    }
    user.connection.send(this._encodedMessage);
};

MoveYouTubePlayerMessage.prototype.getSerializableHash = function() {
    return {
        msg: MoveYouTubePlayerMessage.messageId,
        data: {
            room: this.roomGuid,
            player: {
                guid: this.youtubePlayer.guid,
                x: this.youtubePlayer.x,
                y: this.youtubePlayer.y,
                width: this.youtubePlayer.width,
                height: this.youtubePlayer.height
            }
        }
    };
};

module.exports = MoveYouTubePlayerMessage;