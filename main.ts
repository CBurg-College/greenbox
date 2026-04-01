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
    //% block="dark"
    //% block.loc.nl="donker"
    Illum0,
    //% block="dusk"
    //% block.loc.nl="schemer"
    Illum1,
    //% block="lucid"
    //% block.loc.nl="helder"
    Illum2,
    //% block="bright"
    //% block.loc.nl="fel"
    Illum3,
}

enum Moisture {
    //% block="bone-dry"
    //% block.loc.nl="kurkdroog"
    Moist0,
    //% block="dry"
    //% block.loc.nl="droog"
    Moist1,
    //% block="moist"
    //% block.loc.nl="vochtig"
    Moist2,
    //% block="wet"
    //% block.loc.nl="nat"
    Moist3,
    //% block="soaking"
    //% block.loc.nl="doornat"
    Moist4,
}

enum Lighting {
    //% block="0 %"
    //% block.loc.nl="0 %"
    Light0,
    //% block="25 %"
    //% block.loc.nl="25 %"
    Light1,
    //% block="50 %"
    //% block.loc.nl="50 %"
    Light2,
    //% block="75 %"
    //% block.loc.nl="75 %"
    Light3,
    //% block="100 %"
    //% block.loc.nl="100 %"
    Light4,
}

enum Pump {
    //% block="on"
    //% block.loc.nl="aan"
    Off,
    //% block="off"
    //% block.loc.nl="uit"
    On,
}

let illum0Handler: handler
let illum1Handler: handler
let illum2Handler: handler
let illum3Handler: handler
let moist0Handler: handler
let moist1Handler: handler
let moist2Handler: handler
let moist3Handler: handler
let moist4Handler: handler

let LEDS = Ledstrip.create(DigitalPin.P15, 8)
let PIN_PUMP = DigitalPin.P16
let PIN_SOIL = AnalogPin.P1
let PIN_LIGHT = AnalogPin.P2

let ETillum = 0
let ETmoist = 0

basic.forever(function () {
    ETillum = pins.analogReadPin(PIN_LIGHT)
    ETmoist = pins.analogReadPin(PIN_SOIL)

    // illumination values: 25 50 75
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


    // moisture values: 25 45 65 85
    if (ETmoist < 25) {
        if (moist0Handler) moist0Handler()
    }
    else
        if (ETmoist < 45) {
            if (moist1Handler) moist1Handler()
        }
        else
            if (ETmoist < 65) {
                if (moist2Handler) moist2Handler()
            }
            else
                if (ETmoist < 85) {
                    if (moist3Handler) moist3Handler()
                }
    if (moist3Handler) moist3Handler()
})

//% color="#00CC00" icon="\uf1f9"
//% block="Breeding box"
//% block.loc.nl="Kweekbakje"
namespace Greenbox {

    //% block="turn %status the pump"
    //% block.loc.nl="doe de pomp %status"
    export function swithPump(status: Pump) {
        pins.digitalWritePin(PIN_PUMP, status)
    }

    //% block="turn the light for %light at %color"
    //% block.loc.nl="zet de lamp voor %light op %color"
    export function swichLeds(light: Lighting, color: Color) {
        LEDS.setBrightness(light * 25)
        LEDS.setColor(color)
        LEDS.show()
    }

    //% block="show illumination"
    //% block.loc.nl="toon hoeveel licht"
    export function showIllumination() {
        basic.showString("L")
        basic.clearScreen()
        basic.showNumber(pins.analogReadPin(PIN_LIGHT))
    }

    //% block="show moisture"
    //% block.loc.nl="toon hoeveel grondvocht"
    export function showMoisture() {
        basic.showString("V")
        basic.clearScreen()
        basic.showNumber(pins.analogReadPin(PIN_SOIL))
    }

    //% block="when it is %illum in the room"
    //% block.loc.nl="wanneer het in de kamer %illum is"
    export function onIllumination(illum: Illumination, code: () => void) {
        switch (illum) {
            case Illumination.Illum0: illum0Handler = code; break
            case Illumination.Illum1: illum1Handler = code; break
            case Illumination.Illum2: illum2Handler = code; break
            case Illumination.Illum3: illum3Handler = code; break
        }
    }

    //% block="when the soil is %hum"
    //% block.loc.nl="wanneer de grond %hum is"
    export function onMoisture(hum: Moisture, code: () => void) {
        switch (hum) {
            case Moisture.Moist0: moist0Handler = code; break
            case Moisture.Moist1: moist1Handler = code; break
            case Moisture.Moist2: moist2Handler = code; break
            case Moisture.Moist3: moist3Handler = code; break
            case Moisture.Moist4: moist4Handler = code; break
        }
    }
}


//##################################

basic.forever(function () {
    Greenbox.showIllumination()
    Greenbox.showMoisture()
})
