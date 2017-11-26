const sleep = require('es7-sleep');

class Motor {
    constructor(BP, port) {
        this.BP = BP;
        this.port = port;
    }

    /**
     * Set the motor power in percent
     *
     * @param {number} power The power from -100 to 100, or -128 for float
     * @param {function<Promise>} breakFunction
     * @return {Promise}
     */
    async setPower(power, breakFunction = null) {
        await this.BP.set_motor_power(this.port, power);

        if (typeof breakFunction === 'function') {
            while (!await breakFunction()) {
                await sleep(20);
            }

            await this.BP.set_motor_power(this.port, 0);
        }
    }
    /**
     * Set the motor target position in degrees
     *
     * @param {number} position The target position
     * @param {number} power If given, sets the power limit of the motor
     * @return {Promise} Resolves, when the target position is reached
     */
    async setPosition(position, power = 0) {
        if (power > 0) {
            await this.BP.set_motor_limits(this.port, power);
        }
        await this.BP.set_motor_position(this.port, position);

        let lastEncoder = null;
        while (true) {
            await sleep(20);

            let encoder = await this.BP.get_motor_encoder(this.port);

            if (lastEncoder !== null && lastEncoder === encoder) {
                return encoder;
            }
            lastEncoder = encoder;
        }
    }

    /**
     * Set the motor target position KP constant
     *
     * @param {number} kp The KP constant (default 25)
     * @return {Promise}
     */
    setPositionKp(kp = 25) {
        return this.BP.set_motor_position_kp(this.port, kp);
    }

    /**
     * Set the motor target position KD constant
     *
     * @param {number} kd The KD constant (default 70)
     * @return {Promise}
     */
    setPositionKd(kd = 70) {
        return this.BP.set_motor_position_kd(this.port, kd);
    }

    /**
     * Set the motor target speed in degrees per second
     *
     * @param {number} dps The target speed in degrees per second
     * @return {Promise}
     */
    setDps(dps) {
        return this.BP.set_motor_dps(this.port, dps);
    }

    /**
     * Set the motor speed limit
     *
     * @param {number} power The power limit in percent (0 to 100), with 0 being no limit (100)
     * @param {number} dps The speed limit in degrees per second, with 0 being no limit
     * @return {Promise}
     */
    setLimits(power = 0, dps = 0) {
        return this.BP.set_motor_limits(this.port, power, dps);
    }

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
     * @return {Promise.<Array>}
     */
    getStatus() {
        return this.BP.get_motor_status(this.port);
    }

    /**
     * Offset a motor encoder
     * Zero the encoder by offsetting it by the current position
     *
     * @param {number} position The encoder offset
     * @return {Promise}
     */
    setEncoder(position) {
        return this.BP.offset_motor_encoder(this.port, position);
    }

    /**
     * Read a motor encoder in degrees
     *
     * Returns the encoder position in degrees
     *
     * @return {Promise.<number>}
     */
    getEncoder() {
        return this.BP.get_motor_encoder(this.port);
    }

    /**
     * Resets the encoder to 0 on its current position
     *
     * @return {Promise}
     */
    async resetEncoder() {
        return this.setEncoder(await this.getEncoder());
    }
}

module.exports = Motor;