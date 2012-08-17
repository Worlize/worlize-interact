// These have to be in the exact correct order in order to map to the correct
// permission id.
var permissions = [
    "can_access_moderation_dialog",
    "can_bless_moderators",
    "can_grant_permissions",
    "can_ban",
    "can_pin",
    "can_gag",
    "can_block_avatars",
    "can_block_webcams",
    "can_block_props",
    "can_reduce_restriction_time",
    "can_lengthen_restriction_time",
    "can_edit_rooms",
    "can_create_rooms",
    "can_delete_rooms",
    "can_moderate_globally"
];

var permissionMap = {};
var permissionIds = [];

for (var i=0; i < permissions.length; i++) {
    var permission = permissions[i];
    permissionMap[i+1] = permission;
    permissionIds.push(i+1);
}

// Populate values for reverse lookup as well
Object.keys(permissionMap).forEach(function(key) {
    var value = permissionMap[key];
    permissionMap[value] = permissionMap[key];
});

module.exports = {
    names: permissions,
    map: permissionMap,
    ids: permissionIds
};
