require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const Sequelize = require('sequelize');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const PORT = process.env.PORT || 8080;
const sequelize = new Sequelize(process.env.DATABASE_URL);
module.exports.sequelize = sequelize;
const routes = require('./routes');

const server = express();
require('./db_schema/db_relationships');

// ///////////////////////// START MIDDLEWARE ///////////////////////////////
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: false }));
server.use(morgan('dev'));
server.use(cookieParser());
server.use(session({
  secret: 'shhhhhhhhh',
  resave: true,
  saveUninitialized: true,
}));
server.use('/', routes);
// ///////////////////////// END MIDDLEWARE ////////////////////////////////

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
