var Prop = require('./prop').
    Log = require('../util/log'),
    AddLoosePropMessage = require('../rpc/chatserver_messages/add_loose_prop'),
    MoveLoosePropMessage = require('../rpc/chatserver_messages/move_loose_prop'),
    RemoveLoosePropMessage = require('../rpc/chatserver_messages/remove_loose_prop'),
    BringLoosePropForwardMessage = require('../rpc/chatserver_messages/bring_loose_prop_forward'),
    SendLoosePropBackwardMessage = require('../rpc/chatserver_messages/send_loose_prop_backward');
    
var logger = Log.getLogger('model.LoosePropsList');

function LoosePropsList(room) {
    this.room = room;
    this.props = [];
    this.propsById = {};
    this.idCounter;
};

LoosePropsList.prototype.addLooseProp = function(x, y, guid, user) {
    var self = this;
    Prop.load(guid, function(err, prop) {
        if (err) {
            logger.error("action=add_loose_prop_error prop=" + guid, user.logNotation);
            return;
        }
        
        prop.retain();
        prop.id = ++self.idCounter;
        self.props.push(prop);
        self.propsById[prop.id] = prop;
        
        prop.x = x;
        prop.y = y;
        
        var msg = new AddLoosePropMessage();
        msg.user = user;
        msg.prop = prop;
        msg.x = prop.x;
        msg.y = prop.y;
        msg.id = prop.id;
        self.room.broadcast(msg);
    });
};

LoosePropsList.prototype.moveLooseProp = function(id, x, y, user) {
    var prop = this.propsById[id];
    if (prop) {
        
    }
};

LoosePropsList.prototype.removeLooseProp = function(id, user) {
    var prop = this.propsById[id];
    if (prop) {
        var index = this.props.indexOf(prop);
        if (index !== -1) {
            this.props.splice(index, 1);
        }
        delete this.propsById[id];
    }
};

LoosePropsStore.prototype.bringForward = function(id, amount, user) {
    var prop = this.propsById[id];
    if (prop) {
        
    }
};

LoosePropsStore.prototype.sendBackward = function(id, amount, user) {
    var prop = this.propsById[id];
    if (prop) {
        
    }
};
