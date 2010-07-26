var HandshakeMessage = require('./handshake'),
    SayMessage = require('./say'),
    MoveMessage = require('./move'),
    RoomMsgMessage = require('./room_msg'),
    SetFaceMessage = require('./set_face'),
    DisconnectMessage = require('./disconnect');

module.exports = {
    "say": SayMessage,
    "handshake": HandshakeMessage,
    "move": MoveMessage,
    "disconnect": DisconnectMessage,
    "room_msg": RoomMsgMessage,
    "set_face": SetFaceMessage
};