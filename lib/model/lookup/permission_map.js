var permissionMap = {
    "1": "can_access_moderation_dialog",
    "2": "can_bless_moderators",
    "3": "can_grant_permissions",
    "4": "can_ban",
    "5": "can_pin",
    "6": "can_gag",
    "7": "can_block_avatars",
    "8": "can_block_webcams",
    "9": "can_block_props",
    "10": "can_reduce_restriction_time",
    "11": "can_lengthen_restriction_time",
    "12": "can_edit_rooms",
    "13": "can_create_rooms",
    "14": "can_delete_rooms"
};

// Populate values for reverse lookup as well
Object.keys(permissionMap).forEach(function(key) {
    var value = permissionMap[key];
    permissionMap[value] = permissionMap[key];
});

module.exports = permissionMap;
