const bluebird = require('bluebird');
const User = require('./user/user_schema');
const Card = require('./card/card_schema');
const Deck = require('./deck/deck_schema');
const DeckCard = require('./deck_card/deck_card_schema');
const UserCard = require('./user_card/user_card_schema');

module.exports = {
  findUserIfExistsBySocialId: async (socialLoginSource, username, res) => {
    try {
      const user = await User.findOne({ where: { facebookUsername: username } });
      if (user === null) {
        return res.status(200).send({});
      }
      return res.status(200).send(user);
    } catch (err) {
      return res.sendStatus(500);
    }
  },
  findAndUpdateOrCreateUser: async (
    facebookUsername,
    firstName,
    lastName,
    token,
    nativeLang,
    learnLang,
    email,
    res) => {
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
  },
  getAllDecks: async (res) => {
    try {
      const decks = await Deck.findAll({
        include: [
          {
            model: Card,
            attributes: ['imgUrl'],
            through: { attributes: [] },
          },
        ],
        attributes: ['id', 'name', 'stars'],
      });
      return res.status(200).send(decks);
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  getDeckByDeckId: async (id, res) => {
    try {
      const decks = await Deck.findAll({
        include: [
          {
            model: Card,
            attributes: ['id', 'imgUrl', 'wordMap', 'stars'],
            through: { attributes: [] },
          },
        ],
        where: { id },
        attributes: ['id', 'name', 'stars'],
      });
      if (!decks.length) {
        return res.status(400).send('Failed to find Deck in Database');
      }
      return res.status(200).send(decks[0]);
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  getDeckByUserId: async (id, res) => {
    try {
      const decks = await Deck.findAll({
        include: [
          {
            model: Card,
            attributes: ['imgUrl'],
            through: { attributes: [] },
          },
          {
            model: User,
            attributes: [],
          },
        ],
        where: { user_id: id },
        attributes: ['id', 'name', 'stars'],
      });
      return res.status(200).send(decks);
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  getAllCards: async (res) => {
    try {
      const cards = await Card.findAll({ attributes: ['id', 'imgUrl', 'stars'] });
      return res.status(200).send(cards);
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  userCreateNewDeck: async (name, user_id, stars, res) => {
    try {
      const deck = await Deck.create({ name, user_id, stars });
      return res.status(200).send(deck);
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  userAddCreatedCardToDeck: async (user_id, imgUrl, wordMap, deck_id, res) => {
    try {
      const card = await Card.create({ stars: 0, wordMap, imgUrl });
      try {
        await card.addUser(user_id);
        try {
          await card.addDeck(deck_id);
          return res.status(200).send(card);
        } catch (error) {
          return res.status(500).send(error);
        }
      } catch (erro) {
        return res.status(500).send(erro);
      }
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  deleteCardById: async (id, res) => {
    try {
      const numDeletedCards = await Card.destroy({
        where: { id },
      });
      if (numDeletedCards) {
        return res.sendStatus(200);
      }
      return res.sendStatus(400);
    } catch (err) {
      return res.sendStatus(400);
    }
  },
  deleteDeckById: async (id, res) => {
    try {
      const numDeletedDecks = await Deck.destroy({
        where: { id },
      });
      if (numDeletedDecks) {
        return res.sendStatus(200);
      }
      return res.sendStatus(400);
    } catch (err) {
      return res.sendStatus(400);
    }
  },
  createCardsForDeckByCardIds: async (deck_id, cardIdsArr, res) => {
    await Promise.all(cardIdsArr.map(async (card_id) => {
      try {
        const deck = await Deck.findOne({ where: { id: deck_id } });
        try {
          await deck.addDeck(deck_id);
          try {
            await deck.addCard(card_id);
            return 'OK';
          } catch (error) {
            return res.status(400).send(error);
          }
        } catch (erro) {
          return res.status(400).send(erro);
        }
      } catch (err) {
        return res.status(400).send(err);
      }
    }));
  },
};
