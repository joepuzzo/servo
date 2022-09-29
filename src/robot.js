
import {EventEmitter} from 'events';
import { Motor } from './motor.js';
import five from "johnny-five";
import { mockBoard } from "./mockboard.js";

// For reading and writing to config
import path from 'path';
import fs from 'fs';

// For debugging
import { Debug } from './debug.js';
const logger = Debug('servo:robot' + '\t');


const FORWARDS = 1;
const BACKWARDS = -1;

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
    this.moving = false;              // if the robot is moving to a given position ( set angles was called )
    this.home = false;                // if the robot is currently home
    this.mock = mock;                 // if we are in mock mode ( no actual arduino connected )
    this.calibrating = false;         // if the robot is currently running a calibration

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

     // First read in the config 
     this.readConfig();

     const j0LimitAdj = this.config.j0?.limitAdj ?? 0;
     const j1LimitAdj = this.config.j1?.limitAdj ?? 0;
     const j2LimitAdj = this.config.j2?.limitAdj ?? 0;
     const j3LimitAdj = this.config.j3?.limitAdj ?? 0;
     const j4LimitAdj = this.config.j4?.limitAdj ?? 0;
     const j5LimitAdj = this.config.j5?.limitAdj ?? 0;

     logger(`starting robot with id ${this.id}`);

      // temp var to pass to motors
      const board = this.board;

      // Create Motors
      this.motors.j0 = new Motor({ stepper: 0, id: 'j0', board, stepPin: 0, dirPin: 1, limitPin: 26, enablePin: 33, encoderPinA: 14, encoderPinB: 15, limPos: 170, limNeg: 170, stepDeg: 44.44444444, limitAdj: j0LimitAdj });
      this.motors.j1 = new Motor({ stepper: 1, id: 'j1', board, stepPin: 2, dirPin: 3, limitPin: 27, enablePin: 34, encoderPinA: 17, encoderPinB: 16, limPos: 42, limNeg: 90, stepDeg: 55.55555556, limitAdj: j1LimitAdj });
      this.motors.j2 = new Motor({ stepper: 2, id: 'j2', board, stepPin: 4, dirPin: 5, limitPin: 28, enablePin: 35, encoderPinA: 19, encoderPinB: 18, limPos: 20, limNeg: 145, stepDeg: 55.55555556, limitDir: BACKWARDS, limitAdj: j2LimitAdj });
      this.motors.j3 = new Motor({ stepper: 3, id: 'j3', board, stepPin: 6, dirPin: 7, limitPin: 29, enablePin: 36, encoderPinA: 20, encoderPinB: 21, limPos: 165, limNeg: 165, stepDeg: 42.72664356, invertEnable: false, limitDir: BACKWARDS });
      this.motors.j4 = new Motor({ stepper: 4, id: 'j4', board, stepPin: 8, dirPin: 9, limitPin: 30, enablePin: 37, encoderPinA: 23, encoderPinB: 22, limPos: 100, limNeg: 100, stepDeg: 21.86024888, limitAdj: j4LimitAdj });
      this.motors.j5 = new Motor({ stepper: 5, id: 'j5', board, stepPin: 11, dirPin: 12, limitPin: 31, enablePin: 38, encoderPinA: 24, encoderPinB: 25, limPos: 155, limNeg: 155, stepDeg: 22.22222222 });

      // Subscribe to events for all motors
      Object.values(this.motors).forEach(motor => {
        motor.on('ready', (id) => this.motorReady(id) );
        motor.on('homing', () => this.robotState() );
        motor.on('motorError', () => this.robotState() );
        motor.on('encoder', () => this.robotEncoder() );
        motor.on('home', (id) => this.motorHomed(id) );
        motor.on('nohome', () => this.robotState() );
        motor.on('moved', (id) => this.motorMoved(id) );
        motor.on('disabled', () => this.robotState() );
        motor.on('enabled', () => this.robotState() );
        motor.on('resetErrors', () => this.robotState() );
      });

     // Create Gripper
     this.gripper = new five.Servo({
      pin: 10,
      startAt: 20
     });

     // Report all encoder updates
     setInterval(()=>{

			// Ask the board to report all encoders
      // Note: this will trigger events that each motor will hear and update themselves
     	this.board.io.encoderReportAll(() => {
				// Note we could have the motors each do this but this is better
				// i.e call this on interval to get all pos instead of polling 1 time per motor
        // in other words one event every polling interval instead of 6 events 
        this.emit('encoder');
			});

     }, 100);

     // Start all motors
     Object.values(this.motors).forEach(motor => {
       motor.start();
     });      

   }

  /** ------------------------------
   * readConfig
   */
  readConfig() {
    // Read in config file ( create if it does not exist yet )
    try {

      // Get filename
      const filename = path.resolve('config.json');

      // Check if it exists and create if it does not
      if (!fs.existsSync(filename)) {
        console.log('Config file does not exist creating');
        fs.writeFileSync(filename, JSON.stringify({}));
      }

      // Read in config file 
      const config = JSON.parse(fs.readFileSync(filename, 'utf8'));

      logger('Successfully read in config', config);

      this.config = config;
    } catch(err) {
      console.error(err);
    }
  }

  /** ------------------------------
   * writeConfig
   */
  writeConfig() {
    logger('Writing config to file', this.config);
    try {
      // Get filename
      const filename = path.resolve('config.json');
      // Write config
      fs.writeFileSync(filename, JSON.stringify(this.config));
    } catch (err) {
      console.error(err);
    }
  }

  /** ------------------------------
   * updateConfig
   *
   * By default this will NOT save to the file it will only update in memory
   * Note: a call to writeConfig() at any time will save everything that has been updated to the file
   */
  updateConfig(key, value, save = false) {

    logger(`updating config ${key} to ${value}`);

    // Special check ( dont let user set a config param to null !! )
    if( value == null ){
      logger(`Unable to set ${key} to ${value} as its null`);
      return;
    }

    // Example key = "j0.limitAdj"
    if( key.includes('.') ){
      const [joint, param] = key.split('.');

      // Update the config
      this.config[joint][param] = value;

      // Update the motor
      this.motors[joint][param] = value;

      // Special case for limitAdj
      if(param === 'limitAdj'){
        logger('Updating limitAdj so we need to also update zero step');
        this.motors[joint].updateZeroStep();
      }
    } else {
      this.config[key] = value;
    }

    // Now write the config out
    if( save ) this.writeConfig();

    logger(`updated config`, this.config)

    this.emit("meta");
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
      stopped: this.stopped, 
      ready: this.ready, 
      home: this.home,
      homing: this.homing,
      moving: this.moving,
      config: this.config,
      motors
    }
  }

   /* -------------------- Motor Events -------------------- */

  motorReady(id){
    logger(`motor ${id} is ready`);
    if(Object.values(this.motors).every( motor => motor.ready)){
      logger(`all motors are ready!`);
      this.ready = true;

      // TODO this does not currently work using custom for now...
      // Configure multi stepper group
      // this.board.io.multiStepperConfig({
      //   groupNum: 0,
      //   devices: [0, 1, 2, 3, 4, 5]
      // });

      // We are now ready
      this.emit('ready');
    }
  }

  motorHomed(id){
    logger(`motor ${id} is homed`);

    // If we are homing robot check to see if we are all done homing
    if(this.homing){
      if(Object.values(this.motors).every( motor => motor.home)){
        logger(`all motors are home!`);

        this.home = true 
        this.homing = false;

        // If we were running calibration then go to center
        if( this.calibrating ) { 
          // Now go to center
          setTimeout(()=>{
            this.robotCenter();
          }, 500)
        }
      }
    }

    // If we were splitHoming and all motors accept j4 are home send everything accept j4 to center
    if( this.splitHoming && Object.values(this.motors).every( (motor, i) => i != 4 ? motor.home : true )){
      setTimeout(()=>{
        Object.values(this.motors).forEach((motor, i) => {
          if( i != 4 ) motor.center();
        });   
      },500)
    }

    this.emit('meta');
    this.emit('state');
  }

  robotState(){
    this.emit('state');
  }

  robotEncoder(){
    this.emit('encoder');
  }

  motorMoved(id) {
    logger(`motor ${id} moved`);

    // If we are moving robot to a position check if its done
    if(this.moving){
      if(Object.values(this.motors).every( motor => !motor.moving)){
        logger(`all motors have moved!`);
        this.moving = false;
        this.emit("moved");
      }
    }

    // If we are calibrating the robot check if its done
    if(this.calibrating){
      if(Object.values(this.motors).every( motor => !motor.moving)){
        logger(`all motors have centered for calibration!`);
        this.calibrating = false;
      }
    }

    // If we are performing a split home check if all motors are done moving and home the last motors
    if(this.splitHoming){
      logger(`all motors have centered for split home, time to home the rest of the motors!`);

      // We set this to false so when the last motor homes it runs normal homing finish sequence
      this.splitHoming = false;

      // Ok now send last motors to home!
      // note we pass callback to them go to center after they home ;) 
      this.motors.j4.goHome(() => this.motors.j4.center() );
      this.motors.j5.goHome(() => this.motors.j5.center() );
    }

    // Anytime this gets called its from a robot move so we are no longer home 
    this.home = false;

    // Let others know
    this.emit("meta");
    this.emit('state');
  }

  /* -------------------- Robot Actions -------------------- */

  robotHome(){
    logger(`home robot`);

    // Update our state
    this.homing = true;

    // Home all motors
    Object.values(this.motors).forEach((motor, i) => {
      // Because cable sometimes hits the last limit switch we home that guy after a timeout
      if( i != 4 ){
        motor.goHome();
      }
    });     

    // Now set the last guys home timeout
    setTimeout(()=>{
      this.motors.j4.goHome();
    }, 4000)

    this.emit("meta");
  }

  robotCalibrate(){
    logger(`calibrate robot`);

    // Update our state
    this.homing = true;
    this.calibrating = true;

    // Home the robot
    this.robotHome();
  }

  robotSplitHome(){
    logger(`split home robot`);

    // Update our state
    this.homing = true;
    this.splitHoming = true;

    // Home some of the motors motors
    Object.values(this.motors).forEach((motor, i) => {
      // Because end effector is large we home j4 later
      if( i != 4 ){
        motor.goHome();
      }
    });     
  }

  robotStop(){
    logger(`stop robot`);

    this.stopped = true;

    // Disable all motors
    Object.values(this.motors).forEach(motor => {
      motor.disable();
    });     

    this.emit("meta");
  }

  robotFreeze(){
    logger(`freeze robot`);

    // Freeze all motors ( stops but does not disable )
    Object.values(this.motors).forEach(motor => {
      motor.freeze();
    });     

    this.emit("meta");
  }

  robotCenter(){
    logger(`center robot`);

    // We are moving whole robot
    this.moving = true;

    // Centers all motors
    Object.values(this.motors).forEach(motor => {
      motor.center();
    });     

    this.emit("meta");
  }

  robotEnable(){
    logger(`enable robot`);

    this.stopped = false;

    // Enable all motors
    Object.values(this.motors).forEach(motor => {
      motor.enable();
    });     

    this.emit("meta");
  }

  // TODO REMOVE this old implimentation
  robotSetAnglesOld(angles, speed){
    logger(`robotSetAngles at speed ${speed} angles:`, angles);

    // We are moving to a new location
    this.moving = true;

    // TODO this does not currently work so I wrote my own for now
    // Use multi stepper command to command all motors
    //this.board.io.multiStepperTo(0, [2000, 2000, 2000, 2000, 2000, 2000], () => {
      // End movement of all steppers
    //});
     
    // Step1: First find the stepper that will take the longest time
    let longestTime = 0;
    let longestMotor = this.motors.j0;
		Object.values(this.motors).forEach((motor, i) => {

      // We want to determine the speed ( dont allow user to go over motor max speed )
      const maxSpeed = speed && ( speed <= motor.maxSpeed ) ? speed : motor.maxSpeed;

			// convert pos to steps 
    	const goal = (motor.stepDeg * angles[i] )+ motor.zeroStep;
      
      // TODO will be better to use encoder pos instead of the step one
			const thisDistance = goal - motor.stepPosition;
      const thisTime = Math.abs(thisDistance) / maxSpeed;

      // Update longest if its longer
      if(thisTime > longestTime){
      	longestTime = thisTime;
        longestMotor = motor; 
    	}
    }); 

    logger(`Longest time is ${longestTime} for motor ${longestMotor.id}`);

		// Step2: Move via speed for each based on time
		Object.values(this.motors).forEach((motor, i) => {

      // convert pos to steps 
    	const goal = ( motor.stepDeg * angles[i] ) + motor.zeroStep;
      
      // TODO will be better to use encoder pos instead of the step one
			const thisDistance = goal - motor.stepPosition;
	    const thisSpeed = Math.abs(thisDistance) / longestTime;
     
      // Now go! ( make sure we pass degrees and not steps to this func )
      motor.setPosition(angles[i], thisSpeed);
    })

    this.emit("meta");
  }

  robotSetAngles(angles, speed){
    logger(`robotSetAngles at speed ${speed} angles:`, angles);

    // We are moving to a new location
    this.moving = true;

    // TODO this does not currently work so I wrote my own for now
    // Use multi stepper command to command all motors
    //this.board.io.multiStepperTo(0, [2000, 2000, 2000, 2000, 2000, 2000], () => {
      // End movement of all steppers
    //});
     
    // Step1: First find the stepper that will take the longest time
    let longestTime = 0;
    let longestMotor = this.motors.j0;
    let longestMotorTimeAtSpeed = 1;
    let longestRatio = 0;
  
    let results = [];
		Object.values(this.motors).forEach((motor, i) => {

      // We want to determine the speed ( dont allow user to go over motor max speed )
      const maxSpeed = speed && ( speed <= motor.maxSpeed ) ? speed : motor.maxSpeed;

			// convert pos to steps 
    	const goal = (motor.stepDeg * angles[i] )+ motor.zeroStep;
      
      // TODO will be better to use encoder pos instead of the step one
			const D = Math.abs(goal - motor.stepPosition);

      // New stuff
      // 
      // Below we have distances A, B, and C
      // where A = C and are the ramp up and down times and B is the max speed time
      //
      // Total Distance = D
      //
      //  A         B         C
      //
      //      |          | 
      //      ____________
      //     /|          |\
      // ___/ |          | \___
      //
      //  T1       T2        T1
      //
      // Our goal is to calculate T2 and T1 
      //


      // T1 is the time to get up to maxSpeed given at an acceleration.
      // T1 = (VFinal - VInitial ) / Acceleration
      const T1 = maxSpeed/motor.maxAccel;

      // Using displacement equation s=1/2 at^2 to get the distane traveled during T1
      const A = .5 * motor.maxAccel * (T1 ** 2);
      // B =  total distance - distance traveled to acclerate/decellerate
      //const B = Math.abs(D - (2 * A)); 
      const B = D - (2 * A);

      // Time to travel distance B (while at max speed) is B/maxSpeed
      const T2 = B/maxSpeed

      // Set total time
      const thisTime = T1 + T2 + T1;

      // Add to results
      results.push({ A, B, D, T1, T2 })

      // Update longest if its longer
      if(thisTime > longestTime){
      	longestTime = thisTime;
        longestMotor = motor;
        longestMotorTimeAtSpeed =  T2;
        longestRatio = B / D;
    	}
    }); 

    logger(`Longest time is ${longestTime} for motor ${longestMotor.id}`);
    logger(`Results`, results);

		// Step2: Move via speed for each based on time
		Object.values(this.motors).forEach((motor, i) => {

      // Scale down the speed based on longest time
      const { D } = results[i];

      // We want this motor to spend longestMotorTimeAtSpeed at speed
      // It will travel D * longestMotorTimeAtSpeed/longestTime total distance at speed
      // How fast will it need to go to cover this distance?

      // MATT BELOW WAS OLD RATIO CALC 
  		//const ratio = Math.abs(longestMotorTimeAtSpeed / longestTime);
      const ratio = longestRatio;
    	const distaceAtSpeed = D * ratio;
    	const travelSpeed = distaceAtSpeed / longestMotorTimeAtSpeed;

      // This leaves (longestTime - longestMotorTimeAtSpeed) many seconds for accel and decel
      // What acceleration is required to reach travelSpeed in (longestTime - longestMotorTimeAtSpeed)/2 seconds?
      const timeForAcceleration = (longestTime - longestMotorTimeAtSpeed) /2;
      const acceleration = travelSpeed / timeForAcceleration;
      
      if( travelSpeed < 2500 && acceleration < 2000 ){
        // Now go! ( make sure we pass degrees and not steps to this func )
        motor.setPosition(angles[i], travelSpeed, acceleration);
      } else {
        logger(`ERROR!! unable to set pos for motor ${motor.id} with acceleration ${acceleration} and speed ${travelSpeed} as one of them is too big!`)
      }
    })

    this.emit("meta");
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

  /* -------------------- Gripper Actions -------------------- */

  gripperSetPosition(pos, speed = 500){
    logger(`set position for gripper to ${pos}, at speed ${speed}`);
    this.gripper.to(pos,speed);
    setTimeout(()=>{
        this.emit("moved");
    }, 1000)
  }


}
