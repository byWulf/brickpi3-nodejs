# BrickPi3 packae for nodejs
With this package you can control your BrickPi3 with nodejs. 

This package has the same interface as the python library and was copied 1:1 with sligth language adjustments (bitwise operators are a bit different ans the return values are promises). So just look at their examples (https://github.com/DexterInd/BrickPi3/tree/master/Software/Python/Examples) to see, how you can archive different tasks. Just remember, that you get promises back from most of the methods.

If you find any bugs, please open an issue or submit a pull request. I couldn't test everything, because I only have ev3 large motors. So I need your help to know if everything else works :)

## Install

    npm install --save brickpi3
    
## Usage

    const brickpi3 = require('brickpi3');
    
    BP = new brickpi3.BrickPi3();
    
    //Resetting offset position of motor A to 0
    BP.get_motor_encoder(BP.PORT_A).then((encoder) => {
        return BP.offset_motor_encoder(BP.PORT_A, encoder);
    }).then(() => {
        return BP.set_motor_power(BP.PORT_A, 10);
    }).catch((err) => {
        console.log(err);
    });
    
### BrickPi3 Stacking
If you have multiple brickPi3's, you can stack them and control even more motors/sensors with a single raspberry pi.

First attach each brickPi separatly and execute the following script. You need to write down the id of each brickPi.
    
    const brickpi3 = require('brickpi3');
    
    let BP = new brickpi3.BrickPi3();
    BP.get_id().then((id) => {
        console.log(id);
    });
    
Then you can set the address for each of your brickPi's in the initializing part and access the four sensors and motors with each brickPi object instance.

    const brickpi3 = require('brickpi3');
    
    let BP1, BP2;
    brickpi3.set_address(1, 'A778704A514D355934202020FF110722').then(() => {
        return brickpi3.set_address(2, 'DF9E6AC3514D355934202020FF112718');
    }).then(() => {
        BP1 = new brickpi3.BrickPi3(1);
        BP2 = new brickpi3.BrickPi3(2);
        
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

## Special thanks
Thanks to Sumit Kumar (http://twitter.com/tweetsofsumit) for providing an example on how to communicate with the brickPi3 in nodejs on his repository.