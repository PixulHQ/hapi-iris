'use strict';

const Emittery = require('emittery');
const Amqp     = require('amqplib');
const Joi      = require('joi');

/**
 * @Type AMQPConnection
 */
class AMQPConnection extends Emittery {

    constructor(options) {

        super();

        this.options    = Joi.attempt(options || {}, AMQPConnection.schema, 'Invalid AMQP connection options');
        this.connected  = false;
        this.connecting = false;
        this.closed     = false;
        this.retry      = 0;
    }

    /**
     * @return {Promise<AMQPConnection>}
     */
    async connect() {

        if (this.connected) {
            return this;
        }

        try {
            this.connecting = true;

            this.connection = await Amqp.connect(this.options.connection, this.options.socketOptions);

            this.connection.on('error', (error) => {

                this.emit('log', { tags : ['error', 'AMQP', 'connection'], message : error.message });
                this.emit('error', error);

                if (error.message === 'AMQPConnection closing' && this.options.autoReconnect === true && this.closed === false) {

                    return this.reconnect();
                }
            });

            this.connection.on('close', () => {

                if (this.options.autoReconnect === true && this.closed === false) {
                    return this.reconnect();
                }

                this.emit('close', this);
            });

            this.connected  = true;
            this.connecting = false;

            this.emit('connected', this);
            this.emit('log', { tags : ['info', 'AMQP', 'connection'], message : 'connected' });

            if (this.retry !== 0) {
                this.emit('reconnected');
            }

            this.retry = 0;

            return this;
        }
        catch (error) {
            this.emit('log', { tags : ['error', 'AMQP', 'connection'], message : error.message });
            this.emit('error', error);
            return this.reconnect();
        }
    }

    /**
     * @return {Promise<AMQPConnection>}
     */
    async reconnect() {

        if (this.connecting) {
            return this.once('connected');
        }

        if (this.retry >= this.options.maxRetry) {
            await this.close();

            this.emit('log', { tags : ['info', 'AMQP', 'connection'], message : 'max retry reached, stop trying to connect' });

            const error = new Error('Cannot reconnect to AMQP server');
            this.emit('error', error);
        }

        this.connected  = false;
        this.connecting = true;
        this.connection = undefined;

        const range = Math.floor(this.retry / 5);

        await new Promise((resolve) => setTimeout(resolve, Math.min(range * (Math.pow(range, 1.5)) * 60000, this.options.maxDelay) || 1000));

        this.retry++;

        this.emit('log', { tags : ['info', 'AMQP', 'connection'], message : 'trying to reconnect' });

        return this.connect();
    }

    /**
     * @return {Promise<AMQPConnection>}
     */
    async close() {

        this.closed = true;

        if (this.connected) {
            this.connected = false;

            await this.connection.close();

            this.emit('close', this);

            return this;
        }
    }

    async getChannel() {

        if (!this.connected) {
            if (this.connecting) {
                await this.once('connected');
            }
            else {
                await this.connect();
            }
        }

        try {
            const channel = await this.connection.createChannel();

            channel.on('error', (error) => {

                this.emit('log', { tags : ['error', 'AMQP', 'channel'], message : error.message });
                this.emit('error', error);
            });

            return channel;
        }
        catch (error) {
            this.emit('log', { tags : ['error', 'AMQP', 'channel'], message : error.message });
            throw new Error(`Couldn't create a channel : ${error.message}`);
        }
    }

    static get schema() {

        return Joi.object().keys({
            connection    : Joi.object().keys({
                hostname  : Joi.string().hostname().default('localhost'),
                port      : Joi.number().integer().positive().max(65535).default(5672),
                vhost     : Joi.string().default('/'),
                username  : Joi.string().default('guest'),
                password  : Joi.string().default('guest'),
                heartbeat : Joi.number().integer().positive().default(30),
                locale    : Joi.string().default('en_US'),
                frameMax  : Joi.number().integer().positive().default(0)
            }),
            maxRetry      : Joi.number().integer().min(0).default(Infinity),
            autoReconnect : Joi.boolean().default(true),
            maxDelay      : Joi.number().integer().positive().default(3600000),
            socketOptions : Joi.object({
                timeout : Joi.number().integer().positive().default(3000)
            })
        });
    }
}

module.exports = AMQPConnection;
