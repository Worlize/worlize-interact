var Sequelize = require('sequelize'),
    s = require('../../sequelize');

module.exports = s.define(
    'background',
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guid: { type: Sequelize.STRING },
        creator_id: { type: Sequelize.INTEGER },
        width: { type: Sequelize.INTEGER },
        height: { type: Sequelize.INTEGER },
        active: { type: Sequelize.BOOLEAN, defaultValue: true },
        image: { type: Sequelize.STRING },
        do_not_delete: { type: Sequelize.BOOLEAN, defaultValue: true },
        kind: { type: Sequelize.STRING },
        app: { type: Sequelize.STRING },
        icon: { type: Sequelize.STRING },
        requires_approval: { type: Sequelize.BOOLEAN },
        reviewal_status: { type: Sequelize.STRING },
        reviewer_id: { type: Sequelize.INTEGER },
        user_id: { type: Sequelize.INTEGER },
        room_id: { type: Sequelize.INTEGER },
        gifter_id: { type: Sequelize.INTEGER }
    },
    {
        timestamps: true,
        underscored: true
    }
);