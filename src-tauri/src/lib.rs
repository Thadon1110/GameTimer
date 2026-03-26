use serde::Serialize;
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
    WebviewWindowBuilder,
    WebviewUrl,
    window::Color,
};
use std::path::PathBuf;
use winreg::enums::*;
use winreg::RegKey;

#[derive(Serialize, Clone)]
struct RunningProcess {
    name: String,
    exe: String,
}

#[derive(Serialize, Clone)]
struct InstalledGame {
    name: String,
    exe_name: String,
    exe_path: String,
    launcher: String,
}

#[tauri::command]
fn get_running_processes() -> Vec<RunningProcess> {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut seen = std::collections::HashSet::new();
    let mut processes: Vec<RunningProcess> = Vec::new();

    for process in sys.processes().values() {
        let name = process.name().to_string_lossy().to_string();
        let exe = process
            .exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        if !name.to_lowercase().ends_with(".exe") {
            continue;
        }

        let name_lower = name.to_lowercase();
        if seen.contains(&name_lower) {
            continue;
        }
        seen.insert(name_lower);

        processes.push(RunningProcess { name, exe });
    }

    processes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    processes
}

#[tauri::command]
fn scan_installed_games() -> Vec<InstalledGame> {
    let mut games: Vec<InstalledGame> = Vec::new();
    let mut seen_names = std::collections::HashSet::new();

    scan_steam_games(&mut games, &mut seen_names);
    scan_epic_games(&mut games, &mut seen_names);
    scan_gog_games(&mut games, &mut seen_names);
    scan_ea_games(&mut games, &mut seen_names);
    scan_ubisoft_games(&mut games, &mut seen_names);
    scan_riot_games(&mut games, &mut seen_names);
    scan_xbox_games(&mut games, &mut seen_names);
    scan_bsg_games(&mut games, &mut seen_names);

    games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    games
}

/// Steam: Read install path from Registry, parse appmanifest_*.acf files
fn scan_steam_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    let mut library_paths: Vec<PathBuf> = Vec::new();

    // 1. Find Steam install path from Registry
    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("SOFTWARE\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            let p = PathBuf::from(path.replace('/', "\\"));
            if p.exists() {
                library_paths.push(p);
            }
        }
    }
    if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("InstallPath") {
            let p = PathBuf::from(path);
            if p.exists() && !library_paths.contains(&p) {
                library_paths.push(p);
            }
        }
    }

    // 2. Hardcoded fallbacks
    for fallback in &[
        "C:\\Program Files (x86)\\Steam",
        "C:\\Program Files\\Steam",
        "D:\\Steam", "D:\\SteamLibrary",
        "E:\\Steam", "E:\\SteamLibrary",
    ] {
        let p = PathBuf::from(fallback);
        if p.exists() && !library_paths.contains(&p) {
            library_paths.push(p);
        }
    }

    // 3. Read libraryfolders.vdf from all known roots for extra library paths
    let roots_snapshot = library_paths.clone();
    for base in &roots_snapshot {
        let vdf_path = base.join("steamapps").join("libraryfolders.vdf");
        if let Ok(content) = std::fs::read_to_string(&vdf_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("\"path\"") {
                    if let Some(path_str) = trimmed.split('"').nth(3) {
                        let p = PathBuf::from(path_str.replace("\\\\", "\\"));
                        if p.exists() && !library_paths.contains(&p) {
                            library_paths.push(p);
                        }
                    }
                }
            }
        }
    }

    // 4. Scan each library for appmanifest files
    for lib_path in &library_paths {
        let steamapps = lib_path.join("steamapps");
        if !steamapps.exists() {
            continue;
        }

        let entries = match std::fs::read_dir(&steamapps) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let fname = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            if !fname.starts_with("appmanifest_") || !fname.ends_with(".acf") {
                continue;
            }

            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let name = extract_vdf_value(&content, "name");
            let installdir = extract_vdf_value(&content, "installdir");

            if let (Some(game_name), Some(install_dir)) = (name, installdir) {
                let lower = game_name.to_lowercase();
                if lower.contains("redistributable") || lower.contains("steamworks")
                    || lower.contains("proton") || lower.contains("steam linux")
                    || lower.contains("directx")
                {
                    continue;
                }

                let key = game_name.to_lowercase();
                if seen.contains(&key) {
                    continue;
                }
                seen.insert(key);

                let game_dir = steamapps.join("common").join(&install_dir);
                let exe_name = find_main_exe(&game_dir, &install_dir);

                games.push(InstalledGame {
                    name: game_name,
                    exe_name,
                    exe_path: game_dir.to_string_lossy().to_string(),
                    launcher: "Steam".to_string(),
                });
            }
        }
    }
}

