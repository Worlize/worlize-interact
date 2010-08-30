var HandshakeMessage = require('./handshake'),
    SayMessage = require('./say'),
    MoveMessage = require('./move'),
    RoomMsgMessage = require('./room_msg'),
    SetFaceMessage = require('./set_face'),
    SetSimpleAvatarMessage = require('./set_simple_avatar'),
    NakedMessage = require('./naked'),
    PongMessage = require('./pong'),
    DisconnectMessage = require('./disconnect');

module.exports = {
    "say": SayMessage,
    "handshake": HandshakeMessage,
    "move": MoveMessage,
    "disconnect": DisconnectMessage,
    "room_msg": RoomMsgMessage,
    "set_face": SetFaceMessage,
    "set_simple_avatar": SetSimpleAvatarMessage,
    "naked": NakedMessage,
    "pong": PongMessage
};