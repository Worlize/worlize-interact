var HandshakeMessage = require('./handshake'),
    SayMessage = require('./say'),
    MoveMessage = require('./move'),
    RoomMsgMessage = require('./room_msg'),
    DisconnectMessage = require('./disconnect');

module.exports = {
    "say": SayMessage,
    "handshake": HandshakeMessage,
    "move": MoveMessage,
    "disconnect": DisconnectMessage,
    "room_msg": RoomMsgMessage
};