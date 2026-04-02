////////////////
//  INCLUDE   //
//  AHT20.ts  //
////////////////

type TemperatureHumidity = { Temperature: number, Humidity: number }

namespace AHT20 {

    export class Device {

        private i2caddr: number;

        public constructor(address: number = 0x38) {
            this.i2caddr = address;
        }

        init() {
            const buf = pins.createBuffer(3);
            buf[0] = 0xbe;
            buf[1] = 0x08;
            buf[2] = 0x00;
            pins.i2cWriteBuffer(this.i2caddr, buf, false);
            basic.pause(10);
        }

        measure() {
            const buf = pins.createBuffer(3);
            buf[0] = 0xac;
            buf[1] = 0x33;
            buf[2] = 0x00;
            pins.i2cWriteBuffer(this.i2caddr, buf, false);
            basic.pause(80);
        }

        status(): { Busy: boolean, Calibrated: boolean } {
            const buf = pins.i2cReadBuffer(this.i2caddr, 1, false);
            const busy = buf[0] & 0x80 ? true : false;
            const calibrated = buf[0] & 0x08 ? true : false;
            return { Busy: busy, Calibrated: calibrated };
        }

        public read(): TemperatureHumidity {

            const th: TemperatureHumidity = {Temperature: 999, Humidity: 999}

            if (!this.status().Calibrated) {
                this.init();
                if (!this.status().Calibrated) return th;
            }

            this.measure();
            for (let i = 0; ; ++i) {
                if (!this.status().Busy) break;
                if (i >= 500) return th;
                basic.pause(10);
            }
            const buf = pins.i2cReadBuffer(this.i2caddr, 7, false);

            const crc8 = this.crc8(buf, 0, 6);
            if (buf[6] != crc8) return th;

            let humidity = ((buf[1] << 12) + (buf[2] << 4) + (buf[3] >> 4)) * 100 / 1048576;
            let temperature = (((buf[3] & 0x0f) << 16) + (buf[4] << 8) + buf[5]) * 200 / 1048576 - 50;
            humidity = Math.round(humidity)
            temperature = Math.round(temperature)

            return { Temperature: temperature, Humidity: humidity };
        }

        crc8(buf: Buffer, offset: number, size: number): number {
            let crc8 = 0xff;
            for (let i = 0; i < size; ++i) {
                crc8 ^= buf[offset + i];
                for (let j = 0; j < 8; ++j) {
                    if (crc8 & 0x80) {
                        crc8 <<= 1;
                        crc8 ^= 0x31;
                    }
                    else {
                        crc8 <<= 1;
                    }
                    crc8 &= 0xff;
                }
            }

            return crc8;
        }

    }

