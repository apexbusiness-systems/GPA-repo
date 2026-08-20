//! Orchestration: hotkey → foreground probe → frame grab → JPEG encode → dispatch.
//! Headless by design — tray/settings UI lives in the Tauri overlay, which talks
//! to this service. All Windows API use is cfg-gated; logic is trait-mocked and
//! tested on every platform.
#![deny(unsafe_op_in_unsafe_fn)]

pub mod config;
#[cfg(windows)]
mod win_probe;
#[cfg(windows)]
pub use win_probe::WindowsForegroundProbe;

use capture::{FrameSource, RawFrame};
use config::SvcConfig;
use dispatch::{
    build_request, CoachingResponse, DispatchError, Dispatcher, HotkeyIntent, LocalObservables,
    RoiDescriptor, Transport,
};
use std::time::Instant;

/// Foreground window fast-path for title identification (§III IDENTIFY).
pub trait ForegroundProbe {
    fn foreground(&self) -> (String, String); // (process_name, window_title)
}

pub struct FixedProbe(pub String, pub String);
impl ForegroundProbe for FixedProbe {
    fn foreground(&self) -> (String, String) {
        (self.0.clone(), self.1.clone())
    }
}

/// Encode BGRA to JPEG at the configured quality (async relative to capture:
/// runs after the hot path has yielded).
pub fn encode_jpeg(frame: &RawFrame, quality: u8) -> Result<Vec<u8>, String> {
    let mut rgb = Vec::with_capacity((frame.width * frame.height * 3) as usize);
    for px in frame.bgra.as_chunks::<4>().0 {
        rgb.extend_from_slice(&[px[2], px[1], px[0]]);
    }
    let img = image::RgbImage::from_raw(frame.width, frame.height, rgb)
        .ok_or("dimension mismatch in frame buffer")?;
    let mut out = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality);
    encoder.encode_image(&img).map_err(|e| e.to_string())?;
    Ok(out)
}

/// Result of one hotkey-triggered assist, with hot-path timing for the histogram.
pub struct AssistOutcome {
    pub response: Result<CoachingResponse, DispatchError>,
    pub hot_path_ms: u64,
    pub title_slug_hint: Option<String>,
    pub vision_fallback: bool,
}

pub struct Orchestrator<S: FrameSource, P: ForegroundProbe, T: Transport> {
    config: SvcConfig,
    source: S,
    probe: P,
    dispatcher: Dispatcher<T>,
    title_id: String,
    started: Instant,
}

impl<S: FrameSource, P: ForegroundProbe, T: Transport> Orchestrator<S, P, T> {
    pub fn new(config: SvcConfig, source: S, probe: P, transport: T, title_id: String) -> Self {
        let dispatcher =
            Dispatcher::new(transport, config.max_retries, config.offline_queue_capacity);
        Self { config, source, probe, dispatcher, title_id, started: Instant::now() }
    }

    /// The hotkey handler. Hot path = grab + timestamp (budget: <50 ms p95);
    /// encode + network happen after the measurement point, off the capture loop.
    pub fn on_hotkey(
        &mut self,
        intent: HotkeyIntent,
        rois: Vec<RoiDescriptor>,
    ) -> AssistOutcome {
        let hot_start = Instant::now();
        let grabbed = self.source.grab(None);
        let hot_path_ms = hot_start.elapsed().as_millis() as u64;
        if hot_path_ms > self.config.hot_path_budget_ms {
            tracing::warn!(hot_path_ms, budget = self.config.hot_path_budget_ms, "hot path over budget");
        }

        let (process_name, window_title) = self.probe.foreground();
        let slug_hint = self.config.title_hints.get(&process_name.to_lowercase()).cloned();
        let vision_fallback = slug_hint.is_none();

        let response = match grabbed {
            Err(e) => {
                // Degrade, never crash (§1.2): capture failure = no advice this frame.
                tracing::error!(error = %e, "capture failed; no advice this frame");
                Err(DispatchError::Transport(e.to_string()))
            }
            Ok(frame) => match encode_jpeg(&frame, self.config.jpeg_quality) {
                Err(e) => Err(DispatchError::Transport(e)),
                Ok(jpeg) => {
                    let request = build_request(
                        &self.config.session_id,
                        &self.title_id,
                        self.started.elapsed().as_millis() as u64,
                        &jpeg,
                        frame.width,
                        frame.height,
                        rois,
                        intent,
                        LocalObservables {
                            process_name,
                            window_title,
                            title_slug_hint: slug_hint.clone(),
                            vision_fallback,
                        },
                    );
                    self.dispatcher.send(request)
                }
            },
        };
        AssistOutcome { response, hot_path_ms, title_slug_hint: slug_hint, vision_fallback }
    }

