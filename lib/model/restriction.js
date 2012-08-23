function Restriction() {
    this.expires = null;
    this.expiresValue = 0;
    this.name = null;
    this.createdBy = null;
    this.updatedBy = null;
}

Restriction.fromJSON = function(json) {
    var r = new Restriction();
    r.expires = new Date(json.expires);
    r.expiresValue = r.expires.valueOf();
    r.name = json.name;
    // r.createdBy = json.created_by;
    // r.updatedBy = json.updated_by;
    return r;
};

Restriction.prototype.active = function() {
    return this.expiresValue > Date.now();
};

Restriction.prototype.remainingSeconds = function() {
    if (!this.active()) {
        return 0;
    }
    return Math.max(0, Math.round(this.expiresValue - Date.now()) / 1000);
};

Restriction.prototype.toJSON = function() {
    return {
        expires: this.expires,
        name: this.name
        // created_by: this.createdBy,
        // updated_by: this.updatedBy
    };
};

module.exports = Restriction;
