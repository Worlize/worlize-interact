var permissionMap = {
    "1": "can_moderate",
    "2": "can_bless_moderators",
    "3": "can_grant_privileges",
    "4": "can_kill",
    "5": "can_pin",
    "6": "can_gag",
    "7": "can_avatar_gag",
    "8": "can_prop_gag",
    "9": "can_reduce_restriction_time",
    "10": "can_lengthen_restriction_time",
    "11": "can_edit_rooms",
    "12": "can_create_rooms",
    "13": "can_delete_rooms"
};

// Populate values for reverse lookup as well
Object.keys(permissionMap).forEach(function(key) {
    var value = permissionMap[key];
    permissionMap[value] = permissionMap[key];
});

module.exports = permissionMap;