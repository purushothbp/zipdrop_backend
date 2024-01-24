const mysql = require('mysql2');
const config = require('./config.json');

// MySQL connection configuration
const connection = mysql.createConnection({
  host: config.DB_HOST, // Usually 'localhost'
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }

  console.log('Connected to MySQL');

  // SQL query to create a table (change according to your requirements)
  const createTableQuery = `
  CREATE TABLE IF NOT EXISTS userlogin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Mobile_Number VARCHAR(12),
    Date DATE,
    Auth_token VARCHAR(255),
    Otp INT);`

  

  // Execute the query
  connection.query(createTableQuery, (error, results, fields) => {
    if (error) {
      console.error('Error creating table:', error);
      return;
    }

    console.log('Table created successfully:', results);

    // Close the MySQL connection
    connection.end((endError) => {
      if (endError) {
        console.error('Error closing connection:', endError);
        return;
      }

      console.log('Connection closed');
    });
  });
});
