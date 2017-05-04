const { create } = require('rung-sdk');
const { String: Text, IntegerRange, Money } = require('rung-sdk/dist/types');
const agent = require('superagent');
const Bluebird = require('bluebird');
const promisifyAgent = require('superagent-promise');
const {
    F, T, allPass, always, apply, both, complement, concat, divide, filter, has, flip, gte, isNil, lte, map, mergeAll, multiply, path, pipe, prop, props, subtract, tryCatch
} = require('ramda');

const request = promisifyAgent(agent, Bluebird);

const storeApi = 'https://store.steampowered.com/api';

const notNil = complement(isNil);

const getDiscount = tryCatch(
    pipe(
        prop('price'),
        props(['initial', 'final']),
        apply(flip(divide)),
        subtract(1),
        multiply(100),
        parseInt),
    always(0));

function alertFromItem(item) {
    const discount = getDiscount(item);
    const { name, id, tiny_image: picture, price } = item;
    const finalPrice = `R$ ${(price.final / 100).toFixed(2)}`;
    const title = `${name} a ${finalPrice}`;
    const url = `http://store.steampowered.com/app/${id}`;

    return {
        [id]: {
            title: discount > 0
                ? concat(title, ` com ${discount}% de desconto`)
                : title,
            comment: `
                ### ${name} - **${finalPrice}**

                [![Acessar](${picture})](${url})`
        }
    };
}

function main(context) {
    const { searchTerm, discount } = context.params;
    const price = parseInt(context.params.price * 100)

    const considerPrice = price !== 0;
    const considerDiscount = discount !== 0;

    const satisfiesDiscount = pipe(getDiscount, lte(discount));

    const satisfiesPrice = pipe(
        path(['price', 'final']),
        both(notNil, gte(price)));

    return request.get(`${storeApi}/storesearch`)
        .query({ term: searchTerm })
        .query({ cc: 'BR' })
        .end()
        .then(pipe(
            path(['body', 'items']),
            filter(allPass([
                has('price'),
                considerPrice ? satisfiesPrice : T,
                considerDiscount ? satisfiesDiscount : T])),
            map(alertFromItem),
            mergeAll));
}

const params = {
    searchTerm: {
        description: 'Nome do item a ser procurado',
        type: Text,
        default: 'Counter Strike'
    },
    discount: {
        description: 'Desconto mínimo desejado, em %',
        type: IntegerRange(0, 100),
        default: 0
    },
    price: {
        description: 'Preço máximo desejado',
        type: Money,
        default: 0
    }
};

const app = create(main, { params, primaryKey: true });
module.exports = app;
