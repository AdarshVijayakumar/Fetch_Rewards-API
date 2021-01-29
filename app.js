/***
 * rewards-web-service v1.0
 *
 * This is a web API service built using node.js and express.js.
 * The service exposes basic end points to update reward points of a user and retrieve the same.
 * Dependencies:
 * Node version > 12.x
 * EXPRESS
 * sqlite3 - a file based SQL DB client in node js
 * cors - cross origin request helper
 * md5 - a hashing library for creating password hashes
 * uuid4 - to generate unique ids
 * JWT - web token to securely exchange user information
 */
"use strict";

// Import dependencies
const express = require("express");
const http = require("http");
const path = require("path");
var cors = require("cors");
var app = express();
var JWT = require("jsonwebtoken");
var jwtSecret = require("./jwt-secret");
var md5 = require("md5");
var uuid4 = require("uuid/v4");
const pathToSwaggerUi = "./swagger";
const swaggerDoc = require("./swagger.json");

const JWT_EXPIRY = 43200;
// import database helpers
const {
  db,
  addPointsToUser,
  getTransactionsByPayer,
  updateTransaction,
  getTransactionsByUserId,
  userLookup,
  createUser,
  getUsers,
} = require("./database");

// Handle CORS requests by setting response headers and forward the requests to corresponding REST paths
cors();
app.use(function (req, res, next) {
  if (req.method === "OPTIONS") {
    console.log("OPTIONS!! Setting headers now ...");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Request-Method", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, response-type"
    );
  } else if (
    req.method === "GET" ||
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "DELETE"
  ) {
    setResponse(req, res);
  }
  next();
});

/***
 * Helper for deducting points from the user
 * @param transactions: a list of reward transactions
 * @param points: amount of rewards that needs to be deducted
 */
const deductPointsInTransactions = async (transactions, points) => {
  let updatedTransaction = null;
  let modifiedTransactions = [];
  let deletedTransactions = [];
  let i = 0;
  while (i < transactions.length) {
    let transaction = { ...transactions[i] };
    let modifiedTransaction = null;
    if (transaction.points > Math.abs(points)) {
      // if the points in the transaction is greater than the points to deduct
      // then, deduct the specified amount of points from the transaction points and update the transaction
      transaction.points -= Math.abs(points);
      updatedTransaction = transaction;
      modifiedTransaction = { ...transactions[i] };
      modifiedTransaction.points = -1 * Math.abs(points);
      modifiedTransactions.push(modifiedTransaction);
      break;
    } else {
      // deduct all points from the transaction and update the transaction with 0 points
      points = -1 * (Math.abs(points) - transaction.points);
      deletedTransactions.push(transaction);
      modifiedTransaction = transaction;
      modifiedTransaction.points = -1 * modifiedTransaction.points;
      modifiedTransactions.push(modifiedTransaction);
    }
    if (points == 0) {
      // exit if the specified points have been deducted
      break;
    }
    i++;
  }
  if (i == transactions.length && Math.abs(points) > 0) {
    throw new Error("Not enough points to subtract!!");
  } else {
    if (!!updatedTransaction) {
      await updateTransaction(updatedTransaction.id, updatedTransaction.points);
    }
    deletedTransactions = await deletedTransactions.map(async (transaction) => {
      await updateTransaction(transaction.id, 0);
      return transaction;
    });
    deletedTransactions = await Promise.all(deletedTransactions);
  }
  modifiedTransactions = modifiedTransactions.map((transaction) => {
    return {
      payer: transaction.payer,
      pointsDeducted: transaction.points,
      deductionTime: Math.floor(Date.now() / 1000).toString(),
    };
  });
  return modifiedTransactions;
};

/***
 * REST handler for retrieving the points balance for the user
 */
const getPointsBalance = async (req, res) => {
  try {
    const { userId } = req.body;
    let transactions = await getTransactionsByUserId(userId);
    if (!!transactions && transactions.length > 0) {
      let uniqueTransactions = [];
      let payerSet = new Set();
      transactions.map((t) => {
        payerSet.add(t.payer);
      });
      for (let item of payerSet) {
        let payerTransactions = transactions.filter((t) => t.payer === item);
        let pointsTotal = 0;
        payerTransactions.map((t) => {
          pointsTotal += t.points;
        });
        uniqueTransactions.push({
          payer: payerTransactions[0].payer,
          points: pointsTotal,
        });
      }
      res.status(200);
      res.json(uniqueTransactions);
    } else {
      throw new Error("No transactions found for this user");
    }
  } catch (err) {
    res.status(500);
    res.json(err.message);
  }
};

