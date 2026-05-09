use super::{AudioError, AudioSource, CaptureSession, PermissionState};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use std::io::{Cursor, Write};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use uuid::Uuid;

/// `cpal::Stream` is intentionally `!Send + !Sync` on every platform (on macOS
/// it owns CoreAudio property listeners that must stay on the thread that
/// created them). To satisfy `AudioSource: Send + Sync`, we keep each stream
/// confined to a dedicated worker thread and communicate with it through a
/// stop channel + a shared sample buffer.
pub struct MicrophoneSource {
    sessions: Arc<Mutex<Vec<ActiveSession>>>,
}

struct ActiveSession {
    id: Uuid,
    samples: Arc<Mutex<Vec<i16>>>,
    sample_rate: u32,
    stop_tx: mpsc::Sender<()>,
    worker: Option<JoinHandle<()>>,
}

impl MicrophoneSource {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

impl Default for MicrophoneSource {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioSource for MicrophoneSource {
    fn check_permission(&self) -> PermissionState {
        super::permissions::check_microphone_permission()
    }

    fn request_permission(&self) -> Result<PermissionState, AudioError> {
        super::permissions::request_microphone_permission()
    }

    fn start_capture(&self) -> Result<CaptureSession, AudioError> {
        let id = Uuid::new_v4();
        let samples: Arc<Mutex<Vec<i16>>> = Arc::new(Mutex::new(Vec::new()));
        let samples_for_worker = samples.clone();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        // Channel used by the worker to report startup success/failure and the
        // negotiated sample rate before it parks waiting for `stop_rx`.
        let (ready_tx, ready_rx) = mpsc::channel::<Result<u32, AudioError>>();

        let worker = thread::Builder::new()
            .name(format!("voxera-mic-{id}"))
            .spawn(move || {
                let host = cpal::default_host();
                let device = match host.default_input_device() {
                    Some(d) => d,
                    None => {
                        let _ = ready_tx.send(Err(AudioError::DeviceUnavailable(
                            "no default input device".into(),
                        )));
                        return;
                    }
                };
                let config = match device.default_input_config() {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = ready_tx.send(Err(AudioError::CaptureFailed(e.to_string())));
                        return;
                    }
                };
                let sample_rate = config.sample_rate().0;
                let err_fn = |err| log::error!("cpal stream error: {err}");
                let samples_clone = samples_for_worker.clone();
                let stream_result = match config.sample_format() {
                    SampleFormat::F32 => device.build_input_stream(
                        &config.into(),
                        move |data: &[f32], _: &_| {
                            let mut buf = samples_clone.lock().unwrap();
                            buf.extend(
                                data.iter()
                                    .map(|&s| (s.clamp(-1.0, 1.0) * 32767.0) as i16),
                            );
                        },
                        err_fn,
                        None,
                    ),
                    SampleFormat::I16 => device.build_input_stream(
                        &config.into(),
                        move |data: &[i16], _: &_| {
                            let mut buf = samples_clone.lock().unwrap();
                            buf.extend_from_slice(data);
                        },
                        err_fn,
                        None,
                    ),
                    other => {
                        let _ = ready_tx.send(Err(AudioError::CaptureFailed(format!(
                            "unsupported sample format {other:?}"
                        ))));
                        return;
                    }
                };
                let stream = match stream_result {
                    Ok(s) => s,
                    Err(e) => {
                        let _ = ready_tx.send(Err(AudioError::CaptureFailed(e.to_string())));
                        return;
                    }
                };
                if let Err(e) = stream.play() {
                    let _ = ready_tx.send(Err(AudioError::CaptureFailed(e.to_string())));
                    return;
                }
                if ready_tx.send(Ok(sample_rate)).is_err() {
                    return;
                }
                // Block this thread (which owns `stream`) until stop_capture is
                // called. Dropping `stream` here tears down cpal cleanly.
                let _ = stop_rx.recv();
                drop(stream);
            })
            .map_err(|e| AudioError::CaptureFailed(format!("failed to spawn worker: {e}")))?;

        let sample_rate = match ready_rx.recv() {
            Ok(Ok(rate)) => rate,
            Ok(Err(e)) => {
                let _ = worker.join();
                return Err(e);
            }
            Err(_) => {
                let _ = worker.join();
                return Err(AudioError::CaptureFailed(
                    "audio worker terminated before reporting readiness".into(),
                ));
            }
        };

        self.sessions.lock().unwrap().push(ActiveSession {
            id,
            samples,
            sample_rate,
            stop_tx,
            worker: Some(worker),
        });
        Ok(CaptureSession { id })
    }

    fn stop_capture(&self, session: &CaptureSession) -> Result<Vec<u8>, AudioError> {
        let mut active = {
            let mut sessions = self.sessions.lock().unwrap();
            let pos = sessions
                .iter()
                .position(|s| s.id == session.id)
                .ok_or_else(|| AudioError::CaptureFailed("session not found".into()))?;
            sessions.remove(pos)
        };
        // Signal the worker to drop its `Stream` and exit.
        let _ = active.stop_tx.send(());
        if let Some(handle) = active.worker.take() {
            let _ = handle.join();
        }
        let samples = active.samples.lock().unwrap().clone();
        Ok(encode_wav_pcm16(&samples, active.sample_rate))
    }
}

pub fn encode_wav_pcm16(samples: &[i16], sample_rate: u32) -> Vec<u8> {
    let bytes_per_sample = 2u32;
    let num_channels = 1u32;
    let byte_rate = sample_rate * num_channels * bytes_per_sample;
    let block_align = (num_channels * bytes_per_sample) as u16;
    let data_len = (samples.len() as u32) * bytes_per_sample;
    let mut buf = Cursor::new(Vec::with_capacity(44 + data_len as usize));
    buf.write_all(b"RIFF").unwrap();
    buf.write_all(&(36 + data_len).to_le_bytes()).unwrap();
    buf.write_all(b"WAVE").unwrap();
    buf.write_all(b"fmt ").unwrap();
    buf.write_all(&16u32.to_le_bytes()).unwrap();
    buf.write_all(&1u16.to_le_bytes()).unwrap(); // PCM
    buf.write_all(&(num_channels as u16).to_le_bytes()).unwrap();
    buf.write_all(&sample_rate.to_le_bytes()).unwrap();
    buf.write_all(&byte_rate.to_le_bytes()).unwrap();
    buf.write_all(&block_align.to_le_bytes()).unwrap();
    buf.write_all(&16u16.to_le_bytes()).unwrap(); // bits per sample
    buf.write_all(b"data").unwrap();
    buf.write_all(&data_len.to_le_bytes()).unwrap();
    for s in samples {
        buf.write_all(&s.to_le_bytes()).unwrap();
    }
    buf.into_inner()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn microphone_source_can_be_constructed() {
        let _src = MicrophoneSource::new();
    }

    #[test]
    fn wav_writer_produces_valid_header() {
        let bytes = encode_wav_pcm16(&[0, 0, 0, 0], 16000);
        assert_eq!(&bytes[..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
    }
}
