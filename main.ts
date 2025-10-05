//////////////////////
//##################//
//##              ##//
//##  esp8266.ts  ##//
//##              ##//
//##################//
//////////////////////


namespace ESP8266 {
    /*
    The ESP8266 code is copied from the ElecFreaks 'esp8266-iot.ts' library:
    https://github.com/elecfreaks/pxt-iot-environment-kit/blob/master/esp8266-iot.ts
    (MIT-license)
    */

    enum Cmd {
        None,
        ConnectWifi,
        ConnectThingSpeak,
        ConnectSmartIot,
        InitSmartIot,
        UploadSmartIot,
        DisconnectSmartIot,
        ConnectMqtt,
    }

    export enum SmartIotSwitchState {
        //% block="on"
        on = 1,
        //% block="off"
        off = 2
    }

    export enum SchemeList {
        //% block="TCP"
        TCP = 1,
        //% block="TLS"
        TLS = 2
    }

    export enum QosList {
        //% block="0"
        Qos0 = 0,
        //% block="1"
        Qos1,
        //% block="2"
        Qos2
    }

    let wifi_connected: boolean = false
    let thingspeak_connected: boolean = false
    let smartiot_connected: boolean = false
    let mqttBrokerConnected: boolean = false
    let userToken_def: string = ""
    let topic_def: string = ""
    const mqttSubscribeHandlers: { [topic: string]: (message: string) => void } = {}
    const mqttSubscribeQos: { [topic: string]: number } = {}
    let mqtthost_def = "ELECFREAKS"
    let iftttkey_def = ""
    let iftttevent_def = ""
    let thingSpeakDatatemp = ""

    let serialCnt = 0
    let recvString = ""
    let scanWIFIAPFlag = 0
    let currentCmd: Cmd = Cmd.None

    const THINGSPEAK_HOST = "api.thingspeak.com"
    const THINGSPEAK_PORT = "80"
    const SMARTIOT_HOST = "47.239.108.37"
    const SMARTIOT_PORT = "8081"
    // export function change(a:any,b:any){
    //     SMARTIOT_HOST = a
    //     SMARTIOT_PORT = b
    // }

    const EspEventSource = 3000
    const EspEventValue = {
        None: Cmd.None,
        ConnectWifi: Cmd.ConnectWifi,
        ConnectThingSpeak: Cmd.ConnectThingSpeak,
        ConnectSmartIot: Cmd.ConnectSmartIot,
        InitSmartIot: Cmd.InitSmartIot,
        UploadSmartIot: Cmd.UploadSmartIot,
        DisconnectSmartIot: Cmd.DisconnectSmartIot,
        ConnectMqtt: Cmd.ConnectMqtt,
        PostIFTTT: 255
    }
    const SmartIotEventSource = 3100
    const SmartIotEventValue = {
        switchOn: SmartIotSwitchState.on,
        switchOff: SmartIotSwitchState.off
    }

    let TStoSendStr = ""

    // write AT command with CR+LF ending
    function sendAT(command: string, wait: number = 0) {
        serial.writeString(`${command}\u000D\u000A`)
        basic.pause(wait)
    }

    function restEsp8266() {

        sendAT("AT+RESTORE", 1000) // restore to factory settings
        sendAT("AT+RST", 1000) // rest
        serial.readString()
        sendAT("AT+CWMODE=1", 500) // set to STA mode
        sendAT("AT+SYSTIMESTAMP=1634953609130", 100) // Set local timestamp.
        sendAT(`AT+CIPSNTPCFG=1,8,"ntp1.aliyun.com","0.pool.ntp.org","time.google.com"`, 100)
        basic.pause(3000)
    }

