var Log = require('../../util/log');
var logger = Log.getLogger('model.migrations.room_definition.v3');

// 'this' will be the RoomDefinition model object
module.exports = function(rawData, callback) {
    var items = rawData.items;
    items.forEach(function(item) {
        if (item.type === 'app') {
            item.app_guid = item.object_guid;
            delete item['object_guid'];
            
            item.dest = null;
        }
    });
    callback(null);
};
