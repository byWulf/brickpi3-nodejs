const SPI = require('pi-spi');
const FIRMWARE_VERSION_REQUIRED = "1.4.x"; // Make sure the top 2 of 3 numbers match

const spi = SPI.initialize('/dev/spidev0.1');
spi.clockSpeed(500000);

class SensorError extends Error {
    constructor(message) {
        super(message);
    }
}

class IOError extends Error {
    constructor(message) {
        super(message);
    }
}

const BPSPI_MESSAGE_TYPE = {
    NONE: 0,

    GET_MANUFACTURER : 1,
    GET_NAME: 2,
    GET_HARDWARE_VERSION: 3,
    GET_FIRMWARE_VERSION: 4,
    GET_ID: 5,
    SET_LED: 6,
    GET_VOLTAGE_3V3: 7,
    GET_VOLTAGE_5V: 8,
    GET_VOLTAGE_9V: 9,
    GET_VOLTAGE_VCC: 10,
    SET_ADDRESS: 11,

    SET_SENSOR_TYPE: 12,

    GET_SENSOR_1: 13,
    GET_SENSOR_2: 14,
    GET_SENSOR_3: 15,
    GET_SENSOR_4: 16,

    I2C_TRANSACT_1: 17,
    I2C_TRANSACT_2: 18,
    I2C_TRANSACT_3: 19,
    I2C_TRANSACT_4: 20,

    SET_MOTOR_POWER: 21,

    SET_MOTOR_POSITION: 22,

    SET_MOTOR_POSITION_KP: 23,

    SET_MOTOR_POSITION_KD: 24,

    SET_MOTOR_DPS: 25,

    SET_MOTOR_DPS_KP: 26,

    SET_MOTOR_DPS_KD: 27,

    SET_MOTOR_LIMITS: 28,

    OFFSET_MOTOR_ENCODER: 29,

    GET_MOTOR_A_ENCODER: 30,
    GET_MOTOR_B_ENCODER: 31,
    GET_MOTOR_C_ENCODER: 32,
    GET_MOTOR_D_ENCODER: 33,

    GET_MOTOR_A_STATUS: 34,
    GET_MOTOR_B_STATUS: 35,
    GET_MOTOR_C_STATUS: 36,
    GET_MOTOR_D_STATUS: 37,
};

/**
 * Set the SPI address of the BrickPi3
 *
 * @param {number} address the new SPI address to use (1 to 255)
 * @param {string} id the BrickPi3's unique serial number ID (so that the address can be set while multiple BrickPi3s are stacked on a Raspberry Pi).
 * @return {Promise}
 */
function set_address(address, id) {
    return new Promise((resolve, reject) => {

        address = parseInt(address);
        if (typeof id === 'undefined') id = '';

        if (address < 1 || address > 255) {
            throw new IOError('brickpi3.set_address error: SPI address must be in the range of 1 to 255')
        }

        let id_arr;
        if (id.length !== 32) {
            if (id === '') {
                id = '00000000000000000000000000000000';
            } else {
                throw new IOError('brickpi3.set_address error: wrong serial number id length. Must be a 32-digit hex string.');
            }
        }

        // noinspection JSCheckFunctionSignatures
        id_arr = Buffer.from(id, "hex");
        if (id_arr.byteLength !== 16) {
            throw new IOError('brickpi3.set_address error: unknown serial number id problem. Make sure to use a valid 32-digit hex string serial number.');
        }

        const buffer = Buffer.from([0, BPSPI_MESSAGE_TYPE.SET_ADDRESS, address, ...id_arr]);
        spi.transfer(buffer, (e, responseBuffer) => {
            if (e) {
                reject(e);
            }

            resolve(responseBuffer);
        });
    });
}

/**
 * Do any necessary configuration, and optionally detect the BrickPi3
 *
 * Optionally specify the SPI address as something other than 1
 * Optionally disable the detection of the BrickPi3 hardware. This can be used for debugging and testing when the BrickPi3 would otherwise not pass the detection tests.
 *
 * @param address
 * @constructor
 */
