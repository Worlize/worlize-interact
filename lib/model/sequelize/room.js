var Sequelize = require('sequelize'),
    s = require('../../sequelize');

module.exports = s.define(
    'room',
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guid: { type: Sequelize.STRING },
        name: { type: Sequelize.STRING },
        world_id: { type: Sequelize.INTEGER },
        position: { type: Sequelize.INTEGER },
        drop_zone: { type: Sequelize.BOOLEAN, defaultValue: false },
        hidden: { type: Sequelize.BOOLEAN, defaultValue: false }
    },
    {
        timestamps: true,
        underscored: true
    }
);