/// Epic Games: Parse JSON manifest files + Registry fallback
fn scan_epic_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    // Method 1: Read JSON manifest files
    let manifests_dir = PathBuf::from("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");
    if manifests_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&manifests_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("item") {
                    continue;
                }

                let content = match std::fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let json: serde_json::Value = match serde_json::from_str(&content) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let display_name = json["DisplayName"].as_str().unwrap_or("").to_string();
                let install_location = json["InstallLocation"].as_str().unwrap_or("").to_string();
                let launch_exe = json["LaunchExecutable"].as_str().unwrap_or("").to_string();
                let is_incomplete = json["bIsIncompleteInstall"].as_bool().unwrap_or(false);

                if display_name.is_empty() || install_location.is_empty() || is_incomplete {
                    continue;
                }

                let key = display_name.to_lowercase();
                if seen.contains(&key) {
                    continue;
                }
                seen.insert(key);

                let exe_name = if !launch_exe.is_empty() {
                    launch_exe.split(['\\', '/']).last().unwrap_or(&launch_exe).to_string()
                } else {
                    find_main_exe(&PathBuf::from(&install_location), &display_name)
                };

                games.push(InstalledGame {
                    name: display_name,
                    exe_name,
                    exe_path: install_location,
                    launcher: "Epic Games".to_string(),
                });
            }
        }
    }

    // Method 2: Registry fallback - Epic games in Uninstall entries
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    for reg_path in &[
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ] {
        let key = match hklm.open_subkey(reg_path) {
            Ok(k) => k,
            Err(_) => continue,
        };

        for subkey_name in key.enum_keys().flatten() {
            let subkey = match key.open_subkey(&subkey_name) {
                Ok(k) => k,
                Err(_) => continue,
            };

            let url_info: String = subkey.get_value("URLInfoAbout").unwrap_or_default();
            let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
            let is_epic = url_info.contains("epicgames.com")
                || publisher.to_lowercase().contains("epic games");

            if !is_epic {
                continue;
            }

            let display_name: String = match subkey.get_value("DisplayName") {
                Ok(v) => v,
                Err(_) => continue,
            };
            let install_location: String = subkey.get_value("InstallLocation").unwrap_or_default();

            let lower = display_name.to_lowercase();
            if lower.contains("launcher") || lower.contains("prerequisites") {
                continue;
            }

            let name_key = display_name.to_lowercase();
            if seen.contains(&name_key) {
                continue;
            }
            seen.insert(name_key);

            let exe_name = if !install_location.is_empty() {
                find_main_exe(&PathBuf::from(&install_location), &display_name)
            } else {
                String::new()
            };

            games.push(InstalledGame {
                name: display_name,
                exe_name,
                exe_path: install_location,
                launcher: "Epic Games".to_string(),
            });
        }
    }
}

/// GOG: Read from Windows Registry
fn scan_gog_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let gog_key = match hklm.open_subkey("SOFTWARE\\WOW6432Node\\GOG.com\\Games") {
        Ok(k) => k,
        Err(_) => return,
    };

    for game_id in gog_key.enum_keys().flatten() {
        let subkey = match gog_key.open_subkey(&game_id) {
            Ok(k) => k,
            Err(_) => continue,
        };

        let game_name: String = match subkey.get_value("gameName") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let exe_path: String = subkey.get_value("exe").unwrap_or_default();
        let game_path: String = subkey.get_value("path").unwrap_or_default();

        if game_name.is_empty() {
            continue;
        }

        let key = game_name.to_lowercase();
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);

        let exe_name = exe_path.split(['\\', '/']).last().unwrap_or("").to_string();

        games.push(InstalledGame {
            name: game_name,
            exe_name,
            exe_path: game_path,
            launcher: "GOG".to_string(),
        });
    }
}

/// EA: Read from Registry (EA Desktop / Origin)
fn scan_ea_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let uninstall_paths = [
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ];

    for reg_path in &uninstall_paths {
        let key = match hklm.open_subkey(reg_path) {
            Ok(k) => k,
            Err(_) => continue,
        };

        for subkey_name in key.enum_keys().flatten() {
            let subkey = match key.open_subkey(&subkey_name) {
                Ok(k) => k,
                Err(_) => continue,
            };

            let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
            let pub_lower = publisher.to_lowercase();
            if !pub_lower.contains("electronic arts") && !pub_lower.contains("ea ")
                && !pub_lower.contains("dice") && !pub_lower.contains("respawn")
                && !pub_lower.contains("bioware") && !pub_lower.contains("maxis")
            {
                continue;
            }

            let display_name: String = match subkey.get_value("DisplayName") {
                Ok(v) => v,
                Err(_) => continue,
            };
            let install_location: String = subkey.get_value("InstallLocation").unwrap_or_default();

            let lower = display_name.to_lowercase();
            if lower.contains("ea app") || lower.contains("ea desktop") || lower.contains("origin")
                || lower.contains("redistributable") || lower.contains("directx")
            {
                continue;
            }

            let name_key = display_name.to_lowercase();
            if seen.contains(&name_key) {
                continue;
            }
            seen.insert(name_key);

            let exe_name = find_main_exe(&PathBuf::from(&install_location), &display_name);

            games.push(InstalledGame {
                name: display_name,
                exe_name,
                exe_path: install_location,
                launcher: "EA".to_string(),
            });
        }
    }
}

