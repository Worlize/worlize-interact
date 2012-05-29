var Sequelize = require('sequelize'),
    s = require('../../sequelize');

module.exports = s.define(
    'app',
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guid: { type: Sequelize.STRING },
        creator_id: { type: Sequelize.INTEGER },
        tagline: { type: Sequelize.STRING },
        description: { type: Sequelize.STRING },
        help: { type: Sequelize.STRING },
        name: { type: Sequelize.STRING },
        width: { type: Sequelize.INTEGER },
        height: { type: Sequelize.INTEGER },
        icon: { type: Sequelize.STRING },
        app: { type: Sequelize.STRING },
        active: { type: Sequelize.BOOLEAN, defaultValue: true },
        image: { type: Sequelize.STRING }
    },
    {
        timestamps: true,
        underscored: true
    }
);