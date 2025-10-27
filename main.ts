/////////////////////
//#################//
//##             ##//
//##  eradio.ts  ##//
//##             ##//
//#################//
/////////////////////

let RADIOID = "ID"
let MSGEND = "#EOM#"
let bsyids: string[] = []
let rdymsgs: string[] = []
let bsymsgs: string[] = []

type readhandler = () => void
let readHandler: readhandler

radio.onReceivedString(function (msg: string) {
    // mbit radio buffer size is 19
    // msg format:
    // -----------
    // char 0 :             id length
    // char 1..n :          id
    // char (18 - n)..19 :  msg chunk 
    let idlen: number = +msg.substr(0, 1)
    msg = msg.substr(1)
    let id = msg.substr(0, idlen)
    msg = msg.substr(idlen)
    let ix = 0
    for (; ix < bsyids.length; ix++) {
        if (id == bsyids[ix]) break
    }
    if (ix == bsyids.length) {
        bsyids.push(id)
        bsymsgs.push("") // is handled at the end by 'bsymsgs[ix] += msg'
    }
    if (msg == MSGEND) { // end of message
        rdymsgs.push(bsymsgs[ix])
        bsymsgs.removeAt(ix)
        bsyids.removeAt(ix)
        if (readHandler) readHandler()
        return
    }
    bsymsgs[ix] += msg
})

namespace ERadio {

    export function readMessage(): string {
        let msg = rdymsgs.shift()
        return msg
    }

    export function writeMessage(msg: string) {
        // mbit radio buffer size is 19
        // chunk format:
        // -------------
        // char 0 :             id length
        // char 1..n :          id
        // char (18 - n)..19 :  msg chunk 

        let idlen = RADIOID.length
        let chunk: string
        let chunklen = 18 - idlen // 19 is mbit radio buffer size
        do {
            chunk = msg.substr(0, chunklen)
            msg = msg.substr(chunklen)
            radio.sendString(idlen.toString() + RADIOID + chunk)
            basic.pause(1)
        } while (msg.length > 0)
        radio.sendString(idlen.toString() + RADIOID + MSGEND)
    }

    // for senders only
    export function setId(id: string) {
        RADIOID = id
    }
}


////////////////////
//################//
//##            ##//
//##  DHT22.ts  ##//
//##            ##//
//################//
////////////////////

/*
The DHT code is a refactory of an older version of the tinkertanker library:
https://github.com/tinkertanker/pxt-iot-environment-kit/releases/tag/v5.2.7
(MIT-license)
Note that the latest release does not work
*/

type TemperatureHumidity = number[]

const Temperature = 0
const Humidity = 1

namespace DHT22 {

    export class Device {

        pin: DigitalPin
        th: TemperatureHumidity = [0, 0]
        thvalid: boolean = true

        constructor(pin: DigitalPin) {
            this.pin = pin
        }

        waitPin(status: number, timeout: number): boolean {
            timeout += control.millis()
            while (control.millis() < timeout) {
                if (pins.digitalReadPin(this.pin) == status)
                    return true
            }
            return false
        }

        read(): TemperatureHumidity {
            //initialize
            let checksum: number = 0
            let checksumTmp: number = 0
            let dataArray: boolean[] = []
            let resultArray: number[] = []
            let temp = -999
            let hum = -999

            for (let index = 0; index < 40; index++) dataArray.push(false)
            for (let index = 0; index < 5; index++) resultArray.push(0)

            //request data
            pins.digitalWritePin(this.pin, 0) //begin protocol, pull down pin
            control.waitMicros(20000)

            pins.setPull(this.pin, PinPullMode.PullUp) //pull up data pin if needed
            pins.digitalReadPin(this.pin) //pull up pin
            control.waitMicros(40)

            if (pins.digitalReadPin(this.pin) != 1) {
                if (!this.waitPin(1, 100)) return this.th
                if (!this.waitPin(0, 100)) return this.th
                //read data (5 bytes)
                for (let index = 0; index < 40; index++) {
                    if (!this.waitPin(0, 100)) return this.th
                    if (!this.waitPin(1, 100)) return this.th
                    control.waitMicros(28)
                    //if sensor still pull up data pin after 28 us it means 1, otherwise 0
                    if (pins.digitalReadPin(this.pin) == 1) dataArray[index] = true
                }

                //convert byte number array to integer
                for (let index = 0; index < 5; index++)
                    for (let index2 = 0; index2 < 8; index2++)
                        if (dataArray[8 * index + index2]) resultArray[index] += 2 ** (7 - index2)

                //verify checksum
                checksumTmp = resultArray[0] + resultArray[1] + resultArray[2] + resultArray[3]
                checksum = resultArray[4]
                if (checksumTmp >= 512) checksumTmp -= 512
                if (checksumTmp >= 256) checksumTmp -= 256
                if (checksum == checksumTmp) {
                    let temp_sign: number = 1
                    if (resultArray[2] >= 128) {
                        resultArray[2] -= 128
                        temp_sign = -1
                    }
                    hum = (resultArray[0] * 256 + resultArray[1]) / 10
                    hum = Math.round(hum)
                    temp = (resultArray[2] * 256 + resultArray[3]) / 10 * temp_sign
                    temp = Math.round(temp)
                }
            }

            if (temp == -999) {
                this.thvalid = false
                return this.th
            }

            this.th = [temp, hum]
            this.thvalid = true

            return this.th
        }

