const coyoteService = "955a180b-0fe2-f5aa-a094-84b8d4f3e8ad";

const configCharacteristic = "955a1507-0fe2-f5aa-a094-84b8d4f3e8ad";
const POWER_CHARACTERISTIC = "955a1504-0fe2-f5aa-a094-84b8d4f3e8ad";
const PATTERN_A_CHARACTERISTIC = "955a1506-0fe2-f5aa-a094-84b8d4f3e8ad";
const PATTERN_B_CHARACTERISTIC = "955a1505-0fe2-f5aa-a094-84b8d4f3e8ad";

const batteryService = "955a180a-0fe2-f5aa-a094-84b8d4f3e8ad";
const batteryCharacteristic = "955a1500-0fe2-f5aa-a094-84b8d4f3e8ad";

function flipFirstAndThirdByte(buffer: ArrayBuffer): void {
    const bufferBytes = new Uint8Array(buffer);
    const b = bufferBytes[0];
    bufferBytes[0] = bufferBytes[2];
    bufferBytes[2] = b;
}

/**
 * @param {number} powerA
 * @param {number} powerB
 * @return {ArrayBuffer}
 */
export function encodePower({powerA, powerB}: CoyotePower): ArrayBuffer {
    /**
     * notify/write: 3 bytes: zero(2) ~ uint(11).as("powerLevelB") ~uint(11).as("powerLevelA")
     * 0 0 a a a a a a | a a a a a b b b | b b b b b b b b
     * Power levels must likely be a multiple of "powerStep" and between 0 and "maxPower"
     * (as obtained through config attribute.)
     */
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint8(0, (powerA >>> 5) & 0b00111111);
    view.setUint8(1, ((powerA & 0b00011111) << 3) | ((powerB & 0b11111111111) >>> 8));
    view.setUint8(2, powerB & 0b11111111);

    flipFirstAndThirdByte(buffer);
    return buffer;
}

/**
 * @return {[number, number]} powerA and powerB
 */
export function parsePower(dataView: DataView): CoyotePower {
    flipFirstAndThirdByte(dataView.buffer);
    // notify/write: 3 bytes: flipFirstAndThirdByte(zero(2) ~ uint(11).as("powerLevelB") ~uint(11).as("powerLevelA")
    const powerA = dataView.getUint16(0) >> 3; // push the remainder of B out of the first 2 bytes
    const powerB = dataView.getUint16(1) & 0b0000011111111111;  // push the remainder A out of the last 2 bytes
    return {powerA, powerB};
}

/**
 * @param {DataView} dataView
 * @return {[number, number, number]} ax ay az
 */
export function parsePattern(dataView: DataView): CoyotePattern {
    flipFirstAndThirdByte(dataView.buffer);
    // flipFirstAndThirdByte(zero(4) ~ uint(5).as("az") ~ uint(10).as("ay") ~ uint(5).as("ax"))
    // 0000zzzz | zyyyyyyy | yyyxxxxx
    const az = (dataView.getUint16(0) & 0b00001111_10000000) >>> 7;
    const ay = ((dataView.getUint16(0) & 0b00000000_01111111)) << 3
        | ((dataView.getUint8(2) & 0b11100000) >>> 5);
    const ax = (dataView.getUint8(2) & 0b00011111);
    return { dutyCycle: ax, pulseDuration: ay, amplitude: az };
}

function encodePattern({dutyCycle, pulseDuration, amplitude}: CoyotePattern): ArrayBuffer {
    const buffer = new ArrayBuffer(3);
    // flipFirstAndThirdByte(zero(4) ~ uint(5).as("az") ~ uint(10).as("ay") ~ uint(5).as("ax"))
    // 0000zzzz | zyyyyyyy | yyyxxxxx
    const view = new DataView(buffer);
    view.setUint8(0, ((amplitude & 0b00011110) >>> 1));
    view.setUint16(1, ((amplitude & 0b00000001) << 15)
        | ((pulseDuration & 0b00000011_11111111) << 5)
        | (dutyCycle & 0b00011111));

    flipFirstAndThirdByte(buffer);
    return buffer;
}

export interface CoyotePower {
    powerA: number;
    powerB: number;
}

export interface CoyotePattern {
    /** Duty Cycle (spiky) 0..32 (smooth) */
    dutyCycle: number;
    /** LFO pulse duration in milliseconds 0..1024 */
    pulseDuration: number;
    /** Amplitude, 0..32 */
    amplitude: number;
}

