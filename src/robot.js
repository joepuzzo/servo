
import {EventEmitter} from 'events';
import { Motor } from './motor.js';
import five from "johnny-five";

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
  constructor({ id }) {

    logger(`creating robot with id ${id}`);

    // Becasuse we are event emitter
    super();

    // Define parameters
    this.id = id;                     // id of the robot
    this.stopped = false;             // will disable the robot
    this.ready = false;               // if the robot is ready
    this.homing = false;              // if the robot is currently homing
    this.board = new five.Board({     // Jhonny5 board 
      repl: false
    });
    this.motors = {};                 // tracks all motors by joint id
    
    // Start up the robot when board is ready
    this.board.on("ready", this.setup );

    // Start up
    this.start();
  }

  /** ------------------------------
   * setup
   */
   setup() {

      // temp var to pass to motors
      const board = this.board;

      // Create Motors
      this.motors.j0 = new Motor({ id: 'j0', board, stepPin: 0, dirPin: 1, limitPin: 26, encoderPinA: 14, encoderPinB: 15, limPos: 170, limNeg: 170, stepDeg: 44.44444444 });
      this.motors.j1 = new Motor({ id: 'j1', board, stepPin: 2, dirPin: 3, limitPin: 27, encoderPinA: 17, encoderPinB: 16, limPos: 90, limNeg: 42, stepDeg: 55.55555556 });
      this.motors.j2 = new Motor({ id: 'j2', board, stepPin: 4, dirPin: 5, limitPin: 28, encoderPinA: 19, encoderPinB: 18, limPos: 52, limNeg: 89, stepDeg: 55.55555556 });
      this.motors.j3 = new Motor({ id: 'j3', board, stepPin: 6, dirPin: 7, limitPin: 29, encoderPinA: 20, encoderPinB: 21, limPos: 165, limNeg: 165, stepDeg: 42.72664356 });
      this.motors.j4 = new Motor({ id: 'j4', board, stepPin: 8, dirPin: 9, limitPin: 30, encoderPinA: 23, encoderPinB: 22, limPos: 105, limNeg: 105, stepDeg: 21.86024888 });
      this.motors.j5 = new Motor({ id: 'j5', board, stepPin: 10, dirPin: 11, limitPin: 31, encoderPinA: 24, encoderPinB: 25, limPos: 155, limNeg: 155, stepDeg: 22.22222222 });

   }


}