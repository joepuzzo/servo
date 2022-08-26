import {EventEmitter} from 'events';
import five from "johnny-five";

// For debugging
import { Debug } from './debug.js';
const logger = Debug('servo:motor' + '\t');

// Constatnts
const ENABLED = false;
const DISABLED = !ENABLED;
const FORWARDS = 1;
const BACKWARDS = -1;

/** 
 * Motor 
 */
export class Motor extends EventEmitter   {

  /* ------------------------------ */
  constructor({ id, stepper, board, stepPin, dirPin, limitPin, encoderPinA, encoderPinB, limPos, limNeg, stepDeg }) {

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
    this.limPos = limPos;                       // the limit in posative direction in degrees
    this.limNeg = limNeg;                       // the limit in negative direction in degrees
    this.stepDeg = stepDeg;                     // motor steps per degree
    this.axisLimit = limPos + limNeg;           // define total axis travel
    this.stepLimit = this.axisLimit * stepDeg;  // steps full movement of axis
    this.zeroStep = this.limNeg * stepDeg;      // steps from 0 --- to ---> axis zero
    this.enabled = false;                       // will enable/disable motor
    this.error = undefined;                     // current error state for this motor
    this.robotStopped = false;                  // the motor might stop things but the robot might also have stop set
    this.homing = false;                        // if motor is process of homing
    this.home = false;                          // if the motor is currently home
    this.ready = false;                         // if motor is ready
    this.encoderPosition = 0;                   // encoder position
    this.stepPosition = 0;                      // step position
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
      enablePin: 12, // TODO define this
    });

    // Enable stepper motor
    this.enabled = true;
    this.board.io.accelStepperEnable(this.stepper, ENABLED);

    // Configure limit switch
    this.limit = new five.Button({
      pin: this.limitPin,
      isPullup: true
    });

    // Safety
    this.limit.on('down',()=>{

      // If we are not homing stop the motor and error
      if( !this.homing ){
        logger(`Error: limit hit for motor ${this.id}`);
        this.error = 'LIMIT';
        this.homing = false;
        // Set zero
        this.board.io.accelStepperZero(this.stepper);
        // Disable the stepper
        this.board.io.accelStepperEnable(this.stepper, DISABLED);
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
  goHome(){

    logger(`motor ${this.id} starting to home`);

    // We are now in homing state
    this.homing = true;
    this.emit('homing');

    // Define stop
    this.limit.once('down',()=>{
      logger(`limit hit, motor ${this.id} is home!`);
      this.board.io.accelStepperZero(this.stepper);
      this.homing = false;
      this.home = true;
      this.emit('home', this.id);
    })

    // Slow for homing
    this.board.io.accelStepperSpeed(this.stepper, 500);

    // We go back until we find switch
    this.board.io.accelStepperStep(this.stepper, 4000 * BACKWARDS,()=>{
      logger(`motor ${this.id} homing movement complete!`);

      // If we are here we never found home :(
      if(!this.home){
        this.error = 'NOHOME';
        this.emit('nohome', this.id);
      }
    });

  }

  /* ------------------------------ */
  get state(){
    return {
      homing: this.homing,
      home: this.home,
      enabled: this.enabled,
      ready: this.ready, 
      stepPosition: this.stepPosition,
      encoderPosition: this.encoderPosition,
      error: this.error
    }
  }

  /* ------------------------------ */
  setPosition( position, speed = 500 ){

    logger(`motor ${this.id} set position to ${position} speed ${speed}`);

    // set speed before movement
    this.board.io.accelStepperSpeed(this.id, speed);

    // convert pos to steps 
    const pos = this.stepDeg * position;

    // update our step pos
    this.stepPosition = pos;

    // Move to specified position
    this.board.io.accelStepperTo(this.id, pos, ()=>{
      logger(`motor ${this.id} movement complete`);
      this.emit('moved');
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
    this.emit('disabled');
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
    this.emit('enabled');
  }
  

}