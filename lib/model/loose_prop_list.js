var Prop = require('./prop'),
    Log = require('../util/log'),
    AddLoosePropMessage = require('../rpc/chatserver_messages/add_loose_prop'),
    ClearLoosePropsMessage = require('../rpc/chatserver_messages/clear_loose_props'),
    MoveLoosePropMessage = require('../rpc/chatserver_messages/move_loose_prop'),
    RemoveLoosePropMessage = require('../rpc/chatserver_messages/remove_loose_prop'),
    BringLoosePropForwardMessage = require('../rpc/chatserver_messages/bring_loose_prop_forward'),
    SendLoosePropBackwardMessage = require('../rpc/chatserver_messages/send_loose_prop_backward');
    
var logger = Log.getLogger('model.LoosePropList');

function LoosePropList(room) {
    this.room = room;
    this.reset();
};

LoosePropList.prototype.reset = function() {
    if (this.propOrder) {
        var self = this;
        this.propOrder.forEach(function(id) {
            var looseProp = self.looseProps[id];
            looseProp.prop.release();
        });
    }
    
    this.propOrder = [];
    this.looseProps = {};
    this.idCounter = 0;
};

LoosePropList.prototype.addLooseProp = function(x, y, guid, user) {
    var self = this;
    Prop.load(guid, function(err, prop) {
        if (err) {
            logger.error("action=add_loose_prop_error prop=" + guid, user.logNotation);
            return;
        }
        
        prop.retain();
        
        var looseProp = {
            id: ++self.idCounter,
            x: x,
            y: y,
            // The person who added the prop
            addedByUserGuid: user.guid,
            addedByUserName: user.userName,
            prop: prop
        };
        
        self.propOrder.push(looseProp.id);
        self.looseProps[looseProp.id] = looseProp;
        
        var msg = new AddLoosePropMessage();
        msg.user = user;
        msg.prop = prop;
        msg.id = looseProp.id;
        msg.x = looseProp.x;
        msg.y = looseProp.y;
        self.room.broadcast(msg);
    });
};

LoosePropList.prototype.moveLooseProp = function(id, x, y, user) {
    var looseProp = this.looseProps[id];
    if (looseProp) {
        looseProp.x = x;
        looseProp.y = y;
        
        var msg = new MoveLoosePropMessage();
        msg.user = user;
        msg.id = id;
        msg.x = x;
        msg.y = y;
        this.room.broadcast(msg);
    }
};

LoosePropList.prototype.removeLooseProp = function(id, user) {
    var looseProp = this.looseProps[id];
    if (looseProp) {
        looseProp.prop.release();
        var index = this.propOrder.indexOf(id);
        if (index !== -1) {
            this.propOrder.splice(index, 1);
        }
        delete this.looseProps[id];
        
        var msg = new RemoveLoosePropMessage();
        msg.user = user;
        msg.id = id;
        this.room.broadcast(msg);
        
        if (this.propOrder.length < 1) {
            this.reset();
        }
    }
};

LoosePropList.prototype.clearLooseProps = function(user) {
    this.reset();
    var msg = new ClearLoosePropsMessage();
    msg.user = user;
    this.room.broadcast(msg);
};

LoosePropList.prototype.bringForward = function(id, layerCount, user) {
    var index = this.propOrder.indexOf(id);
    if (index !== -1) {
        var newidx = Math.min(this.propOrder.length - 1, index + layerCount);
        if (newidx <= index) { return; }
        this.propOrder.splice(index, 1);
        this.propOrder.splice(newidx, 0, id);
        logger.debug2("Bringing loose prop " + id + " forward by " + layerCount + " layers.  Old Index: " + index + " new New Index: " + newidx);
        logger.debug2("New order: " + JSON.stringify(this.propOrder));
        
        var msg = new BringLoosePropForwardMessage();
        msg.id = id;
        msg.layerCount = newidx - index;
        msg.user = user;
        this.room.broadcast(msg);
    }
    else {
        logger.warn("Loose prop " + id + " does not exist in this room.", user.logNotation);
    }
};

LoosePropList.prototype.sendBackward = function(id, layerCount, user) {
    var index = this.propOrder.indexOf(id);
    if (index !== -1) {
        var newidx = Math.max(0, index - layerCount);
        if (newidx >= index) { return; }
        this.propOrder.splice(index, 1);
        this.propOrder.splice(newidx, 0, id);
        logger.debug2("Sending loose prop " + id + " backward by " + layerCount + " layers.  Old Index: " + index + " new New Index: " + newidx);
        logger.debug2("New order: " + JSON.stringify(this.propOrder));
        
        var msg = new SendLoosePropBackwardMessage();
        msg.id = id;
        msg.layerCount = index - newidx;
        msg.user = user;
        this.room.broadcast(msg);
    }
    else {
        logger.warn("Loose prop " + id + " does not exist in this room.", user.logNotation);
    }
};

LoosePropList.prototype.getSerializableHash = function() {
    var self = this;
    return this.propOrder.map(function(propId) {
        var looseProp = self.looseProps[propId];
        return {
            prop: looseProp.prop.getSerializableHash(),
            user: {
                guid: looseProp.addedByUserGuid,
                name: looseProp.addedByUserName
            },
            x: looseProp.x,
            y: looseProp.y,
            id: propId
        };
    });
};


module.exports = LoosePropList;