/***
 * REST handler for adding points to the user for a specific payer
 */
const addPoints = async (req, res) => {
  try {
    const { payer, transactionDate, userId } = req.body;
    let points = parseInt(req.body.points);
    if (points < 0) {
      let transactions = await getTransactionsByPayer(payer, userId);
      if (!!transactions && transactions.length > 0) {
        await deductPointsInTransactions(transactions, points, res);
        res.status(200);
        res.json("updated transactions successfully!!");
      } else {
        throw new Error("No transactions found for this payer");
      }
    } else {
      await addPointsToUser(payer, points, transactionDate, userId);
      res.status(200);
      res.json("Points added to user successfully!!");
    }
  } catch (err) {
    res.status(500);
    res.json(err.message);
  }
};

/***
 * REST handler for deducting points from the user
 */
const deductPoints = async (req, res) => {
  try {
    const { userId } = req.body;
    let points = parseInt(req.body.points);
    let transactions = await getTransactionsByUserId(userId);
    if (!!transactions && transactions.length > 0) {
      const modifiedTransactions = await deductPointsInTransactions(
        transactions,
        -1 * Math.abs(points),
        res
      );
      res.status(200);
      res.json(modifiedTransactions);
    } else {
      res.status(404);
      res.json("No transactions found for this user");
    }
    res.end("in progress");
  } catch (err) {
    res.status(500);
    res.json(err.message);
  }
};

/***
 * REST handler for performing user login
 */
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    let user = await userLookup(username, password);
    if (!!user && user.length > 0) {
      user = user[0];
      const authJwt = JWT.sign(
        { id: user.userId, role: user.role },
        jwtSecret,
        {
          expiresIn: JWT_EXPIRY,
        }
      );
      res.status(200);
      res.json({ authJwt: authJwt, message: "User login successful" });
    } else {
      res.status(401);
      res.json("Invalid username or password");
    }
  } catch (err) {
    res.status(500);
    res.json(err.message);
  }
};

/***
 * REST handler for creating a new user
 */
const registerUser = async (req, res) => {
  try {
    const { username, password, firstname, lastname } = req.body;
    if (!!username && !!password) {
      const passwordHash = md5(password);
      const userId = uuid4();
      const role =
        !!req.body.role && ["ADMIN", "USER"].includes(req.body.role)
          ? req.body.role
          : "USER";
      await createUser(
        userId,
        username,
        passwordHash,
        role,
        firstname,
        lastname
      );
      res.status(201);
      res.json("User created successfully");
    } else {
      res.status(400);
      res.json("Username and password are required");
    }
  } catch (err) {
    res.status(500);
    res.json(err.message);
  }
};

/***
 * REST handler for retrieving the list of available users
 */
const getAllUsers = async (req, res) => {
  try {
    const { authJwt } = req.body;
    if (!!authJwt) {
      const { role } = JWT.verify(authJwt, jwtSecret);
      if (!!role && role === "ADMIN") {
        const users = await getUsers();
        res.status(200);
        res.json(users);
      } else {
        res.status(403);
        res.json("Access denied!!");
      }
    } else {
      res.status(401);
      res.json("JWT token is required");
    }
  } catch (err) {
    res.status(500);
    res.json(err.message);
  }
};

// all environments
app.set("port", process.env.PORT || 3050);
app.use(express.favicon());
app.use(express.logger("dev"));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
// development only
if ("development" == app.get("env")) {
  app.use(express.errorHandler());
}
app.use(express.static(pathToSwaggerUi));

/***
 * Adds response headers to handle cross origin requests
 */
function setResponse(req, res) {
  console.log("setting headers");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Request-Method", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
}

// route for swagger doc
app.get("/api-doc", (req, res) => {
  res.json(swaggerDoc);
});

// Routing with REST paths
app.post("/add_points", (req, res) => addPoints(req, res));
app.post("/deduct_points", (req, res) => deductPoints(req, res));
app.post("/points_balance", (req, res) => getPointsBalance(req, res));
app.post("/register", (req, res) => registerUser(req, res));
app.post("/login", (req, res) => loginUser(req, res));
app.post("/all_users", (req, res) => getAllUsers(req, res));

/***
 * Creates a server for the web service on port specified by app.set("port")
 */
http.createServer(app).listen(app.get("port"), function () {
  console.log("Express server listening on port " + app.get("port"));
});
