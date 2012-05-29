var RoomDefinition = require('../../../model/room_definition');
var _ = require('underscore');
var async = require('async');

module.exports = function(app) {
    app.get('/rooms/:guid/definition', function(req, res, next) {
        RoomDefinition.load(req.params.guid, function(err, result) {
            if (err) {
                res.json({
                    success: false,
                    error: err.toString()
                }, 404);
                return;
            }
            
            res.json({
                success: true,
                room: result
            }, 200);
        });
    });
    
    app.put('/rooms/:guid/definition', function(req, res, next) {
        if (!_.isObject(req.body)) {
            res.json({
                success: false,
                error: "You must specify a JSON post body."
            }, 404);
            return;
        }

        RoomDefinition.load(req.params.guid, function(err, result) {
            if (err) {
                res.json({
                    success: false,
                    error: err.toString()
                }, 404);
                return;
            }
            
            result.updateAttributes(req.body, function(err) {
                if (err) {
                    res.json({
                        success: false,
                        error: err.toString()
                    }, 500);
                    return;
                }
                
                res.json({
                    success: true,
                    room: result
                }, 200);
            });
        })
    });
    
    app.post('/rooms/:guid/definition', function(req, res, next) {
        if (!_.isObject(req.body)) {
            res.json({
                success: false,
                error: "You must specify a JSON post body."
            }, 404);
            return;
        }
        
        var rd = new RoomDefinition(req.params.guid);
        rd.updateAttributes(req.body, function(err) {
            if (err) {
                res.json({
                    success: false,
                    error: err.toString()
                }, 500);
                return;
            }
            
            res.json({
                success: true,
                room: rd
            }, 200);
        });
    });
    
    app.post('/rooms/:guid/clone', function(req, res, next) {
        if (!_.isObject(req.body)) {
            res.json({
                success: false,
                error: "You must specify a JSON post body."
            }, 404);
            return;
        }
        
        if (!req.body.destRoomGuid) {
            res.json({
                success: false,
                error: "You must specify a destination room guid."
            }, 404);
            return;
        }
        
        var sourceRoom,destRoom;
        async.auto(
            {
                loadSourceRoom: function(callback) {
                    RoomDefinition.load(req.params.guid, function(err, result) {
                        sourceRoom = result;
                        callback(err, result);
                    });
                },
                loadDestRoom: function(callback) {
                    RoomDefinition.load(req.body.destRoomGuid, function(err, result) {
                        destRoom = result;
                        callback(err, result);
                    });
                },
                clone: [
                    // Prerequisite async functions:
                    'loadSourceRoom', 'loadDestRoom',
                    function(callback) {
                        sourceRoom.cloneTo(
                            destRoom,
                            req.body.roomGuidMap,
                            req.body.itemGuidMap,
                            callback
                        );
                    }
                ]
            },
            function(err, results) {
                if (err) {
                    res.json({
                        success: false,
                        error: err.toString()
                    }, 404);
                    return;
                }
                
                res.json({
                    success: true
                }, 200);
            }
        );
    });
    
    app.delete('/rooms/:guid/definition', function(req, res, next) {
        RoomDefinition.destroy(req.params.guid, function(err) {
            if (err) {
                res.json({
                    success: false,
                    error: err.toString()
                }, 400);
                return;
            }
            res.json({
                success: true
            }, 200);
        });
    });
    
    app.delete('/rooms/:guid/definition/items/:itemGuid', function(req, res, next) {
        RoomDefinition.load(req.params.guid, function(err, rd) {
            if (err) {
                res.json({
                    success: false,
                    error: err.toString()
                }, 400);
                return;
            }
            var item = rd.getItemByGuid(req.params.itemGuid);
            if (item === null) {
                res.json({
                    success: false,
                    error: "The specified item is not in the room."
                }, 404);
                return;
            }
            
            switch (item.type) {
                case "object":
                    rd.removeObjectInstance(req.params.itemGuid, true, function(err, result) {
                        if (err) {
                            res.json({
                                success: false,
                                error: err.toString()
                            }, 400);
                            return;
                        }
                        res.json({
                            success: true,
                            item: item
                        }, 200);
                    });
                    break;
                case "app":
                    rd.removeAppInstance(req.params.itemGuid, true, function(err, result) {
                        if (err) {
                            res.json({
                                success: false,
                                error: err.toString()
                            }, 400);
                            return;
                        }
                        res.json({
                            success: true,
                            item: item
                        }, 200);
                    });
                    break;
                default:
                    rd.removeItem(req.params.itemGuid, true);
                    rd.save(function(err) {
                        if (err) {
                            res.json({
                                success: false,
                                error: err.toString()
                            }, 400);
                            return;
                        }
                        res.json({
                            success: true,
                            item: item
                        }, 200);
                    });
                    break;
            }
        });
    });
};