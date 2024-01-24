const mysql = require('mysql2');
const config = require('./config.json');

const pool = mysql.createpool
({
    host: config.DB_HOST,
    user: config.DB_USER,
    database:config.DB_NAME,
    password:config.DB_PASSWORD,

})

let sql = "SELECT * FROM posts";

pool.execute(sql,function (err, result){
    if (err) throw err ;

    console.log(result);
})

module.exports = pool.promise();
