'use strict';

const Emittery = require('emittery');
const Joi      = require('joi');

const Publisher = require('./Publisher');
const Schema    = require('./schema');

/**
 * @Type Consumer
 */
class Consumer extends Emittery {

    constructor(connection, options) {

        super();

        this.configurations = Joi.attempt(options, Joi.object().keys({
            consumer    : Consumer.schema,
            exchange    : Schema.exchange.default(null),
            queue       : Schema.queue.default({}),
            routingKeys : Joi.array().items(Joi.string()).default([]),
            debug       : Joi.object().keys({
                enabled    : Joi.boolean().default(false),
                expires    : Joi.number().integer().positive().default(86400000),     // 24 hours
                durable    : Joi.boolean().default(true),
                persistent : Joi.boolean().default(true),
                queue      : Schema.queue
            })
        }));

        this.connection = connection;

        this.connection.on('reconnected', () => (this.subscribe()));
    }

    /**
     * @return {Promise<Consumer>}
     */
    async subscribe() {

        await this.assertRabbitInfra();

        this.emit('subscribed', this);

        await this.consume();

        return this;
    }

    /**
     * @private
     * @return {Promise<void>}
     */
    async assertRabbitInfra() {

        this.channel = await this.connection.getChannel();

        if (this.configurations.exchange && this.configurations.exchange.name && this.configurations.exchange.name !== '') {
            await this.channel.assertExchange(this.configurations.exchange.name, this.configurations.exchange.type, this.configurations.exchange.options);
        }

        this.queue = await this.channel.assertQueue(this.configurations.queue.name || '', this.configurations.queue.options);

        if (this.configurations.exchange && this.configurations.exchange.name && this.configurations.exchange.name !== '') {
            await Promise.all(this.configurations.routingKeys.map((rk) => this.channel.bindQueue(this.queue.queue, this.configurations.exchange.name, rk)));
        }

        await this.channel.prefetch(this.configurations.consumer.options.prefetch);
    }

    /**
     * @private
     * @return {Promise<void>}
     */
    async consume() {

        if (this.configurations.debug && this.configurations.debug.enabled) {
            if (!this.configurations.debug.queue.name || this.configurations.debug.queue.name === '') {
                this.configurations.debug.queue.name = `debug.${this.queue.queue}`;
            }

            this.debugPublisher = new Publisher(this.channel, { queue : this.configurations.debug.queue });
        }

        this.consumer = await this.channel.consume(this.queue.queue, async (message) => {

            this.emit('message', message);

            try {
                message.content = message.content.toString();

                await this.configurations.consumer.receiveFunc(message);

                if (!this.configurations.consumer.options.noAck) {
                    this.channel.ack(message, this.configurations.consumer.options.allUpTo);
                }

                this.emit('acknowledged', message);
            }
            catch (error) {
                this.emit('log', { tags : ['error', 'AMQP', 'consumer'], message : error.message });
                this.emit('error', { error, message });

                if (!this.configurations.consumer.options.noAck) {
                    this.channel.nack(message, this.configurations.consumer.options.allUpTo, this.configurations.consumer.options.requeue);
                }

                if (this.configurations.debug.enabled) {
                    await this.debugPublisher.publish(JSON.stringify({ error, message }));
                    this.emit('debug', { error, message });
                }
            }
        }, this.configurations.consumer.options);

        await this.configurations.consumer.waitingFunc();
    }

    /**
     * Close the current consumer
     *
     * @return {Promise<void>}
     */
    async close() {

        await this.channel.cancel(this.consumer.consumerTag);
        return this.channel.close();
    }

    static get schema() {

        return Joi.object().keys({
            options     : Joi.object().keys({
                consumerTag : Joi.string(),
                noLocal     : Joi.boolean().default(false),
                requeue     : Joi.boolean().default(true),
                noAck       : Joi.boolean().default(false),
                exclusive   : Joi.boolean().default(false),
                allUpTo     : Joi.boolean().default(false),
                priority    : Joi.number().integer(),
                arguments   : Joi.object(),
                prefetch    : Joi.number().integer().positive()
            }).default({ allUpTo : false, noAck : false }),
            receiveFunc : Joi.func().default(() => {}),
            waitingFunc : Joi.func().default(() => {})
        });
    }
}

module.exports = Consumer;
