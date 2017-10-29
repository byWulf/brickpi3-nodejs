const assert = require('assert');
const utils = require(__dirname + '/../utils');

describe('Gear', function() {
    const Gear = utils.Gear;
    describe('getFactor', function() {
        it ('should return 1 when 5 teeth connected to 5 teeth', function() {
            let gear = new Gear(5).connect(5);
            assert.equal(gear.getFactor(), 1);
        });
        it ('should return 1 when 5 teeth connected to 20 teeth', function() {
            let gear = new Gear(5).connect(20);
            assert.equal(gear.getFactor(), 1);
        });
        it ('should return 1 when 20 teeth connected to 5 teeth', function() {
            let gear = new Gear(20).connect(5);
            assert.equal(gear.getFactor(), 1);
        });
        it ('should return 1 when 20 teeth connected to 5 teeth connected to 20 teeth', function() {
            let gear = new Gear(20).connect(5).connect(20);
            assert.equal(gear.getFactor(), 1);
        });

        it ('should return -1 when 5 teeth drive 5 teeth', function() {
            let gear = new Gear(5).drive(5);
            assert.equal(gear.getFactor(), -1);
        });
        it ('should return -0.25 when 5 teeth drive 20 teeth', function() {
            let gear = new Gear(5).drive(20);
            assert.equal(gear.getFactor(), -0.25);
        });
        it ('should return -4 when 20 teeth drive 5 teeth', function() {
            let gear = new Gear(20).drive(5);
            assert.equal(gear.getFactor(), -4);
        });
        it ('should return 4 when 20 teeth drive 5 teeth driving 5 teeth', function() {
            let gear = new Gear(20).drive(5).drive(5);
            assert.equal(gear.getFactor(), 4);
        });

        it('should return 16 when 5 teeth connected to 20 teeth joined with 5 teeth connected to 20 teeth joined with 5 teeth', function() {
            let gear = new Gear(5).connect(20).drive(5).connect(20).drive(5);
            assert.equal(gear.getFactor(), 16);
        });
    })
});