use std::fs;
use std::env;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub MODEL_NAME: String,
    pub OUTPUT_LANGUAGE: String,
}

fn project_root() -> std::path::PathBuf {
    std::env::current_dir()
        .unwrap_or_default()
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from(".."))
}

pub fn load_config() -> Config {
    // Ładujemy zewnętrzny plik z wyższego poziomu (katalog projektu)
    let env_path = project_root().join(".env");
    let _ = dotenv::from_path(&env_path);
    
    let config_path = project_root().join("config.toml");
    let content = fs::read_to_string(&config_path)
        .unwrap_or_else(|_| panic!("Unable to read {:?} (upewnij się, że plik config.toml jest w głównym katalogu projektu)", config_path));
    
    toml::from_str(&content).expect("config.toml is not valid TOML")
}

pub fn get_api_key() -> String {
    let env_path = project_root().join(".env");
    let _ = dotenv::from_path(&env_path);
    env::var("OPENROUTER_API_KEY").unwrap_or_else(|_| panic!("OPENROUTER_API_KEY not set in {:?}", env_path))
}