/// Ubisoft: Read from Registry
fn scan_ubisoft_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let key = match hklm.open_subkey("SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs") {
        Ok(k) => k,
        Err(_) => return,
    };

    for game_id in key.enum_keys().flatten() {
        let subkey = match key.open_subkey(&game_id) {
            Ok(k) => k,
            Err(_) => continue,
        };

        let install_dir: String = match subkey.get_value("InstallDir") {
            Ok(v) => v,
            Err(_) => continue,
        };

        let dir_path = PathBuf::from(&install_dir);
        let game_name = dir_path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if game_name.is_empty() {
            continue;
        }

        let name_key = game_name.to_lowercase();
        if seen.contains(&name_key) {
            continue;
        }
        seen.insert(name_key);

        let exe_name = find_main_exe(&dir_path, &game_name);

        games.push(InstalledGame {
            name: game_name,
            exe_name,
            exe_path: install_dir,
            launcher: "Ubisoft".to_string(),
        });
    }
}

/// Riot Games: Check known game paths
fn scan_riot_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    let riot_games = [
        ("VALORANT", "VALORANT.exe", "C:\\Riot Games\\VALORANT"),
        ("League of Legends", "LeagueClient.exe", "C:\\Riot Games\\League of Legends"),
        ("Legends of Runeterra", "LoR.exe", "C:\\Riot Games\\LoR"),
    ];

    for (name, exe, path) in &riot_games {
        let dir = PathBuf::from(path);
        if !dir.exists() {
            continue;
        }

        let key = name.to_lowercase();
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);

        games.push(InstalledGame {
            name: name.to_string(),
            exe_name: exe.to_string(),
            exe_path: path.to_string(),
            launcher: "Riot Games".to_string(),
        });
    }
}

/// Xbox / Microsoft Store: scan XboxGames folders
fn scan_xbox_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    let xbox_roots = ["C:\\XboxGames", "D:\\XboxGames", "E:\\XboxGames"];
    for root in &xbox_roots {
        let root_path = PathBuf::from(root);
        if !root_path.exists() {
            continue;
        }

        let entries = match std::fs::read_dir(&root_path) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let game_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            if game_name.is_empty() {
                continue;
            }

            let key = game_name.to_lowercase();
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);

            let exe_name = find_main_exe(&path, &game_name);

            games.push(InstalledGame {
                name: game_name,
                exe_name,
                exe_path: path.to_string_lossy().to_string(),
                launcher: "Xbox".to_string(),
            });
        }
    }
}

/// BSG (Battlestate Games): Escape from Tarkov via Registry Uninstall
fn scan_bsg_games(games: &mut Vec<InstalledGame>, seen: &mut std::collections::HashSet<String>) {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let uninstall_paths = [
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ];

    for reg_path in &uninstall_paths {
        let key = match hklm.open_subkey(reg_path) {
            Ok(k) => k,
            Err(_) => continue,
        };

        for subkey_name in key.enum_keys().flatten() {
            let subkey = match key.open_subkey(&subkey_name) {
                Ok(k) => k,
                Err(_) => continue,
            };

            let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
            if !publisher.to_lowercase().contains("battlestate") {
                continue;
            }

            let display_name: String = match subkey.get_value("DisplayName") {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Skip the launcher itself
            let lower = display_name.to_lowercase();
            if lower.contains("launcher") {
                continue;
            }

            let install_location: String = subkey.get_value("InstallLocation").unwrap_or_default();
            if install_location.is_empty() {
                continue;
            }

            let name_key = lower.clone();
            if seen.contains(&name_key) {
                continue;
            }
            seen.insert(name_key);

            let exe_name = find_main_exe(&PathBuf::from(&install_location), &display_name);

            games.push(InstalledGame {
                name: display_name,
                exe_name,
                exe_path: install_location,
                launcher: "BSG".to_string(),
            });
        }
    }
}

/// Helper: Extract a value from Valve's VDF format ("key" "value")
fn extract_vdf_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        let search = format!("\"{}\"", key);
        if trimmed.starts_with(&search) {
            return trimmed.split('"').nth(3).map(|s| s.to_string());
        }
    }
    None
}

