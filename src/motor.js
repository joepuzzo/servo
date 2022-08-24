import {EventEmitter} from 'events';
import five from "johnny-five";

// For debugging
import { Debug } from './debug.js';
const logger = Debug('igus:motor' + '\t');

// Constatnts
const ENABLED = true;
const DISABLED = !ENABLED;
const FORWARDS = 1;
const BACKWARDS = -1;

/** 
 * Motor 
 */
export class Motor extends EventEmitter   {

  /** ------------------------------
   * Constructor
   */
  constructor({ id, board, stepPin, dirPin, limitPin, encoderPinA, encoderPinB, limPos, limNeg, stepDeg }) {

    logger(`creating motor with id ${id}`);

    // Becasuse we are event emitter
    super();

    // Define parameters
    this.id = id;                               // id of the motor
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
    this.enabled = true;                        // will enable/disable motor
    this.error = undefined;                     // current error state for this motor
    this.robotStopped = false;                  // the motor might stop things but the robot might also have stop set
    this.homing = false;                        // if motor is process of homing
    this.home = false;                          // if the motor is currently home

    // Start up
    this.start();
  }

  /** ------------------------------
   * Start
   */
  start() {

    // Configure stepper motor
    this.board.io.accelStepperConfig({
      deviceNum: this.id,
      type: this.board.io.STEPPER.TYPE.DRIVER,
      stepPin: this.stepPin,
      directionPin: this.dirPin,
      enablePin: 1, // TODO define this
    });

    // Enable stepper motor
    this.enabled = true;
    this.board.io.accelStepperEnable(this.id, ENABLED);

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
        // Set zero
        this.board.io.accelStepperZero(0);
        // Disable the stepper
        this.board.io.accelStepperEnable(this.id, DISABLED);
        // Emit error
        this.emit('error');
      }
    });

    // We are ready
    logger(`motor with id ${this.id} is ready`);
    this.emit('ready');
  }

  /** ------------------------------
   * Home
   */
  home(){

    // We are now in homing state
    this.homing = true;
    this.emit('homing');

    // Define stop
    this.limit.once('down',()=>{
      logger.info(`limit hit, motor ${this.id} is home!`);
      this.board.io.accelStepperZero(0);
      this.homing = false;
      this.home = true;
      this.emit('home');
    })

    logger(`motor ${this.id} starting to home`);

    // Slow for homing
    this.board.io.accelStepperSpeed(this.id, 500);

    // We go back until we find switch
    this.board.io.accelStepperStep(this.id, 4000 * BACKWARDS,()=>{
      logger(`motor ${this.id} homing movement complete!`);
    });

  }

  /** ------------------------------
   * Set Position
   */
  setPosition( position, speed = 500 ){

    // set speed before movement
    this.board.io.accelStepperSpeed(this.id, speed);

    // convert pos to steps 
    const pos = this.stepDeg * position;

    // Move to specified position
    this.board.io.accelStepperTo(this.id, pos, ()=>{
      logger(`motor ${this.id} movement complete`);
    });
  }


}