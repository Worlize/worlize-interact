var Sequelize = require('sequelize'),
    s = require('../../sequelize');

module.exports = s.define(
    'app_instance',
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guid: { type: Sequelize.STRING },
        app_id: { type: Sequelize.INTEGER },
        user_id: { type: Sequelize.INTEGER },
        room_id: { type: Sequelize.INTEGER },
        gifter_id: { type: Sequelize.INTEGER }
    },
    {
        timestamps: true,
        underscored: true
    }
);