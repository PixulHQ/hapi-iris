'use strict';

const Publisher = require('./Publisher');
const Consumer  = require('./Consumer');
const Emittery  = require('emittery');

/**
 * @Type RPCConsumer
 */
class RPCConsumer extends Emittery {

    constructor(connection, options) {

        super();

        this.configurations = options;
        this.connection     = connection;
    }

    /**
     * @return {Promise<Consumer>}
     */
    subscribe() {

        return this.consume();
    }

    /**
     * @return {Promise<Consumer>}
     */
    consume() {

        const options = Object.assign({}, this.configurations, {
            consumer : {
                receiveFunc : async (message) => {

                    try {
                        const response = await this.configurations.receiveFunc(message);

                        return await this.respond(message.properties.replyTo, message.properties.correlationId, response);
                    }
                    catch (error) {
                        await this.respond(message.properties.replyTo, message.properties.correlationId, JSON.stringify(error));
                    }
                }
            }
        });

        this.consumer = new Consumer(this.connection, options);

        this.consumer.onAny((event, data) => this.emit(event, data));

        return this.consumer.subscribe();
    }

    /**
     * @private
     * @param queue
     * @param correlationId
     * @param message
     * @return {Promise<void>}
     */
    async respond(queue, correlationId, message) {

        const msg = Publisher.prepareMessage(message);

        msg.options.correlationId = correlationId;

        const publisher = new Publisher(await this.connection.getChannel(), { queue : { name : queue } });

        try {
            return publisher.publish(msg);
        }
        catch (error) {
            this.emit('log', { tags : ['error', 'AMQP', 'RPC', 'consumer'], message : `Couldn't send the response : ${error.message}` });
            this.emit('error', { error, data : { message } });
        }

    }
}

module.exports = RPCConsumer;
