/***
 * This file contains definition of secret key for JWT signing.
 * The default JWT secret is set here.
 * This can be overridden by setting JWT_SECRET environmental variable.
 */

if (
  process.env.NODE_ENV === "production" &&
  !process.env.hasOwnProperty("JWT_SECRET")
) {
  throw new Error(
    "In production mode you must specify jwt secret key in JWT_SECRET environment variable"
  );
}

module.exports = process.env.JWT_SECRET || "SECRETJWT";
