var Sequelize = require('sequelize'),
    s = require('../../sequelize');

module.exports = s.define(
    'background_instance',
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guid: { type: Sequelize.STRING },
        background_id: { type: Sequelize.INTEGER },
        user_id: { type: Sequelize.INTEGER },
        room_id: { type: Sequelize.INTEGER },
        gifter_id: { type: Sequelize.INTEGER }
    },
    {
        timestamps: true,
        underscored: true
    }
);