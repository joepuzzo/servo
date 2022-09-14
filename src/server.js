import io from 'socket.io-client';
import { Robot } from './robot.js';

// For debugging
import { Debug } from './debug.js';
const logger = Debug('servo:server' + '\t');

export const startServer = (config) => {

  // Create socket
  const connectionString = `http://${config.host}:${config.port}/robot?id=${config.id}`;
  const socket = io(connectionString);
  logger("created socket", connectionString);

  // Create robot
  const robot = new Robot(config);

  /* ---------- Subscribe to robot events ---------- */
  robot.on('state', () => {
    logger("sending state");
    socket.emit('state', robot.state );
  });

  robot.on('encoder', () => {
    // Specifically dont log here ( to much logging )
    socket.emit('encoder', robot.state );
  });

  robot.on('ready', () => {
    logger("robot ready sending state and registering");
    socket.emit('register', robot.meta);
    socket.emit('state', robot.state );  
  });

  robot.on('meta', () => {
    logger("sending meta");
    socket.emit("register", robot.meta);
  });

  robot.on('moved', () => {
    logger("sending moved");
    socket.emit("moved", robot.meta);
  });


  /* ---------- Subscribe to socket events ---------- */

  socket.on('connect', ()=>{
    logger("robot is connected to controller, sending state");
    socket.emit('register', robot.meta);
    socket.emit('state', robot.state );
  });

  socket.on('hello', msg => {
    logger("controller says hello");
  });

  socket.on('motorSetPos', (id, pos, speed) => {
    logger(`controller says motorSetPos to ${pos} at speed ${speed} for motor ${id}`);
    robot.motorSetPosition(id, pos, speed);
  });

  socket.on('motorResetErrors', (id) => {
    logger(`controller says motorResetErrors for motor ${id}`);
    robot.motorResetErrors(id);
  });

  socket.on('motorEnable', (id) => {
    logger(`controller says motorEnable ${id}`);
    robot.motorEnable(id);
  });

  socket.on('motorDisable', (id) => {
    logger(`controller says motorDisable ${id}`);
    robot.motorDisable(id);
  });

  socket.on('motorHome', (id) => {
    logger(`controller says motorHome ${id}`);
    robot.motorHome(id);
  });

  socket.on('motorZero', (id) => {
    logger(`controller says motorZero ${id}`);
    robot.motorZero(id);
  });

  socket.on('robotHome', () => {
    logger(`controller says robotHome`);
    robot.robotHome();
  });

  socket.on('robotCalibrate', () => {
    logger(`controller says robotCalibrate`);
    robot.robotCalibrate();
  });

  socket.on('robotStop', () => {
    logger(`controller says robotStop`);
    robot.robotStop();
  });

  socket.on('robotFreeze', () => {
    logger(`controller says robotFreeze`);
    robot.robotFreeze();
  });

  socket.on('robotCenter', () => {
    logger(`controller says robotCenter`);
    robot.robotCenter();
  });

	socket.on('robotEnable', () => {
    logger(`controller says robotEnable`);
    robot.robotEnable();
  });

  socket.on('robotSetAngles', (angles, speed) => {
    logger(`controller says robotSetAngles`);
    robot.robotSetAngles(angles, speed);
  });

  socket.on('home', () => {
    logger(`controller says home robot`);
    robot.home();
  });

  socket.on('disconnect', () => {
    logger("robot is disconnected from controller");
  });

}