/// Helper: Find the most likely main game exe in a directory
fn find_main_exe(dir: &std::path::Path, game_name: &str) -> String {
    if !dir.exists() {
        return String::new();
    }

    let blacklist = [
        "unins", "setup", "install", "update", "crash", "report", "launcher",
        "redist", "dxsetup", "dotnet", "7z", "ue4", "cefprocess", "subprocess",
        "helper", "service", "daemon", "tray", "bootstrap", "prerequisite",
        "easyanticheat", "battleye", "cleanup", "diagnostic", "repair",
    ];

    let mut candidates: Vec<(PathBuf, u32)> = Vec::new();
    collect_exes(dir, &mut candidates, game_name, &blacklist, 0, 3);

    candidates.sort_by(|a, b| b.1.cmp(&a.1));

    candidates.first()
        .map(|(p, _)| p.file_name().unwrap_or_default().to_string_lossy().to_string())
        .unwrap_or_default()
}

fn collect_exes(
    dir: &std::path::Path,
    candidates: &mut Vec<(PathBuf, u32)>,
    game_name: &str,
    blacklist: &[&str],
    depth: u32,
    max_depth: u32,
) {
    if depth > max_depth {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let name_lower = game_name.to_lowercase().replace(' ', "").replace('-', "").replace('_', "");

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_exes(&path, candidates, game_name, blacklist, depth + 1, max_depth);
        } else if path.extension().and_then(|e| e.to_str()) == Some("exe") {
            let fname = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let fname_lower = fname.to_lowercase();

            if blacklist.iter().any(|b| fname_lower.contains(b)) {
                continue;
            }

            let mut score: u32 = 1;

            let exe_stem = fname_lower.replace(".exe", "").replace(' ', "").replace('-', "").replace('_', "");
            if exe_stem == name_lower || name_lower.contains(&exe_stem) || exe_stem.contains(&name_lower) {
                score += 10;
            }

            if depth == 0 {
                score += 3;
            } else if depth == 1 {
                score += 1;
            }

            if fname_lower.len() < 5 {
                score = score.saturating_sub(1);
            }

            candidates.push((path, score));
        }
    }
}

fn url_encode(s: &str) -> String {
    let mut result = String::new();
    for b in s.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(*b as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", b));
            }
        }
    }
    result
}

#[tauri::command]
async fn show_toast(app: tauri::AppHandle, title: String, body: String, toast_type: String, duration_secs: u32) -> Result<(), String> {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let label = format!("toast_{}", ts);

    let url = format!(
        "toast.html?title={}&body={}&type={}&duration={}",
        url_encode(&title),
        url_encode(&body),
        url_encode(&toast_type),
        duration_secs
    );

    let (x, y) = if let Ok(Some(monitor)) = app.primary_monitor() {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        ((size.width as f64 / scale) - 380.0, (size.height as f64 / scale) - 160.0)
    } else {
        (1540.0, 940.0)
    };

    let _window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("Toast")
        .inner_size(360.0, 100.0)
        .position(x, y)
        .decorations(false)
        .shadow(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .resizable(false)
        .background_color(Color(30, 41, 59, 255))
        .build()
        .map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let close_after = if duration_secs > 0 { duration_secs as u64 + 2 } else { 8 };
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(close_after));
        if let Some(w) = app_handle.get_webview_window(&label) {
            let _ = w.close();
        }
    });

    Ok(())
}

#[tauri::command]
async fn show_fullscreen_alert(app: tauri::AppHandle, title: String, body: String, toast_type: String, duration_secs: u32, opacity: u32) -> Result<(), String> {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let label = format!("fullscreen_{}", ts);

    let op = opacity.min(100);
    let url = format!(
        "fullscreen.html?title={}&body={}&type={}&duration={}&opacity={}",
        url_encode(&title),
        url_encode(&body),
        url_encode(&toast_type),
        duration_secs,
        op
    );

    let _window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("GameTimer Alert")
        .position(0.0, 0.0)
        .decorations(false)
        .transparent(true)
        .fullscreen(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .background_color(Color(2, 6, 23, 255))
        .build()
        .map_err(|e| e.to_string())?;

    let close_after = if duration_secs > 0 { duration_secs as u64 + 2 } else { 30 };
    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(close_after));
        if let Some(w) = app_handle.get_webview_window(&label) {
            let _ = w.close();
        }
    });

    Ok(())
}

#[tauri::command]
async fn close_alert_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(&label) {
        w.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_running_processes, scan_installed_games, show_toast, show_fullscreen_alert, close_alert_window])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Poka\u{017c}", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Zamknij", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("GameTimer")
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
