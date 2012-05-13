var Sequelize = require('sequelize'),
    s = require('../../sequelize');

module.exports = s.define(
    'user',
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        guid: { type: Sequelize.STRING },
        name: { type: Sequelize.STRING },
        email: { type: Sequelize.STRING, allowNull: false },
        crypted_password: { type: Sequelize.STRING },
        password_salt: { type: Sequelize.STRING },
        persistence_token: { type: Sequelize.STRING, allowNull: false },
        single_access_token: { type: Sequelize.STRING, allowNull: false },
        perishable_token: { type: Sequelize.STRING, allowNull: false },
        last_login_at: { type: Sequelize.DATE },
        last_login_ip: { type: Sequelize.STRING },
        failed_login_count: { type: Sequelize.INTEGER },
        login_count: { type: Sequelize.INTEGER },
        admin: { type: Sequelize.BOOLEAN, defaultValue: false },
        twitter: { type: Sequelize.STRING },
        first_name: { type: Sequelize.STRING },
        last_name: { type: Sequelize.STRING },
        birthday: { type: Sequelize.DATE },
        state: { type: Sequelize.STRING },
        background_slots: { type: Sequelize.INTEGER },
        avatar_slots: { type: Sequelize.INTEGER },
        prop_slots: { type: Sequelize.INTEGER },
        in_world_object_slots: { type: Sequelize.INTEGER },
        inviter_id: { type: Sequelize.INTEGER },
        beta_code_id: { type: Sequelize.INTEGER },
        accepted_tos: { type: Sequelize.BOOLEAN, defaultValue: false },
        suspended: { type: Sequelize.BOOLEAN, defaultValue: false },
        developer: { type: Sequelize.BOOLEAN, defaultValue: false },
        newsletter_optin: { type: Sequelize.BOOLEAN, defaultValue: true },
        password_changed_at: { type: Sequelize.DATE },
        app_slots: { type: Sequelize.INTEGER }
    },
    {
        timestamps: true,
        underscored: true
    }
);