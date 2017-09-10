# BrickPi3 package for nodejs
With this package you can control your BrickPi3 with nodejs. 

This package has the same interface as the python library and was copied 1:1 with sligth language adjustments (bitwise operators are a bit different and the return values are promises). So just look at their examples (https://github.com/DexterInd/BrickPi3/tree/master/Software/Python/Examples) to see, how you can archive different tasks. Just remember, that you get promises back from most of the methods.

If you find any bugs, please open an issue or submit a pull request. I couldn't test everything, because I only have ev3 large motors. So I need your help to know if everything else works :)

## Install
```bash
npm install --save brickpi3
```

## Usage

```javascript
const brickpi3 = require('brickpi3');

let BP = new brickpi3.BrickPi3();

//Make sure to stop and free all motors and sensors when the programm exits
brickpi3.utils.resetAllWhenFinished(BP);

//Resetting offset position of motor A to 0
BP.get_motor_encoder(BP.PORT_A).then((encoder) => {
    return BP.offset_motor_encoder(BP.PORT_A, encoder);
}).then(() => {
    return BP.set_motor_power(BP.PORT_A, 10);
}).catch((err) => {
    console.log(err);
});
```
    
### Utils
When you need to find the extreme offsets of the motor (f.e. an arm can only get from point a to point b but not beyond), there is a helper function available like explained in this video: https://youtu.be/d0bghBZZMUg?t=1m35s

```javascript
const brickpi3 = require('brickpi3');

let BP = new brickpi3.BrickPi3();
brickpi3.utils.resetAllWhenFinished(BP);

brickpi3.utils.resetMotorEncoder(BP, BP.PORT_A, brickpi3.utils.RESET_MOTOR_LIMIT.MIDPOINT_LIMIT).then(() => {
    console.log("Motor should now be in the middle of its two extremes");
}); 
```
    
### BrickPi3 Stacking
If you have multiple brickPi3's, you can stack them and control even more motors/sensors with a single raspberry pi.

First attach each brickPi separatly and execute the following script. You need to write down the id of each brickPi.
    
```javascript
const brickpi3 = require('brickpi3');

let BP = new brickpi3.BrickPi3();
BP.get_id().then((id) => {
    console.log(id);
});
```
    
Then you can set the address for each of your brickPi's in the initializing part and access the four sensors and motors with each brickPi object instance.

```javascript
const brickpi3 = require('brickpi3');

let BP1, BP2;
brickpi3.set_address(1, 'A778704A514D355934202020FF110722').then(() => {
    return brickpi3.set_address(2, 'DF9E6AC3514D355934202020FF112718');
}).then(() => {
    BP1 = new brickpi3.BrickPi3(1);
    BP2 = new brickpi3.BrickPi3(2);
    
    brickpi3.utils.resetAllWhenFinished(BP1);
    brickpi3.utils.resetAllWhenFinished(BP2);
    
//Reset Motor A offset of your first brickPi
}).then(() => {
    return BP1.get_motor_encoder(BP1.PORT_A);
}).then((encoder) => {
    return BP1.offset_motor_encoder(BP1.PORT_A, encoder);
    
//Reset Motor A offset of your second brickPi
}).then(() => {
    return BP2.get_motor_encoder(BP2.PORT_A);
}).then((encoder) => {
    return BP2.offset_motor_encoder(BP2.PORT_A, encoder);
    
//Let the motor A of your first brickPi turn constantly
}).then(() => {
    return BP1.set_motor_power(BP1.PORT_A, 10);
    
//Let the motor A of your second brickPi rotate by 45° every two seconds.
}).then(() => {
    target = 0;
    const moveOn = () => {
        target = target + 45;
        BP2.set_motor_position(BP2.PORT_A, target);

        setTimeout(moveOn, 2000);
    };
    moveOn();
    
}).catch((err) => {
    console.log(err);
});
```

## Special thanks
Thanks to Sumit Kumar (http://twitter.com/tweetsofsumit) for providing an example on how to communicate with the brickPi3 in nodejs on his repository.