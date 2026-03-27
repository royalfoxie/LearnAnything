mod agents;
mod config;
mod db;

use tauri::Manager;
use tauri::State;
use rig::completion::Prompt;

#[tauri::command]
async fn save_material(name: String, content: String, db: State<'_, db::AppDb>) -> Result<String, String> {
    db::save_material(&db, &name, &content).await.map_err(|e| e.to_string())?;
    Ok("Ok".into())
}

fn project_root() -> std::path::PathBuf {
    std::env::current_dir()
        .unwrap_or_default()
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from(".."))
}

macro_rules! log_mas {
    ($($arg:tt)*) => {{
        let msg = format!($($arg)*);
        eprintln!("{}", msg);
        let log_path = project_root().join("mas_system.log");
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let log_entry = format!("[{}] {}\n", timestamp, msg);
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(log_path) {
            use std::io::Write;
            let _ = file.write_all(log_entry.as_bytes());
        }
    }};
}

fn smart_chunk(text: &str, max_len: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current_chunk = String::new();

    for paragraph in text.split("\n\n") {
        let p = paragraph.trim();
        if p.is_empty() { continue; }

        if current_chunk.len() + p.len() < max_len {
            if !current_chunk.is_empty() { current_chunk.push_str("\n\n"); }
            current_chunk.push_str(p);
        } else {
            if !current_chunk.is_empty() { chunks.push(current_chunk.clone()); }
            current_chunk = p.to_string();
        }
    }
    if !current_chunk.is_empty() { chunks.push(current_chunk); }
    chunks
}

#[tauri::command]
async fn upload_pdf_material(name: String, path: String, db: State<'_, db::AppDb>) -> Result<String, String> {
    eprintln!("📥 Otrzymano prośbę o import pliku: {:?}", path);
    let extension = path.rsplit('.').next().unwrap_or("").to_lowercase();
    
    let content = match extension.as_str() {
        // Plain text files — read directly, no Docling needed
        "txt" | "md" => {
            eprintln!("📄 Omijanie Docling — bezpośredni odczyt {:?}", path);
            tokio::fs::read_to_string(&path)
                .await
                .map_err(|e| format!("Błąd odczytu pliku: {}", e))?
        },
        // Everything else (PDF, DOCX, PPTX, HTML, images) — use Docling
        _ => {
            eprintln!("🔍 Uruchamiam Docling (Python) do analizy: {:?}", path);
            let root = project_root();
            let python_bin = root.join("src-python").join("venv").join("bin").join("python");
            let extract_script = root.join("src-python").join("extract.py");
            
            let output = tokio::process::Command::new(&python_bin)
                .arg(&extract_script)
                .arg(&path)
                .output()
                .await
                .map_err(|e| format!("Błąd uruchomienia Python (czy venv istnieje?): {}", e))?;
            
            if !output.status.success() {
                eprintln!("❌ Docling Error: {}", String::from_utf8_lossy(&output.stderr));
                return Err(format!("Docling Error: {}", String::from_utf8_lossy(&output.stderr)));
            }
            
            let stdout = String::from_utf8_lossy(&output.stdout);
            let parsed: serde_json::Value = serde_json::from_str(&stdout)
                .map_err(|e| format!("Błąd parsowania JSON z docling: {} ({} )", e, stdout))?;
                
            if parsed["status"] == "ok" {
                eprintln!("✅ Docling przetworzył plik poprawnie.");
                parsed["result"].as_str().unwrap_or("").to_string()
            } else {
                return Err(parsed["message"].as_str().unwrap_or("Nieznany błąd M.A.S").to_string());
            }
        }
    };
    
    let mat = db::save_material(&db, &name, &content).await.map_err(|e| e.to_string())?.ok_or("Fail to insert db")?;
    let rid = mat.id.unwrap();
    let dbg_key = format!("{:?}", rid.key);
    let clean_key = if dbg_key.starts_with("String(\"") && dbg_key.ends_with("\")") {
        dbg_key.trim_start_matches("String(\"").trim_end_matches("\")").to_string()
    } else {
        dbg_key
    };
    Ok(format!("{}:{}", rid.table.as_str(), clean_key))
}