export interface CoyoteState {
    maxPower: number;
    powerStep: number;
    power: CoyotePower;
    patternA: CoyotePattern;
    patternB: CoyotePattern;
    batteryLevel: number;
}

export interface CoyoteDevice {
    writePower(power: CoyotePower): Promise<void>;

    writePatternA(power: CoyotePattern): Promise<void>;

    writePatternB(power: CoyotePattern): Promise<void>;

    stop(): Promise<void>;
}

/**
 * Must be triggered via user intent.
 */
export async function pairDevice(batteryChangeCallback?: (batteryLevel: number) => void,
                                 powerChangedCallback?: (power: CoyotePower) => void)
    : Promise<[CoyoteState, CoyoteDevice]> {
    const device = await navigator.bluetooth.requestDevice({
        filters: [{
            namePrefix: "D-LAB",
        }],
        optionalServices: [coyoteService, batteryService],
    });
    console.log("Connecting to GATT Server...");
    const server = await device.gatt!.connect();

    console.log("Getting Coyote Service...");
    const service = await server.getPrimaryService(coyoteService);

    console.log("Getting Config Characteristic...");
    const config = await service.getCharacteristic(configCharacteristic);

    console.log("Reading Config Characteristic...");
    // read: 3 bytes: flipFirstAndThirdByte(skip(5) ~ uint(11).as("maxPower") ~ uint8.as("powerStep"))
    const configValue = await config.readValue();
    flipFirstAndThirdByte(configValue.buffer);
    const maxPower = configValue.getUint16(0);
    const powerStep = configValue.getUint8(2);

    const powerCharacteristic = await service.getCharacteristic(POWER_CHARACTERISTIC);
    console.log("Read Power value...");
    const power = parsePower(await powerCharacteristic.readValue());

    if (powerChangedCallback) {
        console.log("Subscribing to Power value...");
        powerCharacteristic.addEventListener("characteristicvaluechanged",
            (event) => {
                const currentPower = parsePower(powerCharacteristic.value!);
                powerChangedCallback(currentPower);
            });
        await powerCharacteristic.startNotifications();
    }

    const patternACharacteristic = await service.getCharacteristic(PATTERN_A_CHARACTERISTIC);
    const patternBCharacteristic = await service.getCharacteristic(PATTERN_B_CHARACTERISTIC);

    let patternA = parsePattern(await patternACharacteristic.readValue());
    let patternB = parsePattern(await patternBCharacteristic.readValue());

    console.log("Getting Battery Service...");
    const battery = await server.getPrimaryService(batteryService);

    console.log("Getting Battery Level Characteristic...");
    const batteryLevelCharacteristic = await battery.getCharacteristic(batteryCharacteristic);
    const batteryLevel = (await batteryLevelCharacteristic.readValue()).getUint8(0);
    if (batteryChangeCallback) {
        batteryLevelCharacteristic.addEventListener("characteristicvaluechanged", (e: Event) => {
            const currentBatteryLevel = batteryLevelCharacteristic.value!.getUint8(0);
            batteryChangeCallback(currentBatteryLevel);
        });
    }

    console.log("Connected to coyote!");

    let timerHandle: number | undefined;

    function startTimer() {
        if (timerHandle !== undefined) {
            return;
        }
        timerHandle = window.setInterval(async () => {
            await patternACharacteristic.writeValue(encodePattern(patternA));
            await patternBCharacteristic.writeValue(encodePattern(patternB));
        }, 100);
    }

    function stopTimer() {
        clearInterval(timerHandle);
        timerHandle = undefined;
    }

    return [{maxPower, power, powerStep, patternA, patternB, batteryLevel}, {
        writePower(powerLevels: CoyotePower): Promise<void> {
            return powerCharacteristic.writeValue(encodePower(powerLevels));
        },
        writePatternA(pattern: CoyotePattern): Promise<void> {
            patternA = pattern;
            startTimer();
            return Promise.resolve();
        },
        writePatternB(pattern: CoyotePattern): Promise<void> {
            patternB = pattern;
            startTimer();
            return Promise.resolve();
        },
        stop(): Promise<void> {
            stopTimer();
            return powerCharacteristic.writeValue(encodePower({powerA: 0, powerB: 0}));
        },
    }];
}