    export function create(address: number = 0x38): Device {
        let device = new Device(address)
        return device
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

///////////////////
//  INCLUDE      //
//  ledstrip.ts  //
///////////////////

enum NeopixelMode {
    GRB = 1,
    RGBW = 2,
    RGB = 3
}

namespace Ledstrip {

    export class Device {

        pin: DigitalPin
        max: number
        mode: NeopixelMode
        buffer: Buffer
        size: number
        bright: number = 10

        constructor(pin: DigitalPin, leds: number, mode: NeopixelMode) {
            this.pin = pin
            this.max = leds - 1
            this.mode = mode
            this.size = leds * (mode == NeopixelMode.RGBW ? 4 : 3)
            this.buffer = pins.createBuffer(this.size)
        }

        show() {
            light.sendWS2812Buffer(this.buffer, this.pin)
        }

        setPixelRGB(offset: number, red: number, green: number, blue: number, white: number = 0): void {
            offset *= (this.mode == NeopixelMode.RGBW ? 4 : 3)
            switch (this.mode) {
                case NeopixelMode.GRB:
                    this.buffer[offset + 0] = Math.floor(green * this.bright / 100)
                    this.buffer[offset + 1] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    break;
                case NeopixelMode.RGB:
                    this.buffer[offset + 0] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 1] = Math.floor(green * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    break;
                case NeopixelMode.RGBW:
                    this.buffer[offset + 0] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 1] = Math.floor(green * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    this.buffer[offset + 3] = Math.floor(white * this.bright / 100);
                    break;
            }
        }

        setPixelColor(pixel: number, color: Color, white: number = 0): void {
            if (pixel < 0 || pixel >= 8)
                return;
            let rgb = fromColor(color)
            let red = (rgb >> 16) & 0xFF;
            let green = (rgb >> 8) & 0xFF;
            let blue = (rgb) & 0xFF;
            this.setPixelRGB(pixel, red, green, blue, white)
        }

        setRGB(red: number, green: number, blue: number, white: number = 0) {
            for (let i = 0; i < 8; ++i)
                this.setPixelRGB(i, red, green, blue, white)
        }

        setColor(color: Color, white: number = 0) {
            let rgb = fromColor(color)
            let red = (rgb >> 16) & 0xFF;
            let green = (rgb >> 8) & 0xFF;
            let blue = (rgb) & 0xFF;
            for (let i = 0; i < 8; ++i)
                this.setPixelRGB(i, red, green, blue, white)
        }

        setClear(): void {
            this.buffer.fill(0, 0, this.size);
        }

        setBrightness(brightness: number) {
            if (brightness < 0) brightness = 0
            if (brightness > 100) brightness = 100
            // small steps at low brightness and big steps at high brightness
            brightness = (brightness ^ 2 / 100)
            this.bright = brightness
        }

        setRotate(rotation: Rotate): void {
            let offset = (this.mode == NeopixelMode.RGBW ? 4 : 3)
            if (rotation == Rotate.Clockwise)
                this.buffer.rotate(-offset, 0, this.size)
            else
                this.buffer.rotate(offset, 0, this.size)
        }

        rainbow(rotation: Rotate, pace: Pace = Pace.Normal) {
            if (rotation == Rotate.Clockwise) {
                this.setPixelColor(0, Color.Red)
                this.setPixelColor(1, Color.Orange)
                this.setPixelColor(2, Color.Yellow)
                this.setPixelColor(3, Color.Green)
                this.setPixelColor(4, Color.Blue)
                this.setPixelColor(5, Color.Indigo)
                this.setPixelColor(6, Color.Violet)
                this.setPixelColor(7, Color.Purple)
            }
            else {
                this.setPixelColor(7, Color.Red)
                this.setPixelColor(6, Color.Orange)
                this.setPixelColor(5, Color.Yellow)
                this.setPixelColor(4, Color.Green)
                this.setPixelColor(3, Color.Blue)
                this.setPixelColor(2, Color.Indigo)
                this.setPixelColor(1, Color.Violet)
                this.setPixelColor(0, Color.Purple)
            }
            this.show()
            basic.pause(pace)
            pace = (pace + 1) * 75
            for (let i = 0; i < this.max; i++) {
                this.setRotate(rotation)
                this.show()
                basic.pause(pace)
            }
        }

        snake(color: Color, rotation: Rotate, pace: Pace = Pace.Normal) {
            let rgb = fromColor(color)
            let red = (rgb >> 16) & 0xFF;
            let green = (rgb >> 8) & 0xFF;
            let blue = (rgb) & 0xFF;
            this.setClear();
            this.show()
            pace = (pace + 1) * 75
            for (let i = this.max; i >= 0; i--) {
                if (rotation == Rotate.Clockwise)
                    this.setPixelRGB(this.max - i, red, green, blue)
                else
                    this.setPixelRGB(i, red, green, blue)
                this.show()
                basic.pause(pace)
            }
            this.show()
            for (let i = this.max - 1; i >= 0; i--) {
                if (rotation == Rotate.Clockwise)
                    this.setPixelRGB(this.max - i, 0, 0, 0)
                else
                    this.setPixelRGB(i, 0, 0, 0)
                this.show()
                basic.pause(pace)
            }
            if (rotation == Rotate.Clockwise)
                this.setPixelRGB(0, 0, 0, 0)
            else
                this.setPixelRGB(this.max, 0, 0, 0)
            this.show()
            basic.pause(pace)
        }
    }

    export function create(pin: DigitalPin, leds: number, mode: NeopixelMode = NeopixelMode.GRB): Device {
        let device = new Device(pin, leds, mode)
        return device
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

enum Illumination {
    //% block="the dark"
    //% block.loc.nl="het donker"   // 0%-25%
    Illum0,
    //% block="lamplight"
    //% block.loc.nl="lamplicht"    // 25%-50%
    Illum1,
    //% block="daylight"
    //% block.loc.nl="daglicht"     // 50%-75%
    Illum2,
    //% block="sunlight"
    //% block.loc.nl="zonlicht"     // 75%-100%
    Illum3,
}

enum Moisture {
    //% block="dry"
    //% block.loc.nl="droog"    // 0%-25%
    Moist0,
    //% block="moist"
    //% block.loc.nl="vochtig"  // 25%-50%
    Moist1,
    //% block="wet"
    //% block.loc.nl="nat"      // 50%-75%
    Moist2,
    //% block="soaking"
    //% block.loc.nl="kletsnat" // 75%-100%
    Moist3,
}

enum Lighting {
    //% block="0 %"
    //% block.loc.nl="0 %"
    Light0 = 0,
    //% block="33 %"
    //% block.loc.nl="33 %"
    Light1 = 33,
    //% block="67 %"
    //% block.loc.nl="67 %"
    Light2 = 67,
    //% block="100 %"
    //% block.loc.nl="100 %"
    Light3 = 100,
}

let illum0Handler: handler
let illum1Handler: handler
let illum2Handler: handler
let illum3Handler: handler
let moist0Handler: handler
let moist1Handler: handler
let moist2Handler: handler
let moist3Handler: handler

let LEDS = Ledstrip.create(DigitalPin.P15, 8)
let PIN_PUMP = DigitalPin.P16
let PIN_SOIL = AnalogPin.P1
let PIN_LIGHT = AnalogPin.P2
let AHT = AHT20.create()

let ETillum = 0
let ETmoist = 0

let ETdelay = 300000    // the delay between pump activations to give
let ETtime = 0          // the water time for soaking into the ground

Greenbox.swichLedsOff()
pins.digitalWritePin(PIN_PUMP, LOW)

basic.forever(function () {
    ETillum = Greenbox.illumination()
    ETmoist = Greenbox.moisture()

    if (ETillum < 25) {
        if (illum0Handler) illum0Handler()
    }
    else
    if (ETillum < 50) {
        if (illum1Handler) illum1Handler()
    }
    else
    if (ETillum < 75) {
        if (illum2Handler) illum2Handler()
    }
    else {
        if (illum3Handler) illum3Handler()
    }

    if (ETmoist < 25) {
        if (moist0Handler) moist0Handler()
    }
    else
    if (ETmoist < 50) {
        if (moist1Handler) moist1Handler()
    }
    else
    if (ETmoist < 75) {
        if (moist2Handler) moist2Handler()
    }
    else {
        if (moist3Handler) moist3Handler()
    }
})

//% color="#00CC00" icon="\uf1f9"
//% block="Breeding box"
//% block.loc.nl="Kweekbakje"
namespace Greenbox {

    export function humidity(): number {
        return AHT.read().Humidity
    }

    export function temperature(): number {
        return AHT.read().Temperature
    }

    export function illumination(): number {
        let val = pins.analogReadPin(PIN_LIGHT)
        val = pins.map(val, 0, 1023, 0, 100)
        return Math.round(val)
    }

    export function moisture(): number {
        let val = pins.analogReadPin(PIN_SOIL)
        if (val < 300) val = 300
        if (val > 750) val = 750
        val = 100 - pins.map(val, 300, 750, 0, 100)
        return Math.round(val)
    }

    //% block="turn off the light"
    //% block.loc.nl="zet de lamp uit"
    export function swichLedsOff() {
        LEDS.setColor(Color.None)
        LEDS.show()
    }

    //% block="turn on the light for %light at %color"
    //% block.loc.nl="zet de lamp aan voor %light op %color"
    export function swichLedsOn(light: Lighting, color: Color) {
        LEDS.setBrightness(light)
        LEDS.setColor(color)
        LEDS.show()
    }

    //% block="switch on the pump %sec sec"
    //% block.loc.nl="schakel de pomp %sec sec aan"
    export function swithPumpOn(sec: number) {
        if (ETtime < control.millis()) {
            pins.digitalWritePin(PIN_PUMP, HIGH)
            General.wait(sec)
            pins.digitalWritePin(PIN_PUMP, LOW)
            ETtime = control.millis() + ETdelay
        }

    }

    //% block="show the humidity"
    //% block.loc.nl="toon de luchtvochtigheid"
    export function showHumidity() {
        basic.showString("H")
        basic.clearScreen()
        basic.showString(AHT.read().Humidity.toString() + "%")
    }

    //% block="show the temperature"
    //% block.loc.nl="toon de temperatuur"
    export function showTemperature() {
        basic.showString("T")
        basic.clearScreen()
        basic.showString(AHT.read().Temperature.toString() + "C")
    }

    //% block="show the illumination"
    //% block.loc.nl="toon de hoeveelheid licht"
    export function showIllumination() {
        basic.showString("L")
        basic.clearScreen()
        basic.showString(illumination().toString() + "%")
    }

    //% block="show the moisture"
    //% block.loc.nl="toon de grondvochtigheid"
    export function showMoisture() {
        basic.showString("V")
        basic.clearScreen()
        basic.showString(moisture().toString() + "%")
    }

    //% block="wait %min between each watering"
    //% block.loc.nl="wacht %min tussen iedere bewatering"
    export function delayPump(min: number) {
        ETdelay = min * 60000
    }

    //% color="#802080"
    //% block="when the plant stands in %illum"
    //% block.loc.nl="wanneer de plant in %illum staat"
    export function onIllumination(illum: Illumination, code: () => void) {
        switch (illum) {
            case Illumination.Illum0: illum0Handler = code; break
            case Illumination.Illum1: illum1Handler = code; break
            case Illumination.Illum2: illum2Handler = code; break
            case Illumination.Illum3: illum3Handler = code; break
        }
    }

    //% color="#802080"
    //% block="when the soil is %hum"
    //% block.loc.nl="wanneer de grond %hum is"
    export function onMoisture(hum: Moisture, code: () => void) {
        switch (hum) {
            case Moisture.Moist0: moist0Handler = code; break
            case Moisture.Moist1: moist1Handler = code; break
            case Moisture.Moist2: moist2Handler = code; break
            case Moisture.Moist3: moist3Handler = code; break
        }
    }
}
