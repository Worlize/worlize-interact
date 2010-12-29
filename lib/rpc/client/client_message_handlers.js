var HandshakeMessage = require('./handshake'),
    SayMessage = require('./say'),
    WhisperMessage = require('./whisper'),
    MoveMessage = require('./move'),
    RoomMsgMessage = require('./room_msg'),
    SetFaceMessage = require('./set_face'),
    SetColorMessage = require('./set_color'),
    SetSimpleAvatarMessage = require('./set_simple_avatar'),
    NakedMessage = require('./naked'),
    DisconnectMessage = require('./disconnect');

module.exports = {
    "say": SayMessage,
    "whisper": WhisperMessage,
    "handshake": HandshakeMessage,
    "move": MoveMessage,
    "disconnect": DisconnectMessage,
    "room_msg": RoomMsgMessage,
    "set_face": SetFaceMessage,
    "set_color": SetColorMessage,
    "set_simple_avatar": SetSimpleAvatarMessage,
    "naked": NakedMessage
};