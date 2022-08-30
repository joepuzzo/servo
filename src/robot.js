
import {EventEmitter} from 'events';
import { Motor } from './motor.js';
import five from "johnny-five";
import { mockBoard } from "./mockboard.js";

// For debugging
import { Debug } from './debug.js';
const logger = Debug('servo:robot' + '\t');

/** 
 * Robot 
 */
export class Robot extends EventEmitter   {

  /** ------------------------------
   * Constructor
   */
  constructor({ id, mock }) {

    logger(`creating robot with id ${id}`);

    // Becasuse we are event emitter
    super();

    // Define parameters
    this.id = id;                     // id of the robot
    this.stopped = false;             // will disable the robot
    this.ready = false;               // if the robot is ready
    this.homing = false;              // if the robot is currently homing
    this.home = false;                // if the robot is currently home
    this.mock = mock;                 // if we are in mock mode ( no actual arduino connected )

    this.board = mock                 // Jhonny5 board 
      ? mockBoard()
      : new five.Board({
        repl: false
      });

    this.motors = {};                 // tracks all motors by joint id
    
    // Start up the robot when board is ready
    this.board.on("ready", () => this.setup() );

  }

  /** ------------------------------
   * setup
   */
   setup() {

     logger(`starting robot with id ${this.id}`);

      // temp var to pass to motors
      const board = this.board;

      // Create Motors
      // this.motors.j0 = new Motor({ stepper: 0, id: 'j0', board, stepPin: 0, dirPin: 1, limitPin: 26, encoderPinA: 14, encoderPinB: 15, limPos: 170, limNeg: 170, stepDeg: 1.111111 });
      this.motors.j0 = new Motor({ stepper: 0, id: 'j0', board, stepPin: 0, dirPin: 1, limitPin: 26, encoderPinA: 14, encoderPinB: 15, limPos: 170, limNeg: 170, stepDeg: 44.44444444 });
      this.motors.j1 = new Motor({ stepper: 1, id: 'j1', board, stepPin: 2, dirPin: 3, limitPin: 27, encoderPinA: 17, encoderPinB: 16, limPos: 90, limNeg: 42, stepDeg: 55.55555556 });
      this.motors.j2 = new Motor({ stepper: 2, id: 'j2', board, stepPin: 4, dirPin: 5, limitPin: 28, encoderPinA: 19, encoderPinB: 18, limPos: 52, limNeg: 89, stepDeg: 55.55555556 });
      this.motors.j3 = new Motor({ stepper: 3, id: 'j3', board, stepPin: 6, dirPin: 7, limitPin: 29, encoderPinA: 20, encoderPinB: 21, limPos: 165, limNeg: 165, stepDeg: 42.72664356 });
      this.motors.j4 = new Motor({ stepper: 4, id: 'j4', board, stepPin: 8, dirPin: 9, limitPin: 30, encoderPinA: 23, encoderPinB: 22, limPos: 105, limNeg: 105, stepDeg: 21.86024888 });
      this.motors.j5 = new Motor({ stepper: 5, id: 'j5', board, stepPin: 10, dirPin: 11, limitPin: 31, encoderPinA: 24, encoderPinB: 25, limPos: 155, limNeg: 155, stepDeg: 22.22222222 });

      // Subscribe to events for all motors
      Object.values(this.motors).forEach(motor => {
        motor.on('ready', (id) => this.motorReady(id) );
        motor.on('homing', () => this.robotState() );
        motor.on('motorError', () => this.robotState() );
        motor.on('encoder', () => this.robotState() );
        motor.on('home', () => this.motorHomed() );
        motor.on('nohome', () => this.robotState() );
        motor.on('moved', () => this.robotState() );
        motor.on('disabled', () => this.robotState() );
        motor.on('enabled', () => this.robotState() );
        motor.on('resetErrors', () => this.robotState() );
      });

      // Start all motors
      Object.values(this.motors).forEach(motor => {
        motor.start();
      });      

   }

  /** ------------------------------
   * get state
   */
  get state(){

    // Build motors state object
    const motors = {};
    Object.values(this.motors).forEach( motor => {
      motors[motor.id] = motor.state;
    });

    // return state
    return {
      id: this.id,
      motors
    }
  }


  /** ------------------------------
   * get meta
   */
   get meta(){

    // Build motors state object
    const motors = {};
    Object.values(this.motors).forEach( motor => {
      motors[motor.id] = { id: motor.id };
    });

    // return meta
    return {
      motors
    }
  }

   /* -------------------- Motor Events -------------------- */

  motorReady(id){
    logger(`motor ${id} is ready`);
    if(Object.values(this.motors).every( motor => motor.ready)){
      logger(`all motors are ready!`);
      this.ready = true;
      this.emit('ready');
    }
  }

  motorHomed(id){
    logger(`motor ${id} is homed`);

    // If we are homing robot check to see if we are all done homing
    if(this.homing){
      if(Object.values(this.motors).every( motor => motor.home)){
        logger(`all motors are home!`);
        this.home = true;
      }
    }

    this.emit('state');
  }

  robotState(){
    this.emit('state');
  }

  /* -------------------- Robot Actions -------------------- */

  robotHome(){
    logger(`home robot`);

    // Update our state
    this.homing = true;

    // Home all motors
    Object.values(this.motors).forEach(motor => {
      motor.goHome();
    });     
    
  }


  /* -------------------- Motor Actions -------------------- */

  motorSetPosition(id, pos, speed){
    logger(`set position for motor ${id}`);
    this.motors[id].setPosition(pos, speed);
  }

  motorHome(id){
    logger(`home motor ${id}`);
    this.motors[id].goHome();
  }

  motorResetErrors(id){
    logger(`reset motor errors for motor ${id}`);
    this.motors[id].resetErrors();
  }

  motorEnable(id){
    logger(`enable motor ${id}`);
    this.motors[id].enable();
  }

  motorDisable(id){
    logger(`enable motor ${id}`);
    this.motors[id].disable();
  }

  motorZero(id){
    logger(`zero motor ${id}`);
    this.motors[id].zero();
  }


}