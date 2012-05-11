var Sequelize = require('sequelize'),
    s = require('../../sequelize');

module.exports = s.define(
    'in_world_object',
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guid: { type: Sequelize.STRING },
        creator_id: { type: Sequelize.INTEGER },
        name: { type: Sequelize.STRING },
        width: { type: Sequelize.INTEGER },
        height: { type: Sequelize.INTEGER },
        offset_x: { type: Sequelize.INTEGER },
        offset_y: { type: Sequelize.INTEGER },
        active: { type: Sequelize.BOOLEAN, defaultValue: true },
        image: { type: Sequelize.STRING }
    },
    {
        timestamps: true,
        underscored: true
    }
);