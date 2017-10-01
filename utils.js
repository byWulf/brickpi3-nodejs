const sleep = require('system-sleep');
const Motor = require('./objects/motor');
const Sensor = require('./objects/sensor');

const RESET_MOTOR_LIMIT = {
    CURRENT_POSITION: 1,
    FORWARD_LIMIT: 2,
    BACKWARD_LIMIT: 3,
    MIDPOINT_LIMIT: 4
};

/**
 * Resets the motors offset encoder to the given type of offset.
 *
 * Valid limit values:
 * * RESET_MOTOR_LIMIT.CURRENT_POSITION: The current position becomes the 0-point.
 * * RESET_MOTOR_LIMIT.FORWARD_LIMIT: It rotates forward until it detects an obstacle and uses this as the new 0-point.
 * * RESET_MOTOR_LIMIT.BACKWARD_LIMIT: It rotates backward until it detects an obstacle and uses this as the new 0-point.
 * * RESET_MOTOR_LIMIT.MIDPOINT_LIMIT: It first rotates forwards and searches for an obstacle, then rotates backward and
 *   searches for an obstacle. The middle between those two extreme points becomes the new 0-point.
 *
 * @param {Object} brickPiInstance Instance of the BrickPi class in which the motor is plugged in
 * @param {number} motorPort The port of the motor to be manipulated (brickPiInstance.PORT_A, .PORT_B, .PORT_C, .PORT_D)
 * @param {number} limitType Search for this point. See above description.
 * @param {number} newOffset Set the found point to this offset value.
 * @param {number} maxPower When the power of the motor drops below this value, it is considered to be an obstacle. (WARNING: power is currently "dps", because I couldn't find a way to get the current power of the motor.. get_motor_status states that it returnes the power, but instead returnes the speed :/)
 * @param {number} timeLimit If no obstacle is found within this time limit, the promise gets rejected.
 * @param {number} motorPower Power of the motor (lower for smoother finding)
 * @return {Promise} When the new offset is set, the promise resolves.
 */
const resetMotorEncoder = (brickPiInstance, motorPort, limitType = RESET_MOTOR_LIMIT.CURRENT_POSITION, newOffset = 0, maxPower = 25, timeLimit = 10000, motorPower = 100) => {
    return new Promise((resolve, reject) => {

        let startTime = Date.now();
        const checkPower = (callback) => {
            sleep(20);
            if (Date.now() - startTime > timeLimit) {
                brickPiInstance.set_motor_power(motorPort, 0).then(() => {
                    callback(new Error('resetMotorEncoder: timeLimit exceeded'));
                }).catch((err) => {
                    callback(err);
                });
                return;
            }

            brickPiInstance.get_motor_status(motorPort).then((status) => {
                if (Math.abs(status[3]) <= maxPower) {
                    brickPiInstance.set_motor_power(motorPort, 0).then(() => {
                        callback(null, status[2]);
                    }).catch((err) => {
                        callback(err);
                    });
                } else {
                    checkPower(callback);
                }
            });
        };

        if (limitType === RESET_MOTOR_LIMIT.CURRENT_POSITION) {
            brickPiInstance.get_motor_encoder(motorPort).then((offset) => {
                return brickPiInstance.offset_motor_encoder(motorPort, offset - newOffset);
            }).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        } else if (limitType === RESET_MOTOR_LIMIT.FORWARD_LIMIT || limitType === RESET_MOTOR_LIMIT.BACKWARD_LIMIT) {
            let power = motorPower;
            if (limitType === RESET_MOTOR_LIMIT.BACKWARD_LIMIT) power = -motorPower;

            brickPiInstance.set_motor_power(motorPort, power).then(() => {
                checkPower((err, offset) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    brickPiInstance.offset_motor_encoder(motorPort, offset - newOffset).then(() => {
                        resolve();
                    }).catch((err) => {
                        reject(err);
                    });
                });
            }).catch((err) => {
                reject(err);
            });
        } else if (limitType === RESET_MOTOR_LIMIT.MIDPOINT_LIMIT) {
            brickPiInstance.set_motor_power(motorPort, motorPower).then(() => {
                checkPower((err, offsetForward) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    brickPiInstance.set_motor_power(motorPort, -motorPower).then(() => {
                        checkPower((err, offsetBackward) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            brickPiInstance.offset_motor_encoder(motorPort, offsetBackward + (offsetForward - offsetBackward) / 2 - newOffset).then(() => {
                                resolve();
                            }).catch((err) => {
                                reject(err);
                            });
                        });
                    }).catch((err) => {
                        reject(err);
                    });
                });
            }).catch((err) => {
                reject(err);
            });
        } else {
            throw new Error('resetMotorEncoder: Invalid limitType.');
        }
    });
};

