// Synthesizes silence and white-noise WAV fixtures used by tests.
//
// Both helpers return a Buffer containing a complete RIFF/WAVE file with a
// 44-byte header and 16-bit signed little-endian mono PCM data.

import { Buffer } from 'node:buffer';

export function encode_silence_wav(seconds: number, sampleRate: number): Buffer {
    const samples = new Int16Array(Math.floor(seconds * sampleRate));
    return wrapWavMono16(samples, sampleRate);
}

export function encode_noise_wav(seconds: number, sampleRate: number): Buffer {
    const n = Math.floor(seconds * sampleRate);
    const samples = new Int16Array(n);
    for (let i = 0; i < n; i++) samples[i] = (Math.random() * 2000 - 1000) | 0;
    return wrapWavMono16(samples, sampleRate);
}

// Synthesizes a multi-tone WAV intended as a placeholder when the TTS API is
// unavailable. The waveform is a deterministic sum of two sines plus a slow
// envelope so the resulting file is non-trivial and roughly the size of the
// real TTS output we would otherwise have used.
export function encode_tone_wav(
    seconds: number,
    sampleRate: number,
    frequencies: number[] = [220, 440],
): Buffer {
    const n = Math.floor(seconds * sampleRate);
    const samples = new Int16Array(n);
    const twoPi = Math.PI * 2;
    for (let i = 0; i < n; i++) {
        const t = i / sampleRate;
        let v = 0;
        for (const f of frequencies) v += Math.sin(twoPi * f * t);
        v /= frequencies.length;
        const env = 0.5 + 0.5 * Math.sin((twoPi * 0.5 * t) % twoPi);
        samples[i] = Math.max(-32767, Math.min(32767, (v * env * 8000) | 0));
    }
    return wrapWavMono16(samples, sampleRate);
}

function wrapWavMono16(samples: Int16Array, sr: number): Buffer {
    const dataLen = samples.byteLength;
    const buf = Buffer.alloc(44 + dataLen);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + dataLen, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(dataLen, 40);
    Buffer.from(samples.buffer).copy(buf, 44);
    return buf;
}