        valid(): boolean {
            return this.thvalid
        }
    }

    export function create(pin: DigitalPin): Device {
        let device = new Device(pin)
        return device
    }
}


///////////////////////
//###################//
//##               ##//
//##  ledstrip.ts  ##//
//##               ##//
//###################//
///////////////////////

enum LEDSixelMode {
    GRB = 1,
    RGBW = 2,
    RGB = 3
}

namespace Ledstrip {

    export class Device {

        pin: DigitalPin
        mode: LEDSixelMode
        buffer: Buffer
        size: number
        bright: number = 10

        constructor(pin: DigitalPin, leds: number, mode: LEDSixelMode) {
            this.pin = pin
            this.mode = mode
            this.size = leds * (mode == LEDSixelMode.RGBW ? 4 : 3)
            this.buffer = pins.createBuffer(this.size)
        }

        show() {
            light.sendWS2812Buffer(this.buffer, this.pin)
        }

        setPixelRGB(offset: number, red: number, green: number, blue: number, white: number = 0): void {
            offset *= (this.mode == LEDSixelMode.RGBW ? 4 : 3)
            switch (this.mode) {
                case LEDSixelMode.GRB:
                    this.buffer[offset + 0] = Math.floor(green * this.bright / 100)
                    this.buffer[offset + 1] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    break;
                case LEDSixelMode.RGB:
                    this.buffer[offset + 0] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 1] = Math.floor(green * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    break;
                case LEDSixelMode.RGBW:
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
            let offset = (this.mode == LEDSixelMode.RGBW ? 4 : 3)
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
            for (let i = 0; i < 7; i++) {
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
            for (let i = 7; i >= 0; i--) {
                if (rotation == Rotate.Clockwise)
                    this.setPixelRGB(7 - i, red, green, blue)
                else
                    this.setPixelRGB(i, red, green, blue)
                this.show()
                basic.pause(pace)
            }
            this.show()
            for (let i = 6; i >= 0; i--) {
                if (rotation == Rotate.Clockwise)
                    this.setPixelRGB(7 - i, 0, 0, 0)
                else
                    this.setPixelRGB(i, 0, 0, 0)
                this.show()
                basic.pause(pace)
            }
            if (rotation == Rotate.Clockwise)
                this.setPixelRGB(0, 0, 0, 0)
            else
                this.setPixelRGB(7, 0, 0, 0)
            this.show()
            basic.pause(pace)
        }
    }

    export function create(pin: DigitalPin, leds: number, mode: LEDSixelMode = LEDSixelMode.GRB): Device {
        let device = new Device(pin, leds, mode)
        return device
    }
}


///////////////////////
//###################//
//##               ##//
//##  greenbox.ts  ##//
//##               ##//
//###################//
///////////////////////

let SENDDASHBOARD = false
basic.showArrow(ArrowNames.West)

enum Measurement {
    //% block="temperature"
    //% block.loc.nl="temperatuur"
    Temperature = 0xFF0000,
    //% block="humitidy"
    //% block.loc.nl="luchtvochtigheid"
    Humidity = 0xFFA500,
    //% block="moisture"
    //% block.loc.nl="bodemvochtigheid"
    Moisture = 0xFFFF00,
    //% block="illuminance"
    //% block.loc.nl="verlichting"
    Illuminance = 0x00FF00
}

runHandler = () => {
    SENDDASHBOARD = true
    basic.showIcon(IconNames.Heart)
}

stopHandler = () => {
    SENDDASHBOARD = false
    basic.showArrow(ArrowNames.West)
}

displayHandler = () => {
    SENDDASHBOARD = false
    basic.showArrow(ArrowNames.West)
}

//% color="#00CC00" icon="\ue4bc"
//% block="Breeding box"
//% block.loc.nl="Kweekbakje"
namespace GreenBox {

    let PIN_SOIL = AnalogPin.P1
    let PIN_LIGHT = AnalogPin.P2
    let PIN_PUMP = DigitalPin.P16

    let LEDS = Ledstrip.create(DigitalPin.P15, 8)
    export let TEMPERATURE = DHT22.create(DigitalPin.P14)

    export let ID: string = ""
    export let APIKEY: string = ""
    export let TEMPHUM: TemperatureHumidity = [0, 0]
    export let PUMP: number = 0
    export let MOISTURE: number = 0
    export let LIGHT: number = 0

    basic.forever(function() {
        TEMPHUM = TEMPERATURE.read()

        let voltL = pins.analogReadPin(PIN_LIGHT)
        let valueL = pins.map(voltL, 0, 1023, 0, 100)
        LIGHT = Math.round(valueL)

        // the moisture sensor gives values from 136 to 236
        // value 136 means fully soaken, 237 means fully dry
        let voltS = pins.analogReadPin(PIN_SOIL)
        if (voltS < 300) voltS = 300
        if (voltS > 750) voltS = 750
        let valueS = 100 - pins.map(voltS, 300, 750, 0, 100)
        MOISTURE = Math.round(valueS)

        basic.pause(5000)
    })