    pub fn queued_offline(&self) -> usize {
        self.dispatcher.queued()
    }

    pub fn flush_offline(&mut self) -> usize {
        self.dispatcher.flush()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use capture::MockFrameSource;
    use std::cell::RefCell;

    struct ScriptedTransport(RefCell<Vec<Result<(u16, String), String>>>);
    impl Transport for ScriptedTransport {
        fn post_json(&self, body: &str) -> Result<(u16, String), String> {
            // Boundary check: everything leaving the service parses as the contract.
            let parsed: serde_json::Value = serde_json::from_str(body).unwrap();
            assert_eq!(parsed["schema_version"], 1);
            assert!(parsed["audio_opus_bytes"].is_null(), "ADR-003: audio must be null");
            self.0.borrow_mut().remove(0)
        }
    }

    const OK_BODY: &str = r#"{"advice_text":"Not verified: test.","recommended_action":"none",
        "evidence_ids":[],"confidence":0.5,"source_tier":"none","not_verified":true}"#;

    fn config() -> SvcConfig {
        let mut hints = std::collections::BTreeMap::new();
        hints.insert("pathofexile2.exe".to_string(), "path-of-exile-2".to_string());
        SvcConfig {
            assist_endpoint: "https://example.functions.supabase.co/assist".into(),
            session_id: "3f1c9a4e-8b2d-4f6a-9c3e-1d5b7a9e2c4f".into(),
            title_hints: hints,
            ..SvcConfig::default()
        }
    }

    fn orchestrator(
        script: Vec<Result<(u16, String), String>>,
        probe: FixedProbe,
    ) -> Orchestrator<MockFrameSource, FixedProbe, ScriptedTransport> {
        Orchestrator::new(
            config(),
            MockFrameSource::new(64, 48),
            probe,
            ScriptedTransport(RefCell::new(script)),
            "7a2b4c6d-8e1f-4a3b-9c5d-2e4f6a8b1c3d".into(),
        )
    }

    #[test]
    fn hotkey_produces_valid_request_and_uses_process_fast_path() {
        let probe = FixedProbe("PathOfExile2.exe".into(), "Path of Exile 2".into());
        let mut orch = orchestrator(vec![Ok((200, OK_BODY.into()))], probe);
        let outcome = orch.on_hotkey(HotkeyIntent::Assist, vec![]);
        assert!(outcome.response.is_ok());
        assert_eq!(outcome.title_slug_hint.as_deref(), Some("path-of-exile-2"));
        assert!(!outcome.vision_fallback);
    }

    #[test]
    fn unknown_process_flags_vision_fallback() {
        let probe = FixedProbe("unknown.exe".into(), "Some Game".into());
        let mut orch = orchestrator(vec![Ok((200, OK_BODY.into()))], probe);
        let outcome = orch.on_hotkey(HotkeyIntent::Explain, vec![]);
        assert!(outcome.vision_fallback);
        assert_eq!(outcome.title_slug_hint, None);
    }

    #[test]
    fn offline_send_queues_and_flush_recovers() {
        let probe = FixedProbe("unknown.exe".into(), "Game".into());
        // max_retries=2 → 3 failures for the send, then 1 success for flush.
        let script = vec![
            Err("offline".into()),
            Err("offline".into()),
            Err("offline".into()),
            Ok((200, OK_BODY.into())),
        ];
        let mut orch = orchestrator(script, probe);
        assert!(orch.on_hotkey(HotkeyIntent::Assist, vec![]).response.is_err());
        assert_eq!(orch.queued_offline(), 1);
        assert_eq!(orch.flush_offline(), 1);
        assert_eq!(orch.queued_offline(), 0);
    }

    #[test]
    fn jpeg_encoder_produces_valid_jpeg() {
        let frame = RawFrame {
            bgra: vec![128; 32 * 16 * 4],
            width: 32,
            height: 16,
            ts_monotonic_ms: 1,
        };
        let jpeg = encode_jpeg(&frame, 80).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8], "JPEG SOI marker");
    }

    #[test]
    fn config_validation_rejects_bad_values() {
        use config::ConfigError;
        let mut c = config();
        c.assist_endpoint = "http://insecure".into();
        assert_eq!(c.validate(), Err(ConfigError::InsecureEndpoint));
        let mut c = config();
        c.session_id = "not-a-uuid".into();
        assert_eq!(c.validate(), Err(ConfigError::BadSessionId));
        let mut c = config();
        c.jpeg_quality = 0;
        assert_eq!(c.validate(), Err(ConfigError::BadQuality));
        assert!(config().validate().is_ok());
    }
}