let resetBrickPis = [];
let shutdownHandlerRegistered = false;
const resetAllWhenFinished = (brickPiInstance) => {
    if (!shutdownHandlerRegistered) {
        shutdownHandlerRegistered = true;

        async function exitHandler(err) {
            if (err) console.log(err.stack);

            for (let i = 0; i < resetBrickPis.length; i++) {
                await resetBrickPis[i].reset_all();
            }

            process.exit();
        }

        process.stdin.resume();
        process.on('exit', exitHandler);
        process.on('SIGINT', exitHandler);
        process.on('uncaughtException', exitHandler);
    }

    resetBrickPis.push(brickPiInstance);
};

/**
 * Sets the motors position and resolves, when the final position is reached
 * @deprecated Will be removed in 1.0.0. Use brickpi3.utils.getMotor(BP, port).setPosition(targetPosition);
 *
 * @param brickPiInstance
 * @param motorPort
 * @param targetPosition
 * @return {Promise}
 */
const setMotorPosition = (brickPiInstance, motorPort, targetPosition) => {
    return new Promise((resolve, reject) => {
        let lastEncoder = null;
        const checkPosition = (callback) => {
            sleep(20);

            brickPiInstance.get_motor_encoder(motorPort).then((encoder) => {
                if (lastEncoder !== null && lastEncoder === encoder) {
                    callback();
                    return;
                }
                lastEncoder = encoder;

                checkPosition(callback);
            });
        };

        brickPiInstance.set_motor_position(motorPort, targetPosition).then(() => {
            checkPosition(() => {
                resolve();
            });
        });
    });
};

/**
 * Waits for a simple sensor to become a given value. Works with all sensors, which return a scalar value (and not an
 * array). If the sensor returns the value, the promise is resolved.
 * @deprecated Will be removed in 1.0.0. Use brickpi3.utils.getSensor(BP, BP.PORT_1).waitFor(1);
 *
 * @param {Object} brickPiInstance
 * @param {*} sensorPort
 * @param {number} targetValue
 * @param {number} timeLimit
 * @return {Promise}
 */
const waitForSensor = (brickPiInstance, sensorPort, targetValue, timeLimit = 10000) => {
    return new Promise((resolve, reject) => {
        let startTime = Date.now();
        const checkValue = () => {
            sleep(10);
            if (Date.now() - startTime > timeLimit) {
                reject(new Error('waitForSensor: timeLimit exceeded'));
                return;
            }

            brickPiInstance.get_sensor(sensorPort).then((value) => {
                if (value === targetValue) {
                    resolve();
                } else {
                    checkValue();
                }
            });
        };

        checkValue();
    });
};

const getMotor = (brickPiInstance, motorPort) => {
    return new Motor(brickPiInstance, motorPort);
};

const getSensor = (brickPiInstance, sensorPort) => {
    return new Sensor(brickPiInstance, sensorPort);
};

module.exports = {
    RESET_MOTOR_LIMIT: RESET_MOTOR_LIMIT,
    resetMotorEncoder: resetMotorEncoder,
    resetAllWhenFinished: resetAllWhenFinished,
    setMotorPosition: setMotorPosition,
    waitForSensor: waitForSensor,
    getMotor: getMotor,
    getSensor: getSensor
};