    //% block="dashboard id is %id and api-key is %apikey"
    //% block.loc.nl="dashboard id is %id en api-key is %apikey"
    export function setDashboard(id: string, apikey: string) {
        ERadio.setId(id)
        APIKEY = apikey
    }

    //% block="send to the dashboard"
    //% block.loc.nl="verzend naar het dashboard"
    export function sendToDashboard() {
        if (!SENDDASHBOARD) return
        // route:
        // this greenbox >> rpi/mbit with greenbox-iot >> thingspeak dashboard
        basic.showIcon(IconNames.SmallHeart)
        let dat = "apikey=" + GreenBox.APIKEY + ";"
        dat += "field1=" + GreenBox.MOISTURE + ";"
        dat += "field2=" + GreenBox.LIGHT + ";"
        dat += "field3=" + GreenBox.TEMPHUM[Humidity] + ";"
        dat += "field4=" + GreenBox.TEMPHUM[Temperature] + ";"
        dat += "field5=" + GreenBox.PUMP + ";"
        ERadio.writeMessage(dat)
        basic.showIcon(IconNames.Heart)
    }

    //% block="display %value"
    //% block.loc.nl="toon %value"
    export function display(value: Measurement) {
        if (!SENDDASHBOARD) return
        let str = ""
        switch (value) {
            case Measurement.Temperature:
                basic.showString("T")
                str = Math.round(TEMPHUM[Temperature]).toString() + "C"
                break
            case Measurement.Humidity:
                basic.showString("R")
                str = Math.round(TEMPHUM[Humidity]).toString() + "%"
                break
            case Measurement.Moisture:
                basic.showString("M")
                str = MOISTURE.toString() + "%"
                break
            case Measurement.Illuminance:
                basic.showString("L")
                str = LIGHT.toString() + "%"
                break
        }
        basic.pause(500)
        basic.showString(" " + str)
    }

    //% block="turn the pump %state"
    //% block.loc.nl="schakel de pomp %state"
    export function pump(state: State) {
        if (state == State.On) {
            pins.digitalWritePin(PIN_PUMP, 1)
            PUMP = 1
        }
        else {
            pins.digitalWritePin(PIN_PUMP, 0)
            PUMP = 0
        }
    }

    //% block="set the light color to %color with brightness %brightness \\%"
    //% block.loc.nl="stel de lichtkleur in op %color met helderheid %brightness \\%"
    //% brightness.min=0 brightness.max=100 brightness.defl=100
    export function setColor(color: Color, brightness: number) {
        LEDS.setColor(color);
        LEDS.setBrightness(brightness)
        LEDS.show()
    }

    //% block="amount of illumination"
    //% block.loc.nl="hoeveelheid licht"
    export function illumination(): number {
        return LIGHT
    }

    //% block="moisture"
    //% block.loc.nl="grondvochtigheid"
    export function moisture(): number {
        return MOISTURE
    }

    //% block="humidity"
    //% block.loc.nl="luchtvochtigheid"
    export function humidity(): number {
        return TEMPHUM[Humidity]
    }

    //% block="temperature"
    //% block.loc.nl="temperatuur"
    export function temperature(): number {
        return TEMPHUM[Temperature]
    }

    //% subcategory="Waardes"
    //% block="bone-dry"
    //% block.loc.nl="kurkdroog"
    export function moisture0(): number {
        return 25
    }

    //% subcategory="Waardes"
    //% block="dry"
    //% block.loc.nl="droog"
    export function moisture1(): number {
        return 50
    }

    //% subcategory="Waardes"
    //% block="moist"
    //% block.loc.nl="vochtig"
    export function moisture2(): number {
        return 65
    }

    //% subcategory="Waardes"
    //% block="wet"
    //% block.loc.nl="nat"
    export function moisture3(): number {
        return 80
    }

    //% subcategory="Waardes"
    //% block="soaking"
    //% block.loc.nl="doornat"
    export function moisture4(): number {
        return 95
    }

    //% subcategory="Waardes"
    //% block="dark"
    //% block.loc.nl="donker"
    export function light0(): number {
        return 25
    }

    //% subcategory="Waardes"
    //% block="dusk"
    //% block.loc.nl="schemer"
    export function light1(): number {
        return 50
    }

    //% subcategory="Waardes"
    //% block="lucid"
    //% block.loc.nl="helder"
    export function light2(): number {
        return 65
    }

    //% subcategory="Waardes"
    //% block="bright"
    //% block.loc.nl="fel"
    export function light3(): number {
        return 80
    }

    //% subcategory="Waardes"
    //% block="off"
    //% block.loc.nl="uit"
    export function off(): number {
        return 0
    }

    //% subcategory="Waardes"
    //% block="on"
    //% block.loc.nl="aan"
    export function on(): number {
        return 100
    }
}
