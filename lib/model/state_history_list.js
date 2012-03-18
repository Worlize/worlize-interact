function StateHistoryList(id) {
    this.id = id;
    this.head = null;
    this.tail = null;
    this.bytesUsed = 0;
    this.length = 0;
}

StateHistoryList.prototype.push = function(userGuid, buffer) {
    if (!userGuid) {
        throw new Error("You must provide a userGuid for the history entry");
    }
    if (!Buffer.isBuffer(buffer)) {
        throw new Error("You must provide history state data as a buffer object");
    }
    var newItem = {
        buffer: buffer,
        user: userGuid,
        next: null
    };
    if (this.head === null) {
        this.tail = this.head = newItem
    }
    else {
        this.head.next = newItem;
        this.head = newItem;
    }
    this.bytesUsed += buffer.length;
    this.length ++;
};

StateHistoryList.prototype.shift = function() {
    if (this.tail) {
        var removedItem = this.tail;
        this.tail = removedItem.next;
        this.bytesUsed -= removedItem.buffer.length;
        this.length --;
        return removedItem;
    }
};

StateHistoryList.prototype.clear = function() {
    this.head = this.tail = null;
    this.length = 0;
    this.bytesUsed = 0;
};

StateHistoryList.prototype.forEach = function(fn) {
    var current = this.tail;
    var i = 0;
    while (current) {
        fn(current, i++);
        current = current.next;
    }
};

module.exports = StateHistoryList;