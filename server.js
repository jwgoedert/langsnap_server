require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const axios = require('axios');
const Sequelize = require('sequelize');
const bluebird = require('bluebird');

const PORT = process.env.PORT || 8080;
const sequelize = new Sequelize(process.env.DATABASE_URL);
module.exports.sequelize = sequelize;
const server = express();
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));




// ///////////////////////// START MIDDLEWARE ///////////////////////////////
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: false }));
server.use(morgan('dev'));
// server.use(require('./routes/routes'));

// ///////////////////////// END MIDDLEWARE ////////////////////////////////





// ///////////////////////// START DATABASE RELATIONSHIPS ///////////////////
const User = require('./user/user_schema');
const Deck = require('./deck/deck_schema');
const Card = require('./card/card_schema');
const DeckCard = require('./deck_card/deck_card_schema');
const UserCard = require('./user_card/user_card_schema');

// Relationships
User.hasMany(Deck, { onDelete: 'CASCADE' });
Card.belongsToMany(Deck, { onDelete: 'CASCADE', through: DeckCard });
Card.belongsToMany(User, { onDelete: 'CASCADE', through: UserCard });
Deck.belongsTo(User, { onDelete: 'CASCADE' });
Deck.belongsToMany(Card, { onDelete: 'CASCADE', through: DeckCard });
User.belongsToMany(Card, { onDelete: 'CASCADE', through: UserCard });

// Perform sync of models with existing database models
const syncDb = async () => {
  await User.sync();
  await Deck.sync();
  await Card.sync();
  await UserCard.sync();
  await DeckCard.sync();
};
syncDb();

const dbHelpers = require('./db_helpers/db_helpers');
// /////////////////////// END DATABASE RELATIONSHIPS ///////////////////////





// ///////////////////////// START ENDPOINTS ///////////////////////////////
server.options('/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  return res.send(200);
});

server.get('/', (req, res) => res.status(200).send('hello'));

server.post('/v2/*', (req, res) => {
  console.log(req.body);
  return res.sendStatus(200);
});

server.get('/v1/users/auth/*/*', async (req, res) => {
  const username = req.params[1];
  if (req.params[0] === 'facebook') {
    try {
      const user = await User.find({ where: { facebookUsername: username } });
      return res.status(200).send(user);
    } catch (err) {
      return res.sendStatus(500);
    }
  }
  return res.sendStatus(500);
});

server.post('/v1/users/findorcreate', async (req, res) => {  // fix this!!!!
  const facebookUsername = req.body.facebookUsername;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const token = req.body.token;
  const nativeLang = req.body.nativeLang;
  const learnLang = req.body.learnLang;
  const email = req.body.email;
  try {
    let user = await User.findOrCreate({
      where: { facebookUsername },
      defaults: {
        facebookUsername,
        firstName,
        lastName,
        token,
        nativeLang,
        learnLang,
        email,
      },
    });
    if (!user[1]) {
      try {
        user = await User.update({
          firstName,
          lastName,
          token,
          nativeLang,
          learnLang,
          email,
        }, {
          where: { facebookUsername },
        });
        try {
          user = await User.findOne({ where: { facebookUsername } });
          return res.status(200).send(user);
        } catch (erro) {
          return res.status(400).send(erro);
        }
      } catch (error) {
        return res.status(400).send(error);
      }
    } else {
      return res.status(200).send(user[0]);
    }
  } catch (err) {
    return res.status(400).send(err);
  }
});

server.post('/v1/users/addlang', (req, res) => { // good!
  const id = req.body.id;
  const nativeLang = req.body.nativeLang;
  const learnLang = req.body.learnLang;
  return dbHelpers.userAddLanguageInfo(id, nativeLang, learnLang, res);
});

server.get('/v1/decks/all', (req, res) => dbHelpers.getAllDecks(res)); // good!

server.get('/v1/decks/deckid/*', (req, res) => {  // good!
  const id = +req.params[0];
  return dbHelpers.getDeckByDeckId(id, res);
});

server.get('/v1/decks/userid/*', (req, res) => {  // good!
  const id = +req.params[0];
  return dbHelpers.getDeckByUserId(id, res);
});

server.get('/v1/cards/all', (req, res) => dbHelpers.getAllCards(res));

server.get('/v1/cards/deckid/*', async (req, res) => {  // good!
  const id = +req.params[0];
  try {
    const deck = await Deck.findAll({
      include: [{
        model: Card,
        attributes: ['id', 'imgUrl', 'wordMap', 'stars'],
        through: { attributes: ['lastVisited', 'timeInterval', 'phrase'] },
      }],
      where: { id },
      attributes: ['id', 'name'],
    });
    return res.status(200).send(deck);
  } catch (err) {
    return res.status(400).send(err);
  }
});

server.post('/v1/decks/new', (req, res) => {  // good!
  const name = req.body.name;
  const user_id = req.body.user_id;
  const stars = req.body.stars;
  return dbHelpers.userCreateNewDeck(name, user_id, stars, res);
});

server.post('/v1/cards/addcard', (req, res) => { // works, condense, default join table
  const user_id = req.body.user_id;
  const imgUrl = req.body.imgUrl;
  const wordMap = req.body.wordMap;
  const deck_id = req.body.deck_id;
  return dbHelpers.userAddCreatedCardToDeck(user_id, imgUrl, wordMap, deck_id, res);
});

server.post('/v1/decks/adddecks', async (req, res) => {
  const user_id = req.body.id;
  const decks = JSON.parse(req.body.decks);
  const createdDecksOutput = [];
  await Promise.all(decks.map(async (deckId) => {
    try {
      const originalDeck = await Deck.findOne({ where: { id: deckId } });
      const name = originalDeck.name;
      try {
        const createdDeck = await Deck.create({ user_id, name, stars: 0 });
        return createdDecksOutput.push(createdDeck);
      } catch (err) {
        return res.status(400).send(err);
      }
    } catch (error) {
      return res.status(400).send('error');
    }
  }));
  return res.status(200).send(createdDecksOutput);
});

server.post('/v1/decks/addcards', async (req, res) => {  // need to FIX!!!, should add user spec info to join table!!!!
  const deckId = req.body.deckId;
  const cardIdsArr = JSON.parse(req.body.cardIds);
  try {
    await dbHelpers.createCardsForDeckByCardIds(deckId, cardIdsArr, res);
    return res.sendStatus(200);
  } catch (err) {
    return res.status(400).send(err);
  }
});

server.delete('/v1/decks/*', async (req, res) => {  // good!
  const id = +req.params[0];
  return dbHelpers.deleteDeckById(id, res);
});

server.delete('/v1/cards/*', async (req, res) => {  // good!
  const id = req.params[0];
  return dbHelpers.deleteCardById(id, res);
});


// ///////////////////////// END ENDPOINTS /////////////////////////////////
