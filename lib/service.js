'use strict';

const { getDestinyResource } = require('./utils');
const {
  getCharacterUrl,
  getHistoricalUrl,
  getPlayerUrl,
  getStatsUrl,
  getXurUrl,
} = require('./endpoints');

const classMap = {
  '671679327': 'Hunter',
  '2271682572': 'Warlock',
  '3655393761': 'Titan'
};

const defaultClasses = ['warlock', 'hunter', 'titan'];

exports.requestMembershipId = function requestMembershipId(apiKey, state) {
  return getDestinyResource(apiKey, getPlayerUrl(state.accountType, state.accountId))
    .then(res => {
      if (res.ErrorCode !== 1 || res.ErrorStatus !== 'Success') {
        throw new Error(`${res.ErrorStatus}: ${res.Message}`);
      }

      return res;
    })
    .then(res => res.Response && res.Response.length > 0 && res.Response[0].membershipId)
    .then(membershipId => {
      if (!membershipId) {
        throw new Error(`DESTINY_REQUEST_ERROR: membershipId not found for accountId: ${state.accountId}`);
      }

      return Object.assign({}, state, { membershipId });
    });
};

exports.requestCharacterIds = function requestCharacterIds(apiKey, state) {
  return getDestinyResource(apiKey, getStatsUrl(state.accountType, state.membershipId))
    .then(res => {
      if (res.ErrorCode !== 1 || res.ErrorStatus !== 'Success') {
        throw new Error(`${res.ErrorStatus}: ${res.Message}`);
      }

      return res;
    })
    .then(res => res.Response && res.Response.data && res.Response.data.characters)
    .then(characters => ({
      ids: characters && characters.map(c => c.characterBase.characterId),
      idToClassName: characters && characters.map(c => {
        return {
          className: classMap[c.characterBase.classHash].toLowerCase(),
          id: c.characterBase.characterId,
        }
      })
    }))
    .then(obj => {
      return Object.assign({}, state, {
        characterIds: obj.ids,
        characterIdToClassName: obj.idToClassName,
      });
    })
};

exports.requestCharacterStats = function requestCharacterStats(classes) {
  const classesToReduce = classes.length === 0
    ? defaultClasses
    : classes;

  const filterClasses = classesToReduce.reduce((obj, c) => Object.assign(obj, { [c]: 1 }), {});

  return (apiKey, state) => {
    const { accountType, membershipId, characterIds } = state;

    const characterPromises = characterIds.map(id => {
      return getDestinyResource(apiKey, getCharacterUrl(accountType, membershipId, id))
        .then(res => {
          if (res.ErrorCode !== 1 || res.ErrorStatus !== 'Success') {
            throw new Error(`${res.ErrorStatus}: ${res.Message}`);
          }

          return res;
        })
    });

    return Promise.all(characterPromises)
      .then(responses => responses.map(r => ({
        definitions: r.Response.definitions,
        character: r.Response.data,
      })))
      .then(responses => responses.filter(response => {
        const className = classMap[response.character.characterBase.classHash];
        return filterClasses[className.toLowerCase()] === 1;
      }))
      .then(responses => {
        return Object.assign({}, state, {
          characterStats: responses,
        })
      });
  };
};

exports.requestCharacterHistoricalStats = function requestCharacterHistoricalStats(classes) {
  const classesToReduce = classes.length === 0
    ? defaultClasses
    : classes;

  const filteredClasses = classesToReduce.reduce((obj, c) => Object.assign(obj, { [c]: 1}), {});
  return (apiKey, state) => {
    const { accountType, membershipId, characterIdToClassName } = state;

    const characterPromises = characterIdToClassName
      .filter(c => filteredClasses[c.className] === 1)
      .map(character => {
        return getDestinyResource(apiKey, getHistoricalUrl(accountType, membershipId, character.id))
          .then(res => {
            if (res.ErrorCode !== 1 || res.ErrorStatus !== 'Success') {
              throw new Error(`${res.ErrorStatus}: ${res.Message}`);
            }

            return res;
          })
      });

    return Promise.all(characterPromises)
      .then(responses => responses.map(r => ({
        stats: r.Response,
      })))
      .then(responses => {
        return Object.assign({}, state, {
          historicalStats: responses,
        })
      });
  }
}

exports.requestXur = function requestXur(apiKey, state) {
  return getDestinyResource(apiKey, getXurUrl())
    .then(res => {
      if (res.ErrorCode !== 1 || res.ErrorStatus !== 'Success') {
        throw new Error(`${res.ErrorStatus}: ${res.Message}`);
      }

      return res;
    })
    .then(res => {
      return Object.assign({}, state, {
        xur: res.Response.data,
        xurDefinitions: res.Response.definitions,
      });
    });
};
