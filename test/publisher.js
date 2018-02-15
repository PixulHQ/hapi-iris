'use strict';

const Code   = require('code');
const Uuidv4 = require('uuid/v4');

const Lab = require('lab');

const lab = exports.lab = Lab.script();
const { afterEach, beforeEach, describe, it } = lab;
const expect                                  = Code.expect;

const AMQPConnection = require('../lib/AMQPConnection');
const Publisher      = require('../lib/Publisher');
const Consumer       = require('../lib/Consumer');

describe('Publisher :', () => {

    describe('prepareMessage()', () => {

        it('should add default value to the object', () => {

            const message = {
                content : Uuidv4()
            };

            const preparedMessage = Publisher.prepareMessage(message);

            expect(preparedMessage.content.toString()).to.equal(message.content);
        });

        it('should convert a string to a message', () => {

            const message = Uuidv4();

            const preparedMessage = Publisher.prepareMessage(message);

            expect(preparedMessage.content.toString()).to.equal(message);
        });

        it('should convert a String object to a message', () => {

            const message = String(Uuidv4());

            const preparedMessage = Publisher.prepareMessage(message);

            expect(preparedMessage.content.toString()).to.equal(message);
        });
    });

    describe('publish()', () => {

        const autoDeleteOptions = { durable : false, autoDelete : true };

        let amqpConnection = undefined;

        beforeEach(async () => {

            amqpConnection = new AMQPConnection({});

            await amqpConnection.connect();
        });

        afterEach(async () => {

            await amqpConnection.close();
        });

        describe('on Queue', () => {

            it('should publish using a routingKey', async () => {

                const queue      = { name : Uuidv4(), options : autoDeleteOptions };
                const routingKey = Uuidv4();

                const message = String(Uuidv4());

                const resultPromise = new Promise((fulfil) => {

                    return new Consumer(amqpConnection, {
                        queue,
                        routingKeys : [routingKey],
                        consumer    : {
                            receiveFunc : (data) => {

                                expect(data.content.toString()).to.equal(message);
                                fulfil();
                            }
                        }
                    }).subscribe();
                });

                await new Publisher(await amqpConnection.getChannel(), { queue, routingKey }).publish(message);

                await resultPromise;
            });

            it('should publish without exchange', async () => {

                const queue = { name : Uuidv4(), options : autoDeleteOptions };

                const message = String(Uuidv4());

                const resultPromise = new Promise((fulfil) => {

                    return new Consumer(amqpConnection, {
                        queue, consumer : {
                            receiveFunc : (data) => {

                                expect(data.content.toString()).to.equal(message);
                                fulfil();
                            }
                        }
                    }).subscribe();
                });

                await new Publisher(await amqpConnection.getChannel(), { queue }).publish(message);

                await resultPromise;
            });

        });

        describe('on Exchange', () => {

            it('should publish using routingKey', () => {

                const exchange = { name : Uuidv4(), options : autoDeleteOptions };

                const message    = Uuidv4();
                const routingKey = Uuidv4();

                return new Promise(async (fulfil) => {

                    await new Consumer(amqpConnection, {
                        exchange,
                        queue       : { options : autoDeleteOptions },
                        routingKeys : [routingKey],
                        consumer    : {
                            receiveFunc : (data) => {

                                expect(data.content.toString()).to.equal(message);
                                fulfil();
                            }
                        }
                    }).subscribe();

                    await new Publisher(await amqpConnection.getChannel(), { exchange, routingKey }).publish(message);
                });
            });

        });
    });
});
