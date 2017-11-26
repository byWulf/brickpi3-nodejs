const sleep = require('es7-sleep');

class Sensor {
    constructor(BP, port) {
        this.BP = BP;
        this.port = port;
    }

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
     * @param {number} type The sensor type
     * @param {*} params the parameters needed for some sensor types.
     * @return {Promise}
     */
    async setType(type, params = 0) {
        return this.BP.set_sensor_type(this.port, type, params);
    }

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
     * @return {Promise.<number|Array.<number>>}
     */
    async getValue() {
        return this.BP.get_sensor(this.port);
    }

    /**
     * Waits for a simple sensor to become a given value. Works with all sensors, which return a scalar value (and not an
     * array). If the sensor returns the value, the promise is resolved.
     *
     * @param {number} value
     * @return {Promise}
     */
    async waitFor(value) {
        while (true) {
            await sleep(10);

            let currentValue = await this.BP.get_sensor(this.port);

            if (currentValue === value) {
                return currentValue;
            }
        }
    }
}

module.exports = Sensor;