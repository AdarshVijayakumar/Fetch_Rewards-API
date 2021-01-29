/***
 * This is a database helper for rewards-web-service
 *
 * The file contains database connectivity helpers and crud operation helpers.
 */

var sqlite3 = require("sqlite3").verbose();
var md5 = require("md5");
var uuid4 = require("uuid/v4");

const DBSOURCE = "db.sqlite";

// connect to the database or create one if unavailable
const db = new sqlite3.Database(DBSOURCE, (err) => {
  if (err) {
    // Cannot open database
    console.error(err.message);
    throw err;
  } else {
    console.log("Connected to the SQLite database.");
    db.run(`PRAGMA foreign_keys = ON`);
    db.run(
      `CREATE TABLE User (
        userId text PRIMARY KEY NOT NULL,
        username text UNIQUE,
        firstname text,
        lastname text,
        passwordHash text NOT NULL,
        role text NOT NULL
        )`,
      (err) => {
        if (err) {
          // Table already created
        } else {
          // Table just created, creating some rows
          console.log("User Table Created");
          let insert =
            "INSERT INTO user (userId, username, firstname, lastname, passwordHash, role) VALUES (?,?,?,?,?,?)";
          db.run(insert, [
            uuid4(),
            "admin",
            "Administrator",
            "",
            md5("admin123456"),
            "ADMIN",
          ]);
          db.run(insert, [
            uuid4(),
            "markdoe",
            "Mark",
            "Doe",
            md5("test1234"),
            "USER",
          ]);
        }
      }
    );
    db.run(
      `CREATE TABLE RewardTransaction (
          id text PRIMARY KEY,
          userId text,
          payer text,
          points INTEGER,
          transactionDate text,
          FOREIGN KEY (userId) REFERENCES user(userId)
          )`,
      (err) => {
        if (err) {
          // Table already created
        } else {
          // Table just created, creating some rows
          console.log("Transaction table created successfully!!");
        }
      }
    );
  }
});

/***
 * Adds a record into RewardTransaction table
 */
const addPointsToUser = async (payer, points, transactionDate, userId) => {
  const insert =
    "INSERT INTO RewardTransaction (id, userId, payer, points, transactionDate) VALUES (?,?,?,?,?)";
  return new Promise(async (resolve, reject) => {
    db.run(
      insert,
      [uuid4(), userId, payer, points, transactionDate],
      (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      }
    );
  });
};

/***
 * Retrieves all transactions by payer and userId
 */
const getTransactionsByPayer = async (payer, userId, order = "ASC") => {
  return new Promise(async (resolve, reject) => {
    const query = `SELECT * FROM RewardTransaction 
                                WHERE payer = '${payer}'
                                AND userId = '${userId}'
                                ORDER BY transactionDate ${order}`;
    db.all(query, [], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/***
 * Retrieves all transactions by userId
 */
const getTransactionsByUserId = async (userId, order = "ASC") => {
  return new Promise(async (resolve, reject) => {
    const query = `SELECT * FROM RewardTransaction 
                                  WHERE userId = '${userId}'
                                  ORDER BY transactionDate ${order}`;
    db.all(query, [], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/***
 * Updates a record in RewardTransaction table
 */
const updateTransaction = async (id, points) => {
  const query = `UPDATE RewardTransaction
            SET points = ${points}
            WHERE id = '${id}'`;
  return new Promise(async (resolve, reject) => {
    db.run(query, [], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/***
 * Deletes a record in RewardTransaction table
 */
const deleteTransaction = async (id) => {
  const query = `DELETE FROM RewardTransaction
                        WHERE id = '${id}'`;
  return new Promise(async (resolve, reject) => {
    db.run(query, [], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/***
 * Retrieves the user matching given username and password pair
 */
const userLookup = async (username, password) => {
  const query = `SELECT * FROM User
                          WHERE username = '${username}'
                          AND passwordHash = '${md5(password)}'`;
  return new Promise(async (resolve, reject) => {
    db.all(query, [], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/***
 * Adds a record into user table
 */
const createUser = async (
  userId,
  username,
  passwordHash,
  role = "USER",
  firstname = null,
  lastname = null
) => {
  const insert =
    "INSERT INTO User (userId, username, firstname, lastname, passwordHash, role) VALUES (?,?,?,?,?,?)";
  return await new Promise(async (resolve, reject) => {
    db.run(
      insert,
      [userId, username, firstname, lastname, passwordHash, role],
      (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      }
    );
  });
};

/***
 * Retrieves all records in User table
 */
const getUsers = async () => {
  const query = `SELECT userId, username, role 
                        FROM User`;
  return new Promise(async (resolve, reject) => {
    db.all(query, [], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

module.exports = {
  db,
  addPointsToUser,
  getTransactionsByPayer,
  updateTransaction,
  deleteTransaction,
  getTransactionsByUserId,
  userLookup,
  createUser,
  getUsers,
};
