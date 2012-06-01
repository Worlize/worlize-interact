var Sequelize = require('sequelize');
var mysqlConfig = require('./config').mysqlConfig;
var Log = require('./util/log');

var logger = Log.getLogger('sequelize');

module.exports = new Sequelize(
    mysqlConfig.database,
    mysqlConfig.user,
    mysqlConfig.password,
    {
        host: mysqlConfig.host,
        logging: logger.debug2.bind(logger),
        dialect: 'mysql',
        pool: { maxConnections: 5, maxIdleTime: 30 },
        define: {
            charset: 'utf8'
        }
    }
);