    function scanWIFIAP(ssid: string) {

        let scanflag = 0
        let mscnt = 0
        recvString = " "
        sendAT(`AT+CWLAPOPT=1,2,-100,255`)
        sendAT(`AT+CWLAP`)
        while (!(scanflag)) {

            recvString = recvString + serial.readString()
            basic.pause(1)
            mscnt += 1
            if (mscnt >= 3000) {
                scanWIFIAPFlag = 0
                break
            }

            if (recvString.includes("+CWLAP:(")) {

                mscnt = 0
                recvString = recvString.slice(recvString.indexOf("+CWLAP:("))
                scanflag = 1
                while (1) {

                    recvString += serial.readString()
                    basic.pause(1)
                    mscnt += 1

                    // OLED.clear()
                    // OLED.writeStringNewLine(_recvString)
                    if (recvString.includes("OK") || mscnt >= 3000) {

                        if (mscnt >= 3000) {
                            scanWIFIAPFlag = 0
                        } else if (recvString.includes(ssid)) {
                            scanWIFIAPFlag = 1
                        } else {
                            scanWIFIAPFlag = 0
                        }
                        break
                    }
                }
            }

        }
        recvString = " "
    }

    /**
     * Initialize ESP8266 module
     */
    export function initWIFI(tx: SerialPin, rx: SerialPin, baudrate: BaudRate) {

        serial.redirect(tx, rx, BaudRate.BaudRate115200)
        basic.pause(100)
        serial.setTxBufferSize(128)
        serial.setRxBufferSize(128)
        restEsp8266()
    }