#[tauri::command]
async fn list_materials(db: State<'_, db::AppDb>) -> Result<Vec<db::Material>, String> {
    db::list_materials(&db).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_courses(db: State<'_, db::AppDb>) -> Result<Vec<db::Course>, String> {
    db::list_courses(&db).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_course_pipeline(name: String, material_id: String, material_content: String, advisor_context: String, db: State<'_, db::AppDb>) -> Result<String, String> {
    log_mas!("🚀 START GENEKURSU: {}", name);
    log_mas!("📋 Kontekst od doradcy:\n{}", advisor_context);

    let created_course = db::create_course(&db, &name, &material_id).await.map_err(|e| e.to_string())?.ok_or("Błąd tworzenia")?;
    let rid = created_course.id.unwrap();
    let dbg_key = format!("{:?}", rid.key);
    let clean_key = if dbg_key.starts_with("String(\"") && dbg_key.ends_with("\")") {
        dbg_key.trim_start_matches("String(\"").trim_end_matches("\")").to_string()
    } else {
        dbg_key
    };
    let course_id_str = format!("{}:{}", rid.table.as_str(), clean_key);

    let chunks = smart_chunk(&material_content, 2000); // ok. 2000 chars per chunk
    log_mas!("--- 📊 Rozpoczynam rówloległe odpytywanie LLM dla {} bloków tekstu ---", chunks.len());

    let mut tasks = Vec::new();
    for (i, chunk) in chunks.into_iter().enumerate() {
        let advisor_ctx = advisor_context.clone();
        
        tasks.push(tokio::spawn(async move {
            let extractor = agents::build_extractor_agent();
            let sequencer = agents::build_sequencer_agent();
            
            let combined_prompt = format!("Kontekst ucznia: {}\n\nTreść:\n{}", advisor_ctx, chunk);
            log_mas!("🤖 [Task {}] Wysyłam żądanie ekstrakcji wiedzy...", i + 1);
            
            let extracted: String = extractor.prompt(&combined_prompt).await.unwrap_or_else(|_| "Błąd".into());
            
            if extracted.trim() == "[SKIP]" {
                log_mas!("⏭️ [Task {}] LLM odrzucił blok jako niewartościowy (wstęp/spis/itp). Pomijam.", i + 1);
                return None;
            }
            
            log_mas!("🤖 [Task {}] Generowanie nazwy modułu...", i + 1);
            let title: String = sequencer.prompt(&extracted).await.unwrap_or_else(|_| format!("Dział {}", i+1));
            log_mas!("✅ [Task {}] Moduł gotowy: '{}'", i + 1, title);
            
            Some((title, extracted))
        }));
    }

    let results = futures::future::join_all(tasks).await;
    
    let mut order_idx = 0;
    for res in results {
        if let Ok(Some((title, extracted))) = res {
            db::save_concept(&db, &course_id_str, &title, &extracted, order_idx as i32)
                .await.map_err(|e| e.to_string())?;
            order_idx += 1;
        }
    }
    
    log_mas!("🎉 Kurs '{}' skonstruowany! Odrzucono śmieci. Rzeczywistych modułów: {}", name, order_idx);
    Ok(course_id_str)
}

#[tauri::command]
async fn get_course_roadmap(course_id: String, db: State<'_, db::AppDb>) -> Result<Vec<db::ConceptNode>, String> {
    db::get_course_roadmap(&db, &course_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn evaluate_answer(answer: String) -> Result<String, String> {
    let agent = agents::build_evaluator_agent();
    let score: String = agent.prompt(&answer).await.map_err(|e| e.to_string())?;
    Ok(score)
}

#[tauri::command]
async fn chat_with_advisor(msg: String) -> Result<String, String> {
    log_mas!("💬 [Advisor] Otrzymano wiadomość użytkownika (długość: {})", msg.len());
    let agent = agents::build_advisor_agent();
    log_mas!("⏳ [Advisor] Czekam na odpowiedź z OpenRouter (LLM)...");
    let response: String = agent.prompt(&msg).await.map_err(|e| e.to_string())?;
    log_mas!("✅ [Advisor] Odpowiedź doradcy wygenerowana.");
    Ok(response)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // 1. Init SurrealDB
                match db::init_db().await {
                    Ok(database) => {
                        handle.manage(database);
                    }
                    Err(e) => eprintln!("Failed to initialize SurrealDB: {}", e),
                }

                // 2. Auto-setup Python venv
                let root = project_root();
                let venv_dir = root.join("src-python").join("venv");
                let python_bin = venv_dir.join("bin").join("python");
                let requirements = root.join("src-python").join("requirements.txt");
                let sidecar_script = root.join("src-python").join("main.py");

                if !python_bin.exists() {
                    eprintln!("🔧 Tworzenie Python venv w {:?}...", venv_dir);
                    let venv_result = tokio::process::Command::new("python3")
                        .args(["-m", "venv"])
                        .arg(&venv_dir)
                        .stdout(std::process::Stdio::inherit())
                        .stderr(std::process::Stdio::inherit())
                        .status()
                        .await;
                    
                    match venv_result {
                        Ok(s) if s.success() => eprintln!("✅ Venv utworzone."),
                        Ok(s) => {
                            eprintln!("⚠️ python3 -m venv zakończone kodem: {}", s);
                            return;
                        }
                        Err(e) => {
                            eprintln!("⚠️ Nie udało się utworzyć venv (czy python3 jest zainstalowany?): {}", e);
                            return;
                        }
                    }
                }

                // 3. Install requirements if they exist
                if requirements.exists() {
                    eprintln!("📦 Instalacja zależności Python (docling, sympy)...");
                    let pip_bin = venv_dir.join("bin").join("pip");
                    let install = tokio::process::Command::new(&pip_bin)
                        .args(["install", "-r"])
                        .arg(&requirements)
                        .stdout(std::process::Stdio::inherit())
                        .stderr(std::process::Stdio::inherit())
                        .status()
                        .await;
                    
                    match install {
                        Ok(s) if s.success() => eprintln!("✅ Zależności Python zainstalowane."),
                        Ok(s) => eprintln!("⚠️ pip install zakończone kodem: {} (może być ok jeśli deps już są)", s),
                        Err(e) => eprintln!("⚠️ Błąd pip install: {}", e),
                    }
                }

                // 4. Start Python sidecar
                if sidecar_script.exists() {
                    match tokio::process::Command::new(&python_bin)
                        .arg(&sidecar_script)
                        .spawn()
                    {
                        Ok(mut child) => {
                            eprintln!("🐍 Python sidecar uruchomiony.");
                            let _ = child.wait().await;
                        }
                        Err(e) => eprintln!("⚠️ Nie udało się uruchomić Python sidecar: {}", e),
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_material, 
            upload_pdf_material,
            list_materials, 
            list_courses, 
            create_course_pipeline, 
            get_course_roadmap, 
            evaluate_answer,
            chat_with_advisor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
