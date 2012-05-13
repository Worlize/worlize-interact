var RoomMsgMessage = require('../rpc/chatserver_messages/room_msg');
var Log = require('../util/log');
var logger = Log.getLogger('command_handlers.KickCommand');

function KickCommand(room, from, target, paramString) {
    var params;
    if (typeof(paramString) === 'string') {
        // var arr = params.match(/^(.*?)(?: (\d*))?$/); // we don't need duration..
        params = paramString.match(/^(.*)$/);
    }
    else {
        params = [];
    }
    
    var roomMsg = new RoomMsgMessage();
    
    room.checkIsModerator(from, function(err, isModerator) {
        if (err || !isModerator) {
            roomMsg.text = "You do not have access to use that command.";
            roomMsg.user = from;
            from.sendMessage(roomMsg);
            return;
        }
        
        // If we didn't whisper the command, look up the target by userName
        if (!target && params[1]) {
            var userName = params[1];
            target = room.getUserByUserName(userName);
            if (!target) {
                roomMsg.text = "Unknown room user: " + userName;
                roomMsg.user = from;
                from.sendMessage(roomMsg);
                return;
            }
        }
        else if (!target) {
            roomMsg.text = "You must specify a user to kick.";
            roomMsg.user = from;
            from.sendMessage(roomMsg);
            return;
        }
        
        if (target.guid === room.definition.ownerGuid) {
            roomMsg.text = "You cannot kick someone from their own room.";
            roomMsg.user = from;
            from.sendMessage(roomMsg);
            return;
        }

        if (target.guid === from.guid) {
            roomMsg.text = "You may not kick yourself from a room!";
            roomMsg.user = from;
            from.sendMessage(roomMsg);
            return;
        }

        room.kickUser(target, from);
        roomMsg.text = "User " + target.userName + " kicked from room.  The kick will remain in effect until the room becomes empty.";
        roomMsg.user = from;
        from.sendMessage(roomMsg);

        logger.info("action=user_kick user=" + target.guid + " user_username=\"" + target.userName + "\"", from.logNotation);        
    })
}

KickCommand.commandName = "kick";

module.exports = KickCommand;
