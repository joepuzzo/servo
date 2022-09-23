import {EventEmitter} from 'events';
import five from "johnny-five";

// For debugging
import { Debug } from './debug.js';
const logger = Debug('servo:motor' + '\t');

// Constatnts
const ENABLED = true;
const DISABLED = !ENABLED;
const FORWARDS = 1;
const BACKWARDS = -1;

/** 
 * Motor 
 */
export class Motor extends EventEmitter   {

  /* ------------------------------ */
  constructor({ id, stepper, board, stepPin, dirPin, limitPin, encoderPinA, encoderPinB, limPos, limNeg, stepDeg, enablePin, limitDir = FORWARDS, invertEnable = true, limitAdj = 0, maxSpeed, maxAccel }) {

    logger(`creating motor ${id}`);

    // Becasuse we are event emitter
    super();

    // Define parameters
    this.id = id;                               // id of the motor
    this.stepper = stepper;                     // stepper id for this motor
    this.board = board;                         // the io board ( arduino )
    this.stepPin = stepPin;                     // the step pin on the arduino
    this.dirPin = dirPin;                       // the dir pin on the arduino
    this.limitPin = limitPin;                   // the limit switch pin on the arduino
    this.encoderPinA = encoderPinA;             // the first encoder pin on the arduino
    this.encoderPinB = encoderPinB;             // the second encoder pin on the arduino
    this.limitDir = limitDir;                   // the direction to get to the limit switch
    this.limPos = limPos;                       // the limit in posative direction in degrees
    this.limNeg = limNeg;                       // the limit in negative direction in degrees
    this.stepDeg = stepDeg;                     // motor steps per degree
    this.axisLimit = limPos + limNeg;           // define total axis travel
    this.stepLimit = this.axisLimit * stepDeg;  // steps full movement of axis
    this.enabled = false;                       // will enable/disable motor
    this.error = undefined;                     // current error state for this motor
    this.robotStopped = false;                  // the motor might stop things but the robot might also have stop set
    this.homing = false;                        // if motor is process of homing
    this.home = false;                          // if the motor is currently home
    this.homed = false;                         // if the motor has been homed
    this.ready = false;                         // if motor is ready
    this.moving = false;                        // if motor is in motion
    this.encoderPosition = 0;                   // encoder position
    this.stepPosition = 0;                      // step position
    this.invertEnable = invertEnable;           // If we want to invert the enable pin
    this.enablePin = enablePin                  // what pin is used to enable this
    this.maxSpeed = maxSpeed ?? 1500;           // the max speed for this motor in steps/s
    this.maxAccel = maxAccel ?? 900;           // the max acceleration for this motor in steps/s
    this.zeroStep = limitDir === FORWARDS ? ( this.limPos + limitAdj )* stepDeg * -1 : ( this.limNeg + limitAdj ) * stepDeg;      // steps from 0 --- to ---> axis zero ( 0 is where limit switch is ) 
  }

  /* ------------------------------ */
  start() {

    logger(`starting motor ${this.id}`);

    // Configure stepper motor
    this.board.io.accelStepperConfig({
      deviceNum: this.stepper,
      type: this.board.io.STEPPER.TYPE.DRIVER,
      stepPin: this.stepPin,
      directionPin: this.dirPin,
      enablePin: this.enablePin, // TODO define this to be actual enable pin we end up chosing
      invertPins:  this.invertEnable ? [this.enablePin] : undefined
    });

    // Enable stepper motor
    this.enabled = true;
    this.board.io.accelStepperEnable(this.stepper, ENABLED);

    // Configure limit switch
    this.limit =  new five.Switch({
      pin: this.limitPin,
      type: "NC"
    });

    // Configure encoder
    this.board.io.encoderAttach({
      encoderNum: this.stepper,
      encoderPin1: this.encoderPinA,
      encoderPin2: this.encoderPinB,
    });

    // For now we dont have each motor report
    // instead, the robot will poll on a fixed interval so we dont flood events to ui
    this.board.io.encoderEnableReporting(false)

    // Subscribe to encoder events
    this.board.io.on(`encoder-position-${this.stepper}`, (event)=>{
      // Example: event = { direction: 1, position: 280, number: 0 };
      this.encoderPosition = event.position;
      // update event Note: I have this turned off for now because robot polling is better
      //this.emit('encoder');
    });

    // Safety
    this.limit.on('close',()=>{

      // If we are not homing stop the motor and error
      if( !this.homing && !this.home ){
        logger(`Error: limit hit for motor ${this.id}`);
        this.error = 'LIMIT';
        this.homing = false;
        this.enabled = false;
        this.moving = false;

        // Disable the stepper because this is an error
        this.board.io.accelStepperEnable(this.stepper, DISABLED);

				// Update our pos to zero
    		this.stepPosition = 0;

        // Set zero for the stepper
        this.board.io.accelStepperZero(this.stepper);

				// Next we reset the encoder pos to zero
      	this.board.io.encoderResetToZero(this.stepper, true);

        // Emit error
        this.emit('motorError');
      }
    });

    // We are ready
    logger(`motor ${this.id} is ready`);
    this.ready = true;
    this.emit('ready', this.id);
  }

