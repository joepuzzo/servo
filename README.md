# Getting Started 

```bash
DEBUG='servo:.*' node index.js -p 3000 
```

# For Teensy 4.1

1. You need to install a custom firmata with this http://firmatabuilder.com/

2. You also need this https://www.arduino.cc/reference/en/libraries/encoder/

3. In order to use the encoder stuff ( until the people that own firmata.js merge my code ) you need to run this in any new project that wants to use encoder stuff

```bash
 npm i firmata-io@npm:@joepuzzo/firmata-io
```

4. You also need to change this `_minPulseWidth = 1;` to `_minPulseWidth = 4;` in the `ConfigurableFirmata-2.10.1`s  `AccelStepper.cpp` file 

5. You need to add this to the Boards.h in the `ConfigurableFirmata-2.10.1` src/utility directory

```cpp

// Teensy 4.0 & 4.1
#elif defined(__IMXRT1062__)
#define TOTAL_ANALOG_PINS       NUM_ANALOG_INPUTS
#define TOTAL_PINS              NUM_DIGITAL_PINS
#define VERSION_BLINK_PIN       13
#define PIN_SERIAL1_RX          0
#define PIN_SERIAL1_TX          1
#define PIN_SERIAL2_RX          7
#define PIN_SERIAL2_TX          8
#define PIN_SERIAL3_RX          15
#define PIN_SERIAL3_TX          14
#define PIN_SERIAL4_RX          16
#define PIN_SERIAL4_TX          17
#define PIN_SERIAL5_RX          21
#define PIN_SERIAL5_TX          20
#define PIN_SERIAL6_RX          25
#define PIN_SERIAL6_TX          24
#define PIN_SERIAL7_RX          28
#define PIN_SERIAL7_TX          29
#define IS_PIN_DIGITAL(p)       ((p) >= 0 && (p) < NUM_DIGITAL_PINS)
#ifdef ARDUINO_TEENSY40
  #define IS_PIN_ANALOG(p)        ((p) >= 14 && (p) <= 27)
  #define PIN_TO_ANALOG(p)        ((p) - 14)
#endif
#ifdef ARDUINO_TEENSY41
  #define IS_PIN_ANALOG(p)        (((p) >= 14 && (p) <= 27) || ((p) >= 38 && (p) <= 41))
  #define PIN_TO_ANALOG(p)        (((p) <= 27) ? (p) - 14 : (p) - 24)
#endif
#define IS_PIN_PWM(p)           digitalPinHasPWM(p)
#define IS_PIN_SERVO(p)         ((p) >= 0 && (p) < MAX_SERVOS)
#define IS_PIN_I2C(p)           ((p) == PIN_WIRE_SDA || (p) == PIN_WIRE_SCL)
#define IS_PIN_SERIAL(p)        (((p) >= 0 && (p) <= 1) || ((p) >= 7 && (p) <= 8) || ((p) >= 14 && (p) <= 17) || ((p) >= 20 && (p) <= 21) || ((p) >= 24 && (p) <= 25) || ((p) >= 28 && (p) <= 29))
#define PIN_TO_DIGITAL(p)       (p)
#define PIN_TO_PWM(p)           (p)
#define PIN_TO_SERVO(p)         (p)

```