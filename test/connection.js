'use strict';

const Lab = require('lab');

const lab = exports.lab = Lab.script();
const { afterEach, describe, it } = lab;

const AMQPConnection = require('../lib/AMQPConnection');

describe('AMQPConnection', () => {

    let amqpConnection;

    afterEach(async () => {

        await amqpConnection.close();
    });

    it('should be able to connect', async () => {

        amqpConnection = new AMQPConnection();

        await amqpConnection.connect();
    });

    it('should be able to close and reconnect after', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('connected', flags.mustCall(() => {}, 2));

        await amqpConnection.connect();

        await amqpConnection.close();

        await amqpConnection.connect();
    });

    it('it should\'t try to close a not connected connection', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('connected', flags.mustCall(() => {}, 0));
        amqpConnection.on('close', flags.mustCall(() => {}, 0));

        await amqpConnection.close();
    });

    it('should be able auto connect when a channel is requested', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        await amqpConnection.getChannel();
    });

    it('shouldn\'t connect when it\'s already trying to connect', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        amqpConnection.connect();
        amqpConnection.reconnect();

        await amqpConnection.getChannel();
    });

    it('shouldn\'t connect when it\'s already connected', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        await amqpConnection.connect();
    });

    it('should try to reconnect by default if the connection is close by rabbitMQ', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('connected', flags.mustCall(() => {}, 2));
        amqpConnection.on('reconnected', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        amqpConnection.connection.emit('close', new Error('test error'));

        await amqpConnection.once('log');
        await amqpConnection.once('connected');
    });

    it('should not try to reconnect if the connection is close by rabbitMQ', async (flags) => {

        amqpConnection = new AMQPConnection({ autoReconnect : false });

        amqpConnection.on('connected', flags.mustCall(() => {}, 1));
        amqpConnection.on('reconnected', flags.mustCall(() => {}, 0));
        amqpConnection.on('close', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        amqpConnection.connection.emit('close', new Error('test error'));

        await amqpConnection.once('close');
    });

    it('should log an error and try to reconnect if rabbitMQ throw a closing connection error', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('error', flags.mustCall(() => {}, 1));
        amqpConnection.on('connected', flags.mustCall(() => {}, 2));
        amqpConnection.on('reconnected', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        amqpConnection.connection.emit('error', new Error('AMQPConnection closing'));

        await amqpConnection.once('error');

        await amqpConnection.once('connected');
    });

    it('should log an error and not try to reconnect if rabbitMQ throw a closing connection error and autoReconnect is false', async (flags) => {

        amqpConnection = new AMQPConnection({ autoReconnect : false });

        amqpConnection.on('error', flags.mustCall(() => {}, 1));
        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        amqpConnection.connection.emit('error', new Error('AMQPConnection closing'));

        await amqpConnection.once('error');
    });

    it('should log an error and not try to reconnect if rabbitMQ throw a simple connection error', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('error', flags.mustCall(() => {}, 1));
        amqpConnection.on('connected', flags.mustCall(() => {}, 1));
        amqpConnection.on('reconnected', flags.mustCall(() => {}, 0));

        await amqpConnection.connect();

        amqpConnection.connection.emit('error', new Error('w00t w00t sweet error'));

        await amqpConnection.once('error');
    });

    it('should stop trying to reconnect if retry reached max retry', async (flags) => {

        amqpConnection = new AMQPConnection();

        amqpConnection.on('error', flags.mustCall(() => {}, 2));
        amqpConnection.on('connected', flags.mustCall(() => {}, 1));

        await amqpConnection.connect();

        amqpConnection.retry = amqpConnection.options.maxRetry;

        amqpConnection.connection.emit('error', new Error('AMQPConnection closing'));

        await amqpConnection.once('error');

        await amqpConnection.once('error');
    });
});