    /**
     * connect to Wifi router
     */
    export function connectWifi(ssid: string, pw: string) {

        while (1) {
            scanWIFIAP(ssid)
            if (scanWIFIAPFlag) {
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`) // connect to Wifi router
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                while (!wifi_connected) {
                    restEsp8266()
                    sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                    control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                }
                break
            } else {
                restEsp8266()
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                if (wifi_connected) {
                    break
                }
            }
        }
    }

    /**
     * Warning: Deprecated.
     * Check if ESP8266 successfully connected to Wifi
     */
    export function wifiState(state: boolean) {
        return wifi_connected === state
    }

    /**
     * Connect to ThingSpeak
     */
    export function connectThingSpeak() {

        thingspeak_connected = true
        // connect to server
        // recvString = " "
        // serialCnt = 0
        // sendAT(`AT+CIPSTART="TCP","${THINGSPEAK_HOST}",${THINGSPEAK_PORT}`)
        // currentCmd = Cmd.ConnectThingSpeak
        // basic.pause(1)
        // recvString += serial.readString()
        // if (recvString == " ") {
        //     thingspeak_connected = false
        //     //basic.showIcon(IconNames.Sad)
        // } else {
        //     control.waitForEvent(EspEventSource, EspEventValue.ConnectThingSpeak)

        // } 
    }

    /**
     * Set data
     */
    export function setData(write_api_key: string, n1: number = 0, n2: number = 0, n3: number = 0, n4: number = 0, n5: number = 0, n6: number = 0, n7: number = 0, n8: number = 0) {

        TStoSendStr = "AT+HTTPCLIENT=2,0,\"http://api.thingspeak.com/update?api_key="
            + write_api_key
            + "&field1="
            + n1
            + "&field2="
            + n2
            + "&field3="
            + n3
            + "&field4="
            + n4
            + "&field5="
            + n5
            + "&field6="
            + n6
            + "&field7="
            + n7
            + "&field8="
            + n8
            + "\",,,1"
    }

    /**
     * upload data to ThingSpeak.
     */
    export function uploadData() {

        let mscnt2 = 0
        //sendAT(`AT+CIPSEND=${TStoSendStr.length + 2}`, 300)
        sendAT(TStoSendStr, 100) // upload data

        while (1) {
            recvString += serial.readString()
            basic.pause(1)
            mscnt2 += 1

            // OLED.clear()
            // OLED.writeStringNewLine(_recvString)
            if (recvString.includes("OK") || mscnt2 >= 3000 || recvString.includes("ERROR")) {

                break
            }
        }

        recvString = " "
        basic.pause(200)
    }

    /*
     * Check if ESP8266 successfully connected to ThingSpeak
     */
    export function thingSpeakState(state: boolean) {
        return thingspeak_connected === state
    }

    /* ----------------------------------- smartiot ----------------------------------- */
    /*
     * Connect to smartiot
     */
    export function connectSmartiot(userToken: string, topic: string): void {
        userToken_def = userToken
        topic_def = topic
        currentCmd = Cmd.ConnectSmartIot
        sendAT(`AT+CIPSTART="TCP","${SMARTIOT_HOST}",${SMARTIOT_PORT}`)
        control.waitForEvent(EspEventSource, EspEventValue.ConnectSmartIot)
        pause(100)
        const jsonText = `{"topic":"${topic}","userToken":"${userToken}","op":"init"}`
        currentCmd = Cmd.InitSmartIot
        sendAT(`AT+CIPSEND=${jsonText.length + 2}`)
        control.waitForEvent(EspEventSource, EspEventValue.InitSmartIot)
        if (smartiot_connected) {
            sendAT(jsonText)
            control.waitForEvent(EspEventSource, EspEventValue.InitSmartIot)
        }
        pause(1500)
    }

    /**
     * upload data to smartiot
     */
    export function uploadSmartiot(data: number): void {
        data = Math.floor(data)
        const jsonText2 = `{"topic":"${topic_def}","userToken":"${userToken_def}","op":"up","data":"${data}"}`
        currentCmd = Cmd.UploadSmartIot
        sendAT(`AT+CIPSEND=${jsonText2.length + 2}`)
        control.waitForEvent(EspEventSource, EspEventValue.UploadSmartIot)
        if (smartiot_connected) {
            sendAT(jsonText2)
            control.waitForEvent(EspEventSource, EspEventValue.UploadSmartIot)
        }
        pause(1500)
    }

    /*
     * disconnect from smartiot
     */
    export function disconnectSmartiot(): void {
        if (smartiot_connected) {
            const jsonText3 = `{"topic":"${topic_def}","userToken":"${userToken_def}","op":"close"}`
            currentCmd = Cmd.DisconnectSmartIot
            sendAT("AT+CIPSEND=" + (jsonText3.length + 2))
            control.waitForEvent(EspEventSource, EspEventValue.DisconnectSmartIot)
            if (smartiot_connected) {
                sendAT(jsonText3)
                control.waitForEvent(EspEventSource, EspEventValue.DisconnectSmartIot)
            }
            pause(1500)
        }
    }

    /*
     * Check if ESP8266 successfully connected to SmartIot
     */
    export function smartiotState(state: boolean) {
        return smartiot_connected === state
    }

    export function iotSwitchEvent(state: SmartIotSwitchState, handler: () => void) {
        control.onEvent(SmartIotEventSource, state, handler)
    }

    /*----------------------------------MQTT-----------------------*/
    /*
     * Set  MQTT client
     */
    export function setMQTT(scheme: SchemeList, clientID: string, username: string, password: string, path: string): void {
        sendAT(`AT+MQTTUSERCFG=0,${scheme},"${clientID}","${username}","${password}",0,0,"${path}"`, 1000)
    }

    /*
     * Connect to MQTT broker
     */
    export function connectMQTT(host: string, port: number, reconnect: boolean): void {
        mqtthost_def = host
        const rec = reconnect ? 0 : 1
        currentCmd = Cmd.ConnectMqtt
        sendAT(`AT+MQTTCONN=0,"${host}",${port},${rec}`)
        control.waitForEvent(EspEventSource, EspEventValue.ConnectMqtt)
        Object.keys(mqttSubscribeQos).forEach(topic => {
            const qos = mqttSubscribeQos[topic]
            sendAT(`AT+MQTTSUB=0,"${topic}",${qos}`, 1000)
        })
    }

    /*
     * Check if ESP8266 successfully connected to mqtt broker
     */
    export function isMqttBrokerConnected() {
        return mqttBrokerConnected
    }

    /*
     * send message
     */
    export function publishMqttMessage(msg: string, topic: string, qos: QosList): void {
        sendAT(`AT+MQTTPUB=0,"${topic}","${msg}",${qos},0`, 1000)
        recvString = ""
    }

    /*
     * disconnect MQTT broker
     */
    export function breakMQTT(): void {
        sendAT("AT+MQTTCLEAN=0", 1000)
    }

    export function MqttEvent(topic: string, qos: QosList, handler: (message: string) => void) {
        mqttSubscribeHandlers[topic] = handler
        mqttSubscribeQos[topic] = qos
    }

    ////////// ----------------------------------- IFTTT ----------------------------------- //////////
    /*
     * set ifttt
     */
    export function setIFTTT(key: string, event: string): void {
        iftttkey_def = key
        iftttevent_def = event
    }

    /*
     * post ifttt
     */
    export function postIFTTT(value1: string, value2: string, value3: string): void {
        let sendST1 = "AT+HTTPCLIENT=3,1,\"http://maker.ifttt.com/trigger/" + iftttevent_def + "/with/key/" + iftttkey_def + "\",,,2,"
        let sendST2 = "\"{\\\"value1\\\":\\\"" + value1 + "\\\"\\\,\\\"value2\\\":\\\"" + value2 + "\\\"\\\,\\\"value3\\\":\\\"" + value3 + "\\\"}\""
        let sendST = sendST1 + sendST2
        sendAT(sendST, 1000)
        //control.waitForEvent(EspEventSource, EspEventValue.PostIFTTT)
    }

    /*
     * on serial received data
     */
    serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
        recvString += serial.readString()
        pause(1)
        serialCnt += 1

        // received smart iot data
        if (recvString.includes("switchoff")) {
            recvString = ""
            control.raiseEvent(SmartIotEventSource, SmartIotEventValue.switchOff)
        } else if (recvString.includes("switchon")) {
            recvString = ""
            control.raiseEvent(SmartIotEventSource, SmartIotEventValue.switchOn)
        }

        if (recvString.includes("MQTTSUBRECV")) {
            recvString = recvString.slice(recvString.indexOf("MQTTSUBRECV"))
            const recvStringSplit = recvString.split(",", 4)
            const topic = recvStringSplit[1].slice(1, -1)
            const message = recvStringSplit[3].slice(0, -2)
            mqttSubscribeHandlers[topic] && mqttSubscribeHandlers[topic](message)
            recvString = ""
        }

        if (recvString.includes("Congratu")) {
            recvString = ""
            control.raiseEvent(EspEventSource, EspEventValue.PostIFTTT)
        }

        switch (currentCmd) {
            case Cmd.ConnectWifi:
                if (recvString.includes("AT+CWJAP")) {
                    recvString = recvString.slice(recvString.indexOf("AT+CWJAP"))
                    if (recvString.includes("WIFI GOT IP")) {
                        wifi_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectWifi)
                    } else if (recvString.includes("ERROR")) {
                        wifi_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectWifi)
                    }
                }
                break
            case Cmd.ConnectThingSpeak:
                if (recvString.includes(THINGSPEAK_HOST)) {
                    recvString = recvString.slice(recvString.indexOf(THINGSPEAK_HOST))
                    if (recvString.includes("CONNECT")) {
                        thingspeak_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectThingSpeak)
                    } else if (recvString.includes("ERROR")) {
                        thingspeak_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectThingSpeak)
                    }
                } else if (recvString.includes("WIFI GOT IP")) {
                    thingspeak_connected = false
                    recvString = ""
                    control.raiseEvent(EspEventSource, EspEventValue.ConnectThingSpeak)
                }
                break
            case Cmd.ConnectSmartIot:
                if (recvString.includes(SMARTIOT_HOST)) {
                    recvString = recvString.slice(recvString.indexOf(SMARTIOT_HOST))
                    if (recvString.includes("CONNECT")) {
                        smartiot_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectSmartIot)
                    } else if (recvString.includes("ERROR")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectSmartIot)
                    }
                }
                break
            case Cmd.InitSmartIot:
                if (recvString.includes("AT+CIPSEND")) {
                    recvString = recvString.slice(recvString.indexOf("AT+CIPSEND"))
                    if (recvString.includes("OK")) {
                        smartiot_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.InitSmartIot)
                    } else if (recvString.includes("ERROR")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.InitSmartIot)
                    }
                } else {
                    if (recvString.includes("SEND OK")) {
                        smartiot_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.InitSmartIot)
                    } else if (recvString.includes("ERROR")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.InitSmartIot)
                    }
                }
                break
            case Cmd.UploadSmartIot:
                if (recvString.includes("AT+CIPSEND")) {
                    recvString = recvString.slice(recvString.indexOf("AT+CIPSEND"))
                    if (recvString.includes("OK")) {
                        smartiot_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.UploadSmartIot)
                    } else if (recvString.includes("ERROR")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.UploadSmartIot)
                    }
                } else {
                    if (recvString.includes("SEND OK")) {
                        smartiot_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.UploadSmartIot)
                    } else if (recvString.includes("ERROR")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.UploadSmartIot)
                    }
                }
                break
            case Cmd.DisconnectSmartIot:
                if (recvString.includes("AT+CIPSEND")) {
                    recvString = recvString.slice(recvString.indexOf("AT+CIPSEND"))
                    if (recvString.includes("OK")) {
                        smartiot_connected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.DisconnectSmartIot)
                    } else if (recvString.includes("ERROR")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.DisconnectSmartIot)
                    }
                } else {
                    if (recvString.includes("SEND OK")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.DisconnectSmartIot)
                    } else if (recvString.includes("ERROR")) {
                        smartiot_connected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.DisconnectSmartIot)
                    }
                }
                break
            case Cmd.ConnectMqtt:
                if (recvString.includes(mqtthost_def)) {
                    recvString = recvString.slice(recvString.indexOf(mqtthost_def))
                    if (recvString.includes("OK")) {
                        mqttBrokerConnected = true
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectMqtt)
                    } else if (recvString.includes("ERROR")) {
                        mqttBrokerConnected = false
                        recvString = ""
                        control.raiseEvent(EspEventSource, EspEventValue.ConnectMqtt)
                    }
                }
                break
        }
    })
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

        constructor(pin: DigitalPin) {
            this.pin = pin
        }

        read(): TemperatureHumidity {
            const timeout = 100
            const buffer = pins.createBuffer(40)
            const data = [0, 0, 0, 0, 0]
            let temp = 0
            let hum = 0
            let startTime = control.micros()

            // 1.start signal
            pins.digitalWritePin(this.pin, 0)
            basic.pause(18)

            // 2.pull up and wait 40us
            pins.setPull(this.pin, PinPullMode.PullUp)
            pins.digitalReadPin(this.pin)
            control.waitMicros(40)

            // 3.read data
            startTime = control.micros()
            while (pins.digitalReadPin(this.pin) === 0) {
                if (control.micros() - startTime > timeout) break
            }
            startTime = control.micros()
            while (pins.digitalReadPin(this.pin) === 1) {
                if (control.micros() - startTime > timeout) break
            }

            for (let dataBits = 0; dataBits < 40; dataBits++) {
                startTime = control.micros()
                while (pins.digitalReadPin(this.pin) === 1) {
                    if (control.micros() - startTime > timeout) break
                }
                startTime = control.micros()
                while (pins.digitalReadPin(this.pin) === 0) {
                    if (control.micros() - startTime > timeout) break
                }
                control.waitMicros(28)
                if (pins.digitalReadPin(this.pin) === 1) {
                    buffer[dataBits] = 1
                }
            }

            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 8; j++) {
                    if (buffer[8 * i + j] === 1) {
                        data[i] += 2 ** (7 - j)
                    }
                }
            }

            if (((data[0] + data[1] + data[2] + data[3]) & 0xff) === data[4]) {
                hum = (data[0] << 8) | data[1]
                hum *= 0.1
                temp = data[2] + data[3] * 0.1
            }
            return [temp, hum]
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

let TEMPERATURE = DHT22.create(DigitalPin.P14)
let LEDS = Ledstrip.create(DigitalPin.P15, 8)

//% color="#00CC00" icon="\uf1f9"
//% block="Breeding box"
//% block.loc.nl="Kweekbakje"
//% groups=['•']
namespace GreenBox {

    let PIN_SOIL = AnalogPin.P1
    let PIN_LIGHT = AnalogPin.P2
    let PIN_PUMP = DigitalPin.P16

    export let TEMPHUM: TemperatureHumidity = [0,0]
    export let PUMP: number = 0
    export let MOISTURE: number = 0
    export let LIGHT: number = 0

    export enum Measurement {
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

    //% block="display %value"
    //% block.loc.nl="toon %value"
    export function display(value: Measurement) {
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

    //% block="perform a measurement"
    //% block.loc.nl="voer een meting uit"
    export function measure() {
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

        TEMPHUM = TEMPERATURE.read()
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

    //% block="amount of light"
    //% block.loc.nl="hoeveelheid licht"
    export function light(): number {
        return LIGHT
    }

    //% block="bone-dry"
    //% block.loc.nl="kurkdroog"
    //% group="•"
    export function moisture0(): number {
        return 25
    }

    //% block="dry"
    //% block.loc.nl="droog"
    //% group="•"
    export function moisture1(): number {
        return 50
    }

    //% block="moist"
    //% block.loc.nl="vochtig"
    //% group="•"
    export function moisture2(): number {
        return 65
    }

    //% block="wet"
    //% block.loc.nl="nat"
    //% group="•"
    export function moisture3(): number {
        return 80
    }

    //% block="soaking"
    //% block.loc.nl="doornat"
    //% group="•"
    export function moisture4(): number {
        return 95
    }

    //% block="dark"
    //% block.loc.nl="donker"
    //% group="•"
    export function light0(): number {
        return 25
    }

    //% block="dusk"
    //% block.loc.nl="schemer"
    //% group="•"
    export function light1(): number {
        return 50
    }

    //% block="lucid"
    //% block.loc.nl="helder"
    //% group="•"
    export function light2(): number {
        return 65
    }

    //% block="bright"
    //% block.loc.nl="fel"
    //% group="•"
    export function light3(): number {
        return 80
    }

    //% block="off"
    //% block.loc.nl="uit"
    //% group="•"
    export function off(): number {
        return 0
    }

    //% block="on"
    //% block.loc.nl="aan"
    //% group="•"
    export function on(): number {
        return 100
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
}

//% color="#FF8800" icon="\uf1f9"
//% block="Time"
//% block.loc.nl="Tijd"
namespace CTimer {

    //% block="wait %time seconds"
    //% block.loc.nl="wacht %time seconden"
    export function waitSec(time: number) {
        basic.pause(time * 1000);
    }

    //% block="wait %time minutes"
    //% block.loc.nl="wacht %time minuten"
    export function waitMin(time: number) {
        basic.pause(time * 60000);
    }

    //% block="wait %time hours"
    //% block.loc.nl="wacht %time uren"
    export function waitHours(time: number) {
        basic.pause(time * 3600000);
    }

    /*
    The next timer code is derived from:
    https://github.com/gbraad/pxt-interval
    */

    //% block="every %time seconds"
    //% block.loc.nl="om de %time seconden"
    export function OnEverySec(time: number, cb: () => void) {
        const myTimerID = 200 + Math.randomRange(0, 100); // semi-unique
        const timerTimeout1 = 1;

        control.onEvent(myTimerID, 0, function () {
            control.inBackground(() => {
                cb()
            })
        })

        control.inBackground(() => {
            while (true) {
                control.raiseEvent(myTimerID, timerTimeout1);
                basic.pause(time * 1000);
            }
        })
    }

    //% block="every %time minutes"
    //% block.loc.nl="om de %time minuten"
    export function OnEveryMin(time: number, cb: () => void) {
        const myTimerID2 = 200 + Math.randomRange(0, 100); // semi-unique
        const timerTimeout2 = 1;

        control.onEvent(myTimerID2, 0, function () {
            control.inBackground(() => {
                cb()
            })
        })

        control.inBackground(() => {
            while (true) {
                control.raiseEvent(myTimerID2, timerTimeout2);
                basic.pause(time * 60000);
            }
        })
    }

    //% block="every %time hours"
    //% block.loc.nl="om de %time uren"
    export function OnEveryHr(time: number, cb: () => void) {
        const myTimerID3 = 200 + Math.randomRange(0, 100); // semi-unique
        const timerTimeout3 = 1;

        control.onEvent(myTimerID3, 0, function () {
            control.inBackground(() => {
                cb()
            })
        })

        control.inBackground(() => {
            while (true) {
                control.raiseEvent(myTimerID3, timerTimeout3);
                basic.pause(time * 3600000);
            }
        })
    }

}

//% color="#80350E" icon="\uf04c"
//% block="Dashboard"
//% block.loc.nl="Dashboard"
namespace Dashboard {

    export enum Dashboard {
        //% block="ThingSpeak"
        //% block.loc.nl="ThingSpeak"
        ThingSpeak
    }

    let SSID = ""
    let PASSWORD = ""
    let WRITEKEY = ""
    let READKEY = ""
    let DASHBOARD = Dashboard.ThingSpeak

    //% block="send to the dashboard"
    //% block.loc.nl="verzend naar het dashboard"
    export function upload() {
        switch (DASHBOARD) {
            case Dashboard.ThingSpeak:
                ESP8266.setData(WRITEKEY,
                    GreenBox.MOISTURE,
                    GreenBox.LIGHT,
                    GreenBox.TEMPHUM[Humidity],
                    GreenBox.TEMPHUM[Temperature],
                    GreenBox.PUMP);
                ESP8266.uploadData();
                break;
        }
    }

    //% block="connected to the dashboard"
    //% block.loc.nl="verbonden met het dashboard"
    export function connected(): boolean {
        switch (DASHBOARD) {
            case Dashboard.ThingSpeak:
                return ESP8266.thingSpeakState(true)
                break;
        }
        return false;
    }

    //% block="wifi ssid %ssid wifi password %passw dashboard writekey %wkey dashboard readkey %rkey"
    //% block="verbind met %dashb"
    export function connect(dashb: Dashboard) {
        DASHBOARD = dashb
        ESP8266.initWIFI(SerialPin.P8, SerialPin.P12, BaudRate.BaudRate115200)
        ESP8266.connectWifi(SSID, PASSWORD)
        switch (DASHBOARD) {
            case Dashboard.ThingSpeak:
                ESP8266.connectThingSpeak()
                break;
        }
    }

    //% block="wifi ssid %ssid wifi password %passw dashboard writekey %wkey dashboard readkey %rkey"
    //% block="wifi ssid %ssid wifi wachtwoord %passw dashboard writekey %wkey dashboard readkey %rkey"
    export function setcredentials(ssid: string, passw: string, wkey: string, rkey: string) {
        SSID = ssid
        PASSWORD = passw
        WRITEKEY = wkey
        READKEY = rkey
    }
}