function BrickPi3(address = 1) {
    this.PORT_1 = 0x01;
    this.PORT_2 = 0x02;
    this.PORT_3 = 0x04;
    this.PORT_4 = 0x08;

    this.PORT_A = 0x01;
    this.PORT_B = 0x02;
    this.PORT_C = 0x04;
    this.PORT_D = 0x08;

    this.MOTOR_FLOAT = -128;

    this.SensorType = [0, 0, 0, 0];
    this.I2CInBytes = [0, 0, 0, 0];

    this.BPSPI_MESSAGE_TYPE = BPSPI_MESSAGE_TYPE;

    this.SENSOR_TYPE = {
        NONE: 1,
        I2C: 2,
        CUSTOM: 3,

        TOUCH: 4,
        NXT_TOUCH: 5,
        EV3_TOUCH: 6,

        NXT_LIGHT_ON: 7,
        NXT_LIGHT_OFF: 8,

        NXT_COLOR_RED: 9,
        NXT_COLOR_GREEN: 10,
        NXT_COLOR_BLUE: 11,
        NXT_COLOR_FULL: 12,
        NXT_COLOR_OFF: 13,

        NXT_ULTRASONIC: 14,

        EV3_GYRO_ABS: 15,
        EV3_GYRO_DPS: 16,
        EV3_GYRO_ABS_DPS: 17,

        EV3_COLOR_REFLECTED: 18,
        EV3_COLOR_AMBIENT: 19,
        EV3_COLOR_COLOR: 20,
        EV3_COLOR_RAW_REFLECTED: 21,
        EV3_COLOR_COLOR_COMPONENTS: 22,

        EV3_ULTRASONIC_CM: 23,
        EV3_ULTRASONIC_INCHES: 24,
        EV3_ULTRASONIC_LISTEN: 25,

        EV3_INFRARED_PROXIMITY: 26,
        EV3_INFRARED_SEEK: 27,
        EV3_INFRARED_REMOTE: 28,
    };

    this.SENSOR_STATE = {
        VALID_DATA: 0,
        NOT_CONFIGURED: 1,
        CONFIGURING: 2,
        NO_DATA: 3,
        I2C_ERROR: 4
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Flags for use with SENSOR_TYPE.CUSTOM
     *
     * PIN1_9V
     *     Enable 9V out on pin 1 (for LEGO NXT Ultrasonic sensor).
     *
     * PIN5_OUT
     *     Set pin 5 state to output. Pin 5 will be set to input if this flag is not set.
     *
     * PIN5_STATE
     *     If PIN5_OUT is set, this will set the state to output high, otherwise the state will
     *     be output low. If PIN5_OUT is not set, this flag has no effect.
     *
     * PIN6_OUT
     *     Set pin 6 state to output. Pin 6 will be set to input if this flag is not set.
     *
     * PIN6_STATE
     *     If PIN6_OUT is set, this will set the state to output high, otherwise the state will
     *     be output low. If PIN6_OUT is not set, this flag has no effect.
     *
     * PIN1_ADC
     *     Enable the analog/digital converter on pin 1 (e.g. for NXT analog sensors).
     *
     * PIN6_ADC
     *     Enable the analog/digital converter on pin 6.
     *
     * @type {{PIN1_9V: number, PIN5_OUT: number, PIN5_STATE: number, PIN6_OUT: number, PIN6_STATE: number, PIN1_ADC: number, PIN6_ADC: number}}
     */
    this.SENSOR_CUSTOM = {
        PIN1_9V: 0x0002,
        PIN5_OUT: 0x0010,
        PIN5_STATE: 0x0020,
        PIN6_OUT: 0x0100,
        PIN6_STATE: 0x0200,
        PIN1_ADC: 0x1000,
        PIN6_ADC: 0x4000
    };

    this.SENSOR_I2C_SETTINGS = {
        MID_CLOCK:  0x01, // Send the clock pulse between reading and writing. Required by the NXT US sensor.
        PIN1_9V:    0x02, // 9v pullup on pin 1
        SAME:       0x04, // Keep performing the same transaction e.g. keep polling a sensor
        ALLOW_STRETCH_ACK: 3,
        ALLOW_STRETCH_ANY: 4
    };

    // noinspection JSUnusedGlobalSymbols
    this.MOTOR_STATUS_FLAG = {
        LOW_VOLTAGE_FLOAT: 0x01, //If the motors are floating due to low battery voltage
        OVERLOADED:        0x02, // If the motors aren't close to the target (applies to position control and dps speed control).
    };

    if (address < 1 || address > 255) {
        throw new IOError('error: SPI address must be in the range of 1 to 255');
    }
    this.SPI_Address = address;

    // noinspection JSUnusedGlobalSymbols
    this.detect = () => {
        return new Promise((resolve, reject) => {
            let manufacturer, board, vfw;
            this.get_manufacturer().then((value) => {
                manufacturer = value;
                return this.get_board();
            }).then((value) => {
                board = value;
                return this.get_version_firmware();
            }).then((value) => {
                vfw = value;

                if (manufacturer !== 'Dexter Industries' || board !== 'BrickPi3') {
                    reject('No SPI response');
                } else if (vfw.split('.')[0] !== FIRMWARE_VERSION_REQUIRED.split('.')[0] || vfw.split('.')[1] !== FIRMWARE_VERSION_REQUIRED.split('.')[0]) {
                    reject('BrickPi3 firmware needs to be version ' + FIRMWARE_VERSION_REQUIRED + ' but is currently version ' + vfw);
                } else {
                    resolve(true);
                }
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Conduct a SPI transaction
     *
     * @param {Array} data_out a list of bytes to send. The length of the list will determine how many bytes are transferred.
     * @return {Promise.<Buffer>}
     */
    this.spi_transfer_array = (data_out) => {
        return new Promise((resolve, reject) => {
            spi.transfer(Buffer.from(data_out), (e, responseBuffer) => {
                if (e) {
                    reject(e);
                }

                let responseArray = [...responseBuffer];
                resolve(responseArray);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Send an 8-bit-value over SPI
     *
     * @param {number<BPSPI_MESSAGE_TYPE>} MessageType
     * @param {number} Value
     * @return {Promise}
     */
    this.spi_write_8 = (MessageType, Value) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, MessageType, (Value & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read a 16-bit value over SPI
     *
     * @param {number.<BPSPI_MESSAGE_TYPE>} MessageType
     * @return {Promise.<number>}
     */
    this.spi_read_16 = (MessageType) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, MessageType, 0, 0, 0, 0]).then((reply) => {
                if (reply[3] === 0xA5) {
                    resolve(parseInt((reply[4] << 8) | reply[5]));
                } else {
                    reject('No SPI response');
                }
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Send an 16-bit-value over SPI
     *
     * @param {number<BPSPI_MESSAGE_TYPE>} MessageType
     * @param {number} Value
     * @return {Promise}
     */
    this.spi_write_16 = (MessageType, Value) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, MessageType, ((Value >> 8) & 0xFF), (Value & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Send an 24-bit-value over SPI
     *
     * @param {number<BPSPI_MESSAGE_TYPE>} MessageType
     * @param {number} Value
     * @return {Promise}
     */
    this.spi_write_24 = (MessageType, Value) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, MessageType, ((Value >> 16) & 0xFF), ((Value >> 8) & 0xFF), (Value & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read a 32-bit value over SPI
     *
     * @param {number.<BPSPI_MESSAGE_TYPE>} MessageType
     * @return {Promise.<number>}
     */
    this.spi_read_32 = (MessageType) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, MessageType, 0, 0, 0, 0, 0, 0]).then((reply) => {
                if (reply[3] === 0xA5) {
                    resolve(parseInt((reply[4] << 24) | (reply[5] << 16) | (reply[6] << 8) | reply[7]));
                } else {
                    reject('No SPI response');
                }
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Send an 32-bit-value over SPI
     *
     * @param {number<BPSPI_MESSAGE_TYPE>} MessageType
     * @param {number} Value
     * @return {Promise}
     */
    this.spi_write_32 = (MessageType, Value) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, MessageType, ((Value >> 24) & 0xFF), ((Value >> 16) & 0xFF), ((Value >> 8) & 0xFF), (Value & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read the 20 character BrickPi3 manufacturer name
     *
     * @return {Promise.<string>} BrickPi3 manufacturer name string
     */
    this.get_manufacturer = () => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.GET_MANUFACTURER, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).then((reply) => {
                if (reply[3] === 0xA5) {
                    let name = '';
                    for (let i = 4; i <= 24; i++) {
                        if (reply[i] === 0x00) break;

                        name += String.fromCharCode(reply[i]);
                    }
                    resolve(name);
                }
                reject('No SPI response');
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read the 20 character BrickPi3 board name
     *
     * @return {Promise.<string>} BrickPi3 board name string
     */
    this.get_board = () => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.GET_NAME, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).then((reply) => {
                if (reply[3] === 0xA5) {
                    let name = '';
                    for (let i = 4; i <= 24; i++) {
                        if (reply[i] === 0x00) break;

                        name += String.fromCharCode(reply[i]);
                    }
                    resolve(name);
                }
                reject('No SPI response');
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read the hardware version
     *
     * @return {Promise.<String>} hardware version
     */
    this.get_version_hardware = () => {
        return new Promise((resolve, reject) => {
            this.spi_read_32(this.BPSPI_MESSAGE_TYPE.GET_HARDWARE_VERSION).then((version) => {
                resolve(Math.round(version / 1000000) + '.' + (Math.round(version / 1000) % 1000) + '.' + (version % 1000));
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read the firmware version
     *
     * @return {Promise.<String>} firmware version
     */
    this.get_version_firmware = () => {
        return new Promise((resolve, reject) => {
            this.spi_read_32(this.BPSPI_MESSAGE_TYPE.GET_FIRMWARE_VERSION).then((version) => {
                resolve(Math.round(version / 1000000) + '.' + (Math.round(version / 1000) % 1000) + '.' + (version % 1000));
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read the 128-bit BrickPi hardware serial number
     *
     * @return {Promise.<string>} serial number as 32 char HEX formatted string
     */
    this.get_id = () => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.GET_ID, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).then((reply) => {
                if (reply[3] === 0xA5) {
                    let id = '';
                    for (let i = 4; i <= 19; i++) {
                        const char = reply[i].toString(16);
                        id += (char.length < 2 ? '0' : '') + char;
                    }
                    resolve(id);
                }
                reject('No SPI response');
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Control the onboard LED
     *
     * @param {number} value the value (in percent) to set the LED brightness to. -1 returns control of the LED to the firmware.
     * @return {Promise}
     */
    this.set_led = (value) => {
        return this.spi_write_8(this.BPSPI_MESSAGE_TYPE.SET_LED, value);
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get the 3.3v circuit voltage
     *
     * @return {Promise.<number>} 3.3v circuit voltage
     */
    this.get_voltage_3v3 = () => {
        return new Promise((resolve, reject) => {
            this.spi_read_16(this.BPSPI_MESSAGE_TYPE.GET_VOLTAGE_3V3).then((value) => {
                return value / 1000;
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get the 5v circuit voltage
     *
     * @return {Promise.<number>} 5v circuit voltage
     */
    this.get_voltage_5v = () => {
        return new Promise((resolve, reject) => {
            this.spi_read_16(this.BPSPI_MESSAGE_TYPE.GET_VOLTAGE_5V).then((value) => {
                return value / 1000;
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get the 9v circuit voltage
     *
     * @return {Promise.<number>} 9v circuit voltage
     */
    this.get_voltage_9v = () => {
        return new Promise((resolve, reject) => {
            this.spi_read_16(this.BPSPI_MESSAGE_TYPE.GET_VOLTAGE_9V).then((value) => {
                return value / 1000;
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get the battery voltage
     *
     * @return {Promise.<number>} battery voltage
     */
    this.get_voltage_battery = () => {
        return new Promise((resolve, reject) => {
            this.spi_read_16(this.BPSPI_MESSAGE_TYPE.GET_VOLTAGE_VCC).then((value) => {
                return value / 1000;
            }).catch((err) => {
                reject(err);
            });
        });
    };

    this.wait_until_configuration_is_finished = (args, configurationTimeout) => {

      configurationTimeout = configurationTimeout || 3000;

        return new Promise(async (resolve) => {

            let run = true;

            const timeout = setTimeout( () => {
                const msg = `timeout reached: sensor configuration not successfully within ${configurationTimeout}ms`;
                run = false;
                throw new Error(msg);
            }, configurationTimeout);

            while(run) {
                const reply = await this.spi_transfer_array(args);
                if(reply[5] === this.SENSOR_STATE.VALID_DATA){
                    clearTimeout(timeout);
                    return resolve(reply);
                }
            }

        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the sensor type.
     *
     * params is used for the following sensor types:
     *     CUSTOM -- a 16-bit integer used to configure the hardware.
     *     I2C -- a list of settings:
     *         params[0] -- Settings/flags
     *         params[1] -- target Speed in microseconds (0-255). Realistically the speed will vary.
     *         if SENSOR_I2C_SETTINGS_SAME flag set in I2C Settings:
     *             params[2] -- Delay in microseconds between transactions.
     *             params[3] -- Address
     *             params[4] -- List of bytes to write
     *             params[5] -- Number of bytes to read
     *
     * @param {number} port The sensor port(s). PORT_1, PORT_2, PORT_3, and/or PORT_4.
     * @param {number} type The sensor type
     * @param {*} params the parameters needed for some sensor types.
     * @return {Promise}
     */
    this.set_sensor_type = (port, type, params = 0) => {
        return new Promise((resolve, reject) => {
            for (let p = 0; p < 4; p++) {
                // noinspection JSBitwiseOperatorUsage
                if (port & (1 << p)) {
                    this.SensorType[p] = type;
                }
            }

            let outArray;
            if (type === this.SENSOR_TYPE.CUSTOM) {
                outArray = [this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_SENSOR_TYPE, parseInt(port), type, ((params[0] >> 8) & 0xFF), (params[0] & 0xFF)];
            } else if (type === this.SENSOR_TYPE.I2C) {
                if (params instanceof Array && params.length >= 2) {
                    outArray = [this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_SENSOR_TYPE, parseInt(port), type, params[0], params[1]];
                    if (params[0] & this.SENSOR_I2C_SETTINGS.SAME && params.length >= 6) {
                        outArray.push((params[2] >> 24) & 0xFF);
                        outArray.push((params[2] >> 16) & 0xFF);
                        outArray.push((params[2] >> 8) & 0xFF) ;
                        outArray.push(params[2] & 0xFF);
                        outArray.push(params[3] & 0xFF);
                        outArray.push(params[5] & 0xFF);
                        for (let p = 0; p < 4; p++) {
                            // noinspection JSBitwiseOperatorUsage
                            if (port & (1 << p)) {
                                this.I2CInBytes[p] = params[5] & 0xFF;
                            }
                        }
                        outArray.push(params[4].length);
                        for (let i = 0; i < params[4].length; i++) {
                            outArray.push(params[4][i]);
                        }
                    }
                }
            } else {
                outArray = [this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_SENSOR_TYPE, parseInt(port), type];
            }

            this.spi_transfer_array(outArray).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Conduct an I2C transaction
     *
     * @param {number} port The sensor port (one at a time). PORT_1, PORT_2, PORT_3, or PORT_4.
     * @param {number} Address The I2C address for the device. Bits 1-7, not 0-6.
     * @param {Array.<number>} OutArray A list of bytes to write to the device
     * @param {number} InBytes The number of bytes to read from the device
     *
     * @return {Promise}
     */
    this.transact_i2c = (port, Address, OutArray, InBytes) => {
        return new Promise((resolve, reject) => {
            let message_type, port_index;
            if (port === this.PORT_1) {
                message_type = this.BPSPI_MESSAGE_TYPE.I2C_TRANSACT_1;
                port_index = 0;
            } else if (port === this.PORT_2) {
                message_type = this.BPSPI_MESSAGE_TYPE.I2C_TRANSACT_2;
                port_index = 1;
            } else if (port === this.PORT_3) {
                message_type = this.BPSPI_MESSAGE_TYPE.I2C_TRANSACT_3;
                port_index = 2;
            } else if (port === this.PORT_4) {
                message_type = this.BPSPI_MESSAGE_TYPE.I2C_TRANSACT_4;
                port_index = 3;
            } else {
                throw new IOError('transact_i2c error. Must be one sensor port at a time. PORT_1, PORT_2, PORT_3, or PORT_4.');
            }

            if (this.SensorType[port_index] !== this.SENSOR_TYPE.I2C) {
                reject();
                return;
            }

            let outArray = [this.SPI_Address, message_type, Address, InBytes];
            this.I2CInBytes[port_index] = InBytes;
            let OutBytes = OutArray.length;
            if (OutBytes > 16) {
                outArray.push(16);
                for (let i = 0; i < 16; i++) {
                    outArray.push(OutArray[i]);
                }
            } else {
                outArray.push(OutBytes);
                for (let i = 0; i < OutBytes; i++) {
                    outArray.push(OutArray[i]);
                }
            }
            this.spi_transfer_array(outArray).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read a sensor value
     *
     * Returns the value(s) for the specified sensor.
     *     The following sensor types each return a single value:
     *         NONE ----------------------- 0
     *         TOUCH ---------------------- 0 or 1 (released or pressed)
     *         NXT_TOUCH ------------------ 0 or 1 (released or pressed)
     *         EV3_TOUCH ------------------ 0 or 1 (released or pressed)
     *         NXT_ULTRASONIC ------------- distance in CM
     *         NXT_LIGHT_ON  -------------- reflected light
     *         NXT_LIGHT_OFF -------------- ambient light
     *         NXT_COLOR_RED -------------- red reflected light
     *         NXT_COLOR_GREEN ------------ green reflected light
     *         NXT_COLOR_BLUE ------------- blue reflected light
     *         NXT_COLOR_OFF -------------- ambient light
     *         EV3_GYRO_ABS --------------- absolute rotation position in degrees
     *         EV3_GYRO_DPS --------------- rotation rate in degrees per second
     *         EV3_COLOR_REFLECTED -------- red reflected light
     *         EV3_COLOR_AMBIENT ---------- ambient light
     *         EV3_COLOR_COLOR ------------ detected color
     *         EV3_ULTRASONIC_CM ---------- distance in CM
     *         EV3_ULTRASONIC_INCHES ------ distance in inches
     *         EV3_ULTRASONIC_LISTEN ------ 0 or 1 (no other ultrasonic sensors or another ultrasonic sensor detected)
     *         EV3_INFRARED_PROXIMITY ----- distance 0-100%
     *
     *     The following sensor types each return a list of values
     *         CUSTOM --------------------- Pin 1 ADC (5v scale from 0 to 4095), Pin 6 ADC (3.3v scale from 0 to 4095), Pin 5 digital, Pin 6 digital
     *         I2C ------------------------ the I2C bytes read
     *         NXT_COLOR_FULL ------------- detected color, red light reflected, green light reflected, blue light reflected, ambient light
     *         EV3_GYRO_ABS_DPS ----------- absolute rotation position in degrees, rotation rate in degrees per second
     *         EV3_COLOR_RAW_REFLECTED ---- red reflected light, unknown value (maybe a raw ambient value?)
     *         EV3_COLOR_COLOR_COMPONENTS - red reflected light, green reflected light, blue reflected light, unknown value (maybe a raw value?)
     *         EV3_INFRARED_SEEK ---------- a list for each of the four channels. For each channel heading (-25 to 25), distance (-128 or 0 to 100)
     *         EV3_INFRARED_REMOTE -------- a list for each of the four channels. For each channel red up, red down, blue up, blue down, boadcast
     *
     * @param {number} port The sensor port (one at a time). PORT_1, PORT_2, PORT_3, or PORT_4.
     * @return {Promise.<number|Array.<number>>}
     */
    this.get_sensor = (port, timeLimit) => {
        return new Promise((resolve, reject) => {
            let message_type, port_index;
            if (port === this.PORT_1) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_SENSOR_1;
                port_index = 0;
            } else if (port === this.PORT_2) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_SENSOR_2;
                port_index = 1;
            } else if (port === this.PORT_3) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_SENSOR_3;
                port_index = 2;
            } else if (port === this.PORT_4) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_SENSOR_4;
                port_index = 3;
            } else {
                throw new IOError('get_sensor error. Must be one sensor port at a time. PORT_1, PORT_2, PORT_3, or PORT_4.');
            }

            if (this.SensorType[port_index] === this.SENSOR_TYPE.CUSTOM) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            resolve([(((reply[8] & 0x0F) << 8) | reply[9]), (((reply[8] >> 4) & 0x0F) | (reply[7] << 4)), (reply[6] & 0x01), ((reply[6] >> 1) & 0x01)]);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if (this.SensorType[port_index] === this.SENSOR_TYPE.I2C) {
                let outArray = [this.SPI_Address, message_type, 0, 0, 0, 0];
                for (let i = 0; i < this.I2CInBytes[port_index]; i++) {
                    outArray.push(0);
                }
                this.wait_until_configuration_is_finished(outArray, timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA && reply.length - 6 === this.I2CInBytes[port_index]) {
                            let values = [];
                            for (let i = 6; i < reply.length; i++) {
                                values.push(reply[i]);
                            }
                            resolve(values);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if ([
                this.SENSOR_TYPE.TOUCH,
                this.SENSOR_TYPE.NXT_TOUCH,
                this.SENSOR_TYPE.EV3_TOUCH,
                this.SENSOR_TYPE.NXT_ULTRASONIC,
                this.SENSOR_TYPE.EV3_COLOR_REFLECTED,
                this.SENSOR_TYPE.EV3_COLOR_AMBIENT,
                this.SENSOR_TYPE.EV3_COLOR_COLOR,
                this.SENSOR_TYPE.EV3_ULTRASONIC_LISTEN,
                this.SENSOR_TYPE.EV3_INFRARED_PROXIMITY
            ].indexOf(this.SensorType[port_index]) > -1) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if ((reply[4] === this.SensorType[port_index] || (this.SensorType[port_index] === this.SENSOR_TYPE.TOUCH && (reply[4] === this.SENSOR_TYPE.NXT_TOUCH || reply[4] === this.SENSOR_TYPE.EV3_TOUCH))) && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            resolve(reply[6]);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if (this.SensorType[port_index] === this.SENSOR_TYPE.NXT_COLOR_FULL) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            resolve([reply[6], ((reply[7] << 2) | ((reply[11] >> 6) & 0x03)), ((reply[8] << 2) | ((reply[11] >> 4) & 0x03)), ((reply[9] << 2) | ((reply[11] >> 2) & 0x03)), ((reply[10] << 2) | (reply[11] & 0x03))]);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if ([
                this.SENSOR_TYPE.NXT_LIGHT_ON,
                this.SENSOR_TYPE.NXT_LIGHT_OFF,
                this.SENSOR_TYPE.NXT_COLOR_RED,
                this.SENSOR_TYPE.NXT_COLOR_GREEN,
                this.SENSOR_TYPE.NXT_COLOR_BLUE,
                this.SENSOR_TYPE.NXT_COLOR_OFF,
                this.SENSOR_TYPE.EV3_GYRO_ABS,
                this.SENSOR_TYPE.EV3_GYRO_DPS,
                this.SENSOR_TYPE.EV3_ULTRASONIC_CM,
                this.SENSOR_TYPE.EV3_ULTRASONIC_INCHES
            ].indexOf(this.SensorType[port_index]) > -1) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            let value = parseInt((reply[6] << 8) | reply[7]);

                            if (this.SensorType[port_index] === this.SENSOR_TYPE.EV3_ULTRASONIC_CM || this.SensorType[port_index] === this.SENSOR_TYPE.EV3_ULTRASONIC_INCHES) {
                                value = value / 10;
                            }

                            resolve(value);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if ([
                this.SENSOR_TYPE.EV3_COLOR_RAW_REFLECTED,
                this.SENSOR_TYPE.EV3_GYRO_ABS_DPS
            ].indexOf(this.SensorType[port_index]) > -1) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            resolve([parseInt((reply[6] << 8) | reply[7]), parseInt((reply[8] << 8) | reply[9])]);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if (this.SensorType[port_index] === this.SENSOR_TYPE.EV3_COLOR_COLOR_COMPONENTS) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            resolve([parseInt((reply[6] << 8) | reply[7]), parseInt((reply[8] << 8) | reply[9]), parseInt((reply[10] << 8) | reply[11]), parseInt((reply[12] << 8) | reply[13])]);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if (this.SensorType[port_index] === this.SENSOR_TYPE.EV3_INFRARED_SEEK) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            resolve([[parseInt(reply[6]), parseInt(reply[7])], [parseInt(reply[8]), parseInt(reply[9])], [parseInt(reply[10]), parseInt(reply[11])], [parseInt(reply[12]), parseInt(reply[13])]]);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else if (this.SensorType[port_index] === this.SENSOR_TYPE.EV3_INFRARED_REMOTE) {
                this.wait_until_configuration_is_finished([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0, 0, 0], timeLimit).then((reply) => {
                    if (reply[3] === 0xA5) {
                        if (reply[4] === this.SensorType[port_index] && reply[5] === this.SENSOR_STATE.VALID_DATA) {
                            let results = [0, 0, 0, 0];
                            for (let r = 0; r < results.length; r++) {
                                let value = parseInt(reply[6 + r]);
                                if (value === 1) {
                                    results[r] = [1, 0, 0, 0, 0];
                                } else if (value === 2) {
                                    results[r] = [0, 1, 0, 0, 0];
                                } else if (value === 3) {
                                    results[r] = [0, 0, 1, 0, 0];
                                } else if (value === 4) {
                                    results[r] = [0, 0, 0, 1, 0];
                                } else if (value === 5) {
                                    results[r] = [1, 0, 1, 0, 0];
                                } else if (value === 6) {
                                    results[r] = [1, 0, 0, 1, 0];
                                } else if (value === 7) {
                                    results[r] = [0, 1, 1, 0, 0];
                                } else if (value === 8) {
                                    results[r] = [0, 1, 0, 1, 0];
                                } else if (value === 9) {
                                    results[r] = [0, 0, 0, 0, 1];
                                } else if (value === 10) {
                                    results[r] = [1, 1, 0, 0, 0];
                                } else if (value === 11) {
                                    results[r] = [0, 0, 1, 1, 0];
                                } else {
                                    results[r] = [0, 0, 0, 0, 0];
                                }
                            }

                            resolve(results);
                        } else {
                            throw new SensorError('get_sensor error: Invalid sensor data');
                        }
                    } else {
                        throw new IOError('get_sensor error: No SPI response');
                    }
                }).catch((err) => {
                    reject(err);
                });
            } else {
                throw new IOError('get_sensor error: Sensor not configured or not supported.');
            }
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the motor power in percent
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @param {number} power The power from -100 to 100, or -128 for float
     * @return {Promise}
     */
    this.set_motor_power = (port, power) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_MOTOR_POWER, parseInt(port), parseInt(power)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the motor target position in degrees
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @param {number} position The target position
     * @return {Promise}
     */
    this.set_motor_position = (port, position) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_MOTOR_POSITION, parseInt(port), ((position >> 24) & 0xFF), ((position >> 16) & 0xFF), ((position >> 8) & 0xFF), (position & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the motor target position KP constant
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @param {number} kp The KP constant (default 25)
     * @return {Promise}
     */
    this.set_motor_position_kp = (port, kp = 25) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_MOTOR_POSITION_KP, parseInt(port), parseInt(kp)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the motor target position KD constant
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @param {number} kd The KD constant (default 70)
     * @return {Promise}
     */
    this.set_motor_position_kd = (port, kd = 70) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_MOTOR_POSITION_KD, parseInt(port), parseInt(kd)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the motor target speed in degrees per second
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @param {number} dps The target speed in degrees per second
     * @return {Promise}
     */
    this.set_motor_dps = (port, dps) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_MOTOR_DPS, parseInt(port), ((dps >> 8) & 0xFF), (dps & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the motor speed limit
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @param {number} power The power limit in percent (0 to 100), with 0 being no limit (100)
     * @param {number} dps The speed limit in degrees per second, with 0 being no limit
     * @return {Promise}
     */
    this.set_motor_limits = (port, power = 0, dps = 0) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.SET_MOTOR_LIMITS, parseInt(port), parseInt(power), ((dps >> 8) & 0xFF), (dps & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read a motor status
     *
     * Returns a list:
     *      flags -- 8-bits of bit-flags that indicate motor status:
     *          bit 0 -- LOW_VOLTAGE_FLOAT - The motors are automatically disabled because the battery voltage is too low
     *          bit 1 -- OVERLOADED - The motors aren't close to the target (applies to position control and dps speed control).
     *      power -- the raw PWM power in percent (-100 to 100)
     *      encoder -- The encoder position
     *      dps -- The current speed in Degrees Per Second
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @return {Promise.<Array>}
     */
    this.get_motor_status = (port) => {
        return new Promise((resolve, reject) => {
            let message_type;
            if (port === this.PORT_A) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_A_STATUS;
            } else if (port === this.PORT_B) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_B_STATUS;
            } else if (port === this.PORT_C) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_C_STATUS;
            } else if (port === this.PORT_D) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_D_STATUS;
            } else {
                throw new IOError('get_motor_status error. Must be one motor port at a time. PORT_A, PORT_B, PORT_C, or PORT_D.');
            }

            this.spi_transfer_array([this.SPI_Address, message_type, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).then((reply) => {
                if (reply[3] === 0xA5) {
                    let speed = parseInt(reply[5]);
                    let encoder = parseInt((reply[6] << 24) | (reply[7] << 16) | (reply[8] << 8) | reply[9]);
                    let dps = parseInt((reply[10] << 8) | reply[11]);

                    resolve([reply[4], speed, encoder, dps]);
                } else {
                    throw new IOError('No SPI response');
                }
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Offset a motor encoder
     * Zero the encoder by offsetting it by the current position
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @param {number} position The encoder offset
     * @return {Promise}
     */
    this.offset_motor_encoder = (port, position) => {
        return new Promise((resolve, reject) => {
            this.spi_transfer_array([this.SPI_Address, this.BPSPI_MESSAGE_TYPE.OFFSET_MOTOR_ENCODER, parseInt(port), ((position >> 24) & 0xFF), ((position >> 16) & 0xFF), ((position >> 8) & 0xFF), (position & 0xFF)]).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Read a motor encoder in degrees
     *
     * Returns the encoder position in degrees
     *
     * @param {number} port The Motor port(s). PORT_A, PORT_B, PORT_C, and/or PORT_D.
     * @return {Promise.<number>}
     */
    this.get_motor_encoder = (port) => {
        return new Promise((resolve, reject) => {
            let message_type;
            if (port === this.PORT_A) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_A_ENCODER;
            } else if (port === this.PORT_B) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_B_ENCODER;
            } else if (port === this.PORT_C) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_C_ENCODER;
            } else if (port === this.PORT_D) {
                message_type = this.BPSPI_MESSAGE_TYPE.GET_MOTOR_D_ENCODER;
            } else {
                throw new IOError('get_motor_encoder error. Must be one motor port at a time. PORT_A, PORT_B, PORT_C, or PORT_D.');
            }

            this.spi_read_32(message_type).then((value) => {
                resolve(value);
            }).catch((err) => {
                reject(err);
            });
        });
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Reset the BrickPi. Set all the sensors' type to NONE, set the motors to float, and motors' limits and constants to default, and return control of the LED to the firmware.
     */
    this.reset_all = () => {
        return new Promise((resolve, reject) => {
            this.set_sensor_type(this.PORT_1 + this.PORT_2 + this.PORT_3 + this.PORT_4, this.SENSOR_TYPE.NONE).then(() => {
                return this.set_motor_power(this.PORT_A + this.PORT_B + this.PORT_C + this.PORT_D, this.MOTOR_FLOAT);
            }).then(() => {
                return this.set_motor_limits(this.PORT_A + this.PORT_B + this.PORT_C + this.PORT_D);
            }).then(() => {
                return this.set_motor_position_kp(this.PORT_A + this.PORT_B + this.PORT_C + this.PORT_D);
            }).then(() => {
                return this.set_motor_position_kd(this.PORT_A + this.PORT_B + this.PORT_C + this.PORT_D);
            }).then(() => {
                return this.set_led(-1);
            }).then(() => {
                resolve();
            }).catch((err) => {
                reject(err);
            });
        });
    };
}

module.exports = {
    set_address: set_address,
    BrickPi3: BrickPi3,
    utils: require('./utils')
};
