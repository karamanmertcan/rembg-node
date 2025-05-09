"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rembg = void 0;
const fs = require("fs/promises");
const onnxruntime_node_1 = require("onnxruntime-node");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const gdown_1 = require("./gdown");
function getMax(buffer) {
    let max = 0;
    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] > max)
            max = buffer[i];
    }
    return max;
}
function concatFloat32Array(arrays) {
    let length = 0;
    for (const array of arrays)
        length += array.length;
    const output = new Float32Array(length);
    let outputIndex = 0;
    for (const array of arrays) {
        for (let n of array) {
            output[outputIndex] = n;
            outputIndex++;
        }
    }
    return output;
}
function binaryErosion(data, width, height, erodeSize, borderValue = 0) {
    if (data.length != width * height)
        throw new Error("Invalid data length");
    const output = [];
    const sample = (x, y) => {
        if (x < 0 || x > width - 1)
            return borderValue;
        if (y < 0 || y > height - 1)
            return borderValue;
        return data[y * width + (x % width)];
    };
    for (let i = 0; i < data.length; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        let current = true;
        for (let deltaX = -Math.floor(erodeSize / 2); deltaX < Math.ceil(erodeSize / 2); deltaX++) {
            for (let deltaY = -Math.floor(erodeSize / 2); deltaY < Math.ceil(erodeSize / 2); deltaY++) {
                if (sample(x + deltaX, y + deltaY) == false) {
                    current = false;
                    break;
                }
            }
            if (current == false)
                break;
        }
        output.push(current);
    }
    return output;
}
const exists = (path) => __awaiter(void 0, void 0, void 0, function* () { return (yield fs.stat(path).catch(() => { })) != null; });
class Rembg {
    constructor(options = {}) {
        var _a;
        this.options = options;
        this.modelDownloaded = false;
        this.promisesResolvesUntillDownloaded = [];
        this.u2netHome = (_a = process.env["U2NET_HOME"]) !== null && _a !== void 0 ? _a : path.resolve(os.homedir(), ".u2net");
        this.modelPath = path.resolve("u2net.onnx");
        this.ensureModelDownloaded();
    }
    log(message) {
        if (this.options.logging === false)
            return;
        console.log(message);
    }
    ensureModelDownloaded() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield exists(this.modelPath)) {
                this.log("U2-Net model found!");
                this.modelDownloaded = true;
            }
            else {
                this.log("U2-Net model downloading...");
                if (!(yield exists(this.u2netHome)))
                    yield fs.mkdir(this.u2netHome);
                yield (0, gdown_1.gdown)("1cfirGyz_rTJEX1etc3S5OMW5LT8vaLW5", this.modelPath);
                this.log("U2-Net model downloaded!");
                this.modelDownloaded = true;
            }
            for (const resolve of this.promisesResolvesUntillDownloaded) {
                resolve(null);
            }
        });
    }
    remove(sharpInput) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.modelDownloaded == false) {
                yield new Promise(resolve => {
                    this.promisesResolvesUntillDownloaded.push(resolve);
                });
            }
            const imageSize = 320;
            const { width, height } = yield sharpInput.metadata();
            // 0 to 255
            let inputPixels = yield sharpInput
                .clone()
                // lanczos2 is smooth, lanczos3 is sharp
                .resize(imageSize, imageSize, { kernel: "lanczos3", fit: "fill" })
                .removeAlpha()
                .raw()
                .toBuffer();
            const inputChannels = [
                new Float32Array(imageSize * imageSize),
                new Float32Array(imageSize * imageSize),
                new Float32Array(imageSize * imageSize),
            ];
            const max = getMax(inputPixels);
            const mean = [0.485, 0.456, 0.406];
            const std = [0.229, 0.224, 0.225];
            for (let i = 0; i < inputPixels.length; i++) {
                const channel = i % 3;
                const channelIndex = Math.floor(i / 3);
                inputChannels[channel][channelIndex] =
                    (inputPixels[i] / max - mean[channel]) / std[channel];
            }
            const input = concatFloat32Array([
                inputChannels[2],
                inputChannels[0],
                inputChannels[1],
            ]);
            const session = yield onnxruntime_node_1.InferenceSession.create(this.modelPath);
            const results = yield session.run({
                "input.1": new onnxruntime_node_1.Tensor("float32", input, [1, 3, 320, 320]),
            });
            const mostPreciseOutputName = String(Math.min(...session.outputNames.map(name => +name)));
            const outputMaskData = results[mostPreciseOutputName]
                .data;
            for (let i = 0; i < outputMaskData.length; i++) {
                outputMaskData[i] = outputMaskData[i] * 255;
            }
            // will make [rgb rgb rgb] unfortunately
            const sharpMask = yield sharp(outputMaskData, {
                raw: { channels: 1, width: imageSize, height: imageSize },
            })
                .resize(width, height, { fit: "fill" })
                .raw()
                .toBuffer();
            const maskData = [];
            for (let i = 0; i < sharpMask.length; i += 3)
                maskData.push(sharpMask[i]);
            const finalPixels = yield sharpInput
                .clone()
                .ensureAlpha()
                .raw({})
                .toBuffer();
            for (let i = 0; i < finalPixels.length / 4; i++) {
                let alpha = sharpMask[i * 3];
                finalPixels[i * 4 + 3] = alpha;
            }
            return sharp(finalPixels, {
                raw: { channels: 4, width, height },
            });
        });
    }
}
exports.Rembg = Rembg;
