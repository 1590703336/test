// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use youtube_captions::{CaptionScraper, Digest, DigestScraper};
use youtube_captions::format::Format;
use youtube_captions::language_tags::LanguageTag;
use std::time::Duration;
use serde::Deserialize;
use serde::Serialize;

const LANGUAGES: [&'static str; 6] = ["en", "zh-TW", "ja", "zh-Hant", "ko", "zh"];

#[derive(Deserialize)]
struct Transcript {
    events: Vec<Event>,
}

#[derive(Deserialize)]
struct Event {
    segs: Option<Vec<Segment>>,
    tStartMs: Option<f64>,
    dDurationMs: Option<f64>,
}

#[derive(Deserialize)]
struct Segment {
    utf8: String,
}

#[derive(Serialize)]
struct Subtitle {
    id: u32,
    text: String,
    startSeconds: f64,
    endSeconds: f64,
}

#[tauri::command]
async fn get_transcript(video: String) -> Vec<Subtitle> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build().unwrap();
    let digest = DigestScraper::new(client);

    // Fetch the video
    let scraped = fetch_video(video, digest).await;

    // Find our preferred language, the priority is the order of LANGUAGES
    let language = get_caption_language(&scraped).unwrap();
    let captions = scraped.captions.iter().find(|caption| caption.lang_tag == language).unwrap();

    let transcript_json = captions.fetch(Format::JSON3).await.unwrap();

    let root: Transcript = serde_json::from_str(transcript_json.as_str()).unwrap();

    // Collect all utf8 fields from all events and all segments
    let subtitles: Vec<Subtitle> = root.events.iter()
        .enumerate()
        .filter_map(|(index, event)| {
            let start_seconds = event.tStartMs.map(|t| t / 1000.0)?;
            let end_seconds = event.dDurationMs.map(|d| start_seconds + d / 1000.0)?;
            event.segs.as_ref().map(|segs| {
                segs.iter().map(|segment| Subtitle {
                    id: (index + 1) as u32,
                    text: segment.utf8.clone(),
                    startSeconds: start_seconds,
                    endSeconds: end_seconds,
                }).collect::<Vec<Subtitle>>()
            })
        })
        .flatten()
        .collect();

    subtitles
}

fn get_caption_language(scraped: &Digest) -> Option<LanguageTag> {
    for lang in LANGUAGES.iter() {
        let language = LanguageTag::parse(lang).unwrap();
        if scraped.captions.iter().any(|caption| language.matches(&caption.lang_tag)) {
            return Some(language);
        }
    }
    None
}

fn find_preferred_language() -> Option<LanguageTag> {
    let mut language = None;

    for lang in LANGUAGES {
        match LanguageTag::parse(lang) {
            Ok(result) => {
                language = Some(result);
                break;
            }
            Err(_) => continue,
        }
    }
    language
}

async fn fetch_video(video: String, digest: DigestScraper) -> Digest {
    let mut scraped = None;

    for lang in LANGUAGES {
        match digest.fetch(&video, lang).await {
            Ok(result) => {
                scraped = Some(result);
                break;
            }
            Err(_) => continue,
        }
    }

    let scraped = scraped.unwrap();
    scraped
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet, get_transcript])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
