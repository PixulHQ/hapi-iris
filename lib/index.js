'use strict';

const AMQPConnection = require('./AMQPConnection');
const Publisher      = require('./Publisher');
const RPCPublisher   = require('./RPCPublisher');
const RPCConsumer    = require('./RPCConsumer');
const Consumer       = require('./Consumer');

const internals = {};

exports.plugin = {
    pkg      : require('../package.json'),
    register : async (server, options) => {

        internals.amqpConnection = new AMQPConnection(options);

        await internals.amqpConnection.connect();

        server.decorate('server', 'rabbit', {
            connection   : internals.amqpConnection,
            Publisher,
            RPCPublisher,
            RPCConsumer,
            Consumer,
            publish      : internals.publish,
            subscribe    : internals.subscribe,
            publishRPC   : internals.publishRPC,
            subscribeRPC : internals.subscribeRPC
        });

        server.ext('onPreStop', async () => {

            await internals.amqpConnection.close();
        });

        internals.amqpConnection.on('log', console.log);
    }
};

/**
 * Publish a message to an exchange or a queue.
 *
 * @param       {Object}            params
 * @param       {Object}            [params.exchange]
 * @param       {Object}            [params.queue]
 * @param       {Object||String}    params.message
 * @param       {String}            [params.routingKey]
 *
 * @return      {Promise<void>}
 */
internals.publish = async (params) => {

    const channel = await internals.amqpConnection.getChannel();

    await new Publisher(channel, { exchange : params.exchange, queue : params.queue, routingKey : params.routingKey }).publish(params.message);

    return channel.close();
};

/**
 * Subscribe messages on an exchange or a queue. Automatic reconnection to a new channel on connection error/lost.
 *
 * @param       {object}            params
 * @param       {object}            [params.exchange]
 * @param       {object}            [params.queue]
 * @param       {object}            params.consumer
 * @param       {String[]}          [params.routingKeys]
 * @param       {Object}            [params.debug]
 */
internals.subscribe = (params) => {

    return new Consumer(internals.amqpConnection, {
        exchange    : params.exchange,
        queue       : params.queue,
        consumer    : params.consumer,
        routingKeys : params.routingKeys,
        debug       : params.debug
    }).subscribe();
};

/**
 * Send a RPC request : send a message on a queue and wait for a response from consumer
 *
 * @param       {Object}            params
 * @param       {Object}            [params.exchange]
 * @param       {Object}            [params.queue]
 * @param       {Object||String}    params.message
 * @param       {String}            [params.routingKey]
 *
 * @returns     {Promise}
 */
internals.publishRPC = (params) => {

    return new RPCPublisher(internals.amqpConnection, {
        exchange   : params.exchange,
        queue      : params.queue,
        routingKey : params.routingKey
    }).publish(params.message);
};

/**
 * Answer to a RPC request
 *
 * @param       {object}            params
 * @param       {object}            [params.exchange]
 * @param       {object}            [params.queue]
 * @param       {object}            params.consumer
 * @param       {String[]}          [params.routingKeys]
 * @param       {Object}            [params.debug]
 */
internals.subscribeRPC = (params) => {

    return new RPCConsumer(internals.amqpConnection, {
        exchange    : params.exchange,
        queue       : params.queue,
        consumer    : params.consumer,
        routingKeys : params.routingKeys,
        debug       : params.debug
    }).subscribe();
};