  /* ------------------------------ */
  goHome(cb){

    // Cant home if we are already home
    if(this.home){
      logger(`ERROR: motor ${this.id} is already home`);
      this.error = 'DOUBLE_HOME';
      this.emit('motorError');
      return;
    }

    logger(`motor ${this.id} starting to home`);

    // We are now in homing state
    this.homing = true;
    this.moving = true;
    this.emit('homing');

    // Define stop
    this.limit.once('close',()=>{
      logger(`limit hit, motor ${this.id} is home!`);

			// First we stop the motor
      this.board.io.accelStepperStop(this.stepper);

			// Then we set the stepper location to zero
      this.board.io.accelStepperZero(this.stepper);

			// Next we reset the encoder pos to zero
      this.board.io.encoderResetToZero(this.stepper, true);

			// Finally we update our internal parameters
    	this.stepPosition = 0;
      this.homing = false;
      this.home = true;
      this.homed = true;
      this.moving = false;

			// Let others know we are home
      this.emit('home', this.id);
    })

    // Slow for homing
    this.board.io.accelStepperSpeed(this.stepper, 500);

    // We go back until we find switch
    this.board.io.accelStepperStep(this.stepper, 20000 * this.limitDir,()=>{
      logger(`motor ${this.id} homing movement complete!`);

      // If we are here we never found home :(
      if(!this.home){
        this.error = 'NOHOME';
        this.emit('nohome', this.id);
      } 

      // If we are home and have callback execute it
      if(this.home && cb) {
        logger(`motor ${this.id} is home and is going to execute a homing callback that was passed`)
        setTimeout(cb, 500);
      }

    });

  }

  /* ------------------------------ */
  get state(){
    return {
      id: this.id,
      homing: this.homing,
      home: this.home,
      homed: this.homed,
      enabled: this.enabled,
      ready: this.ready, 
      stepPosition: this.stepPosition,
      encoderPosition: this.encoderPosition,
      error: this.error,
      moving: this.moving
    }
  }

  /* ------------------------------ */
  setPosition( position, speed = this.maxSpeed ){

    // Safety check ( don't allow set pos to an angle outside the limits )
    if( position > this.limPos || position < -this.limNeg ){
      logger(`ERROR: motor ${this.id} set position to ${position}º is outside the bounds of this motor!!!`);
      this.error = 'OUT_OF_BOUNDS';
      this.emit('motorError');
      return;
    }

    // Safety check ( dont allow user to set pos if motor was never homed )
    if( !this.homed ){
      logger(`ERROR: motor ${this.id} set position to ${position}º cannot be completed as motor has never been homed!!`);
      this.error = 'NEVER_HOMED';
      this.emit('motorError');
      return;
    }

    // We are now in motion
    this.moving = true; 

    // No longer home
    // NOTE: timeout is because switch might get triggered again after it first leaves
    setTimeout(()=>{
      this.home = false;
    }, 1500)

    logger(`motor ${this.id} set position to ${position}º speed ${speed} steps/s`);

    // set speed before movement
    this.board.io.accelStepperSpeed(this.stepper, speed);
    this.board.io.accelStepperAcceleration(this.stepper, this.maxAccel)

    // convert pos to steps 
    let pos = this.stepDeg * position;

    logger(`motor ${this.id} moving to ${pos} steps before offset to achive ${position}º`);

    // offset the pos by zeroStep
    pos = pos + this.zeroStep;

    logger(`motor ${this.id} moving to step ${pos} to achive ${position}º`);

    // Move to specified position
    this.board.io.accelStepperTo(this.stepper, pos, (actual) => {
      logger(`motor ${this.id} movement to ${pos} moved to ${actual}`);
    	// update our step pos 
			// ( note we use actual because it could have been overidden/stopped )
    	this.stepPosition = actual;
      // Done moving
      this.moving = false;
			// let others know our movement is complete
      this.emit('moved', this.id);
    });
  }

  /* ------------------------------ */
  enable(){
    logger(`enable ${this.id}`);
    this.board.io.accelStepperEnable(this.stepper, ENABLED);
    this.enabled = true;
    this.emit('enabled');
  }

  /* ------------------------------ */
  disable(){
    logger(`disable ${this.id}`);
    this.board.io.accelStepperEnable(this.stepper, DISABLED);
    this.enabled = false;
    // Whenever user disables we need to home again
    this.homed = false;
    this.emit('disabled');
  }

  /* ------------------------------ */
  freeze(){
    logger(`freeze ${this.id}`);
    this.board.io.accelStepperStop(this.stepper);
    this.moving = false;
    this.emit('frozen');
  }

  /* ------------------------------ */
  center(){
    logger(`center ${this.id}`);
    this.setPosition(0);
  }

  /* ------------------------------ */
  resetErrors(){
    this.error = undefined;
    this.emit('resetErrors');
  }

  /* ------------------------------ */
  zero(){
    logger(`zero ${this.id}`);
    this.board.io.accelStepperZero(this.stepper);
    this.board.io.encoderResetToZero(this.stepper, true);
    this.stepPosition = 0;
    this.emit('enabled');
  }


  /* ------------------------------ */
  updateZeroStep(){
    // steps from 0 --- to ---> axis zero ( 0 is where limit switch is )
    this.zeroStep = this.limitDir === FORWARDS ? ( this.limPos + this.limitAdj )* this.stepDeg * -1 : ( this.limNeg + this.limitAdj ) * this.stepDeg; 
  }
  

}
