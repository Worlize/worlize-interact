var mysql = require('mysql');
var config = require('./config');

var poolOptions = {
  connectionLimit: 20
};
Object.keys(config.mysqlConfig).forEach(function(key) {
  poolOptions[key] = config.mysqlConfig[key];
});

module.exports = mysql.createPool(config.mysqlConfig);
