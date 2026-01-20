use clap::{Parser, Subcommand};
use serde_json::Value;
use std::fs;
use std::io::{IsTerminal, Read, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::process;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop, EventLoopProxy};
use tao::window::WindowBuilder;
use wry::webview::WebViewBuilder;

fn socket_path() -> String {
    std::env::var("MECH_SOCKET_PATH").unwrap_or_else(|_| "/tmp/mech.sock".to_string())
}

fn pid_path() -> String {
    std::env::var("MECH_PID_PATH").unwrap_or_else(|_| "/tmp/mech.pid".to_string())
}

#[derive(Parser)]
#[command(name = "mech", about = "CLI for interacting with HyperMap resources")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the daemon
    Start,
    /// Stop the daemon
    Stop,
    /// Open a URL in a new tab
    Open {
        /// URL to open
        url: String,
        /// Optional name for the tab
        #[arg(short, long)]
        name: Option<String>,
    },
    /// Show tab contents, optionally at a specific path
    Show {
        /// Tab reference with optional path (e.g., "1", "stocks", "1:nav/home")
        target: String,
    },
    /// Use a control at a path
    Use {
        /// Tab and path (e.g., "1:nav/home", "stocks:submit")
        target: String,
        /// Form data as key=value pairs
        data: Vec<String>,
    },
    /// Fork a tab by following a control into a new tab
    Fork {
        /// Tab and path (e.g., "1:nav/home", "stocks:submit")
        target: String,
        /// Optional name for the new tab
        #[arg(short, long)]
        name: Option<String>,
        /// Form data as key=value pairs
        data: Vec<String>,
    },
    /// Close a tab
    Close {
        /// Tab reference (index or name)
        tab: String,
    },
    /// Name or rename a tab
    Name {
        /// Tab reference (index or current name)
        tab: String,
        /// New name for the tab
        name: String,
    },
    /// List all open tabs
    Tabs,
}

/// Daemon protocol commands (sent over socket)
#[derive(Debug, Clone)]
enum DaemonCommand {
    Open {
        url: String,
        name: Option<String>,
    },
    Show {
        tab: String,
        path: Option<String>,
        color: bool,
    },
    Use {
        tab: String,
        path: String,
        data: Vec<(String, String)>,
    },
    Fork {
        tab: String,
        path: String,
        name: Option<String>,
        data: Vec<(String, String)>,
    },
    Close {
        tab: String,
    },
    Name {
        tab: String,
        name: String,
    },
    Tabs,
    Shutdown,
}

enum UserEvent {
    Command(DaemonCommand, mpsc::Sender<String>),
    WebViewMessage(usize, String),
}

struct Tab {
    #[allow(dead_code)]
    webview: wry::webview::WebView,
    #[allow(dead_code)]
    url: String,
    name: Option<String>,
    hypermap: Value,
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Start => start_daemon(),
        Commands::Stop => stop_daemon(),
        Commands::Open { url, name } => {
            let name_part = name.map(|n| format!(" --name {}", n)).unwrap_or_default();
            send_command(&format!("open {}{}", url, name_part));
        }
        Commands::Show { target } => {
            let (tab, path) = parse_target(&target);
            let color_flag = if std::io::stdout().is_terminal() {
                " --color"
            } else {
                ""
            };
            match path {
                Some(p) => send_command(&format!("show {} {}{}", tab, p, color_flag)),
                None => send_command(&format!("show {}{}", tab, color_flag)),
            }
        }
        Commands::Use { target, data } => {
            let (tab, path) = parse_target(&target);
            let path = path.unwrap_or_default();
            let data_str = data.join(" ");
            send_command(&format!("use {} {} {}", tab, path, data_str));
        }
        Commands::Fork { target, name, data } => {
            let (tab, path) = parse_target(&target);
            let path = path.unwrap_or_default();
            let name_part = name.map(|n| format!(" --name {}", n)).unwrap_or_default();
            let data_str = data.join(" ");
            send_command(&format!("fork {} {}{} {}", tab, path, name_part, data_str));
        }
        Commands::Close { tab } => {
            send_command(&format!("close {}", tab));
        }
        Commands::Name { tab, name } => {
            send_command(&format!("name {} {}", tab, name));
        }
        Commands::Tabs => {
            send_command("tabs");
        }
    }
}

/// Parse a target string like "1", "stocks", "1:nav/home", or "stocks:nav/home"
/// Returns (tab_ref, optional_path)
fn parse_target(target: &str) -> (String, Option<String>) {
    if let Some(colon_pos) = target.find(':') {
        let tab = target[..colon_pos].to_string();
        let path = target[colon_pos + 1..].to_string();
        (tab, Some(path))
    } else {
        (target.to_string(), None)
    }
}

fn start_daemon() {
    // Check if already running by trying to connect to socket
    if UnixStream::connect(socket_path()).is_ok() {
        eprintln!("Daemon already running");
        return;
    }

    // Clean up stale files from previous crashed runs
    let _ = fs::remove_file(socket_path());
    let _ = fs::remove_file(pid_path());

    // Write PID file
    fs::write(pid_path(), process::id().to_string()).expect("Failed to write PID file");

    println!("Starting mech daemon...");

    let event_loop: EventLoop<UserEvent> = EventLoop::with_user_event();
    let proxy = event_loop.create_proxy();

    // Start Unix socket listener in separate thread
    let socket_proxy = proxy.clone();
    std::thread::spawn(move || {
        socket_listener(socket_proxy);
    });

    // Tab storage
    // Note: WebView is not Send/Sync, but we only access it from the event loop thread
    #[allow(clippy::arc_with_non_send_sync)]
    let tabs: Arc<Mutex<Vec<Tab>>> = Arc::new(Mutex::new(Vec::new()));
    let tabs_clone = tabs.clone();

    event_loop.run(move |event, event_loop, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::UserEvent(user_event) => match user_event {
                UserEvent::Command(cmd, response_tx) => {
                    handle_command(cmd, &tabs_clone, event_loop, &proxy, response_tx);
                }
                UserEvent::WebViewMessage(tab_idx, msg) => {
                    handle_webview_message(tab_idx, msg, &tabs_clone);
                }
            },
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                // Don't close on window close request
            }
            _ => {}
        }
    });
}

fn socket_listener(proxy: EventLoopProxy<UserEvent>) {
    let listener = UnixListener::bind(socket_path()).expect("Failed to bind socket");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                let mut buffer = String::new();
                if stream.read_to_string(&mut buffer).is_ok()
                    && let Some(cmd) = parse_command(&buffer)
                {
                    let (tx, rx) = mpsc::channel();
                    let _ = proxy.send_event(UserEvent::Command(cmd, tx));
                    // Wait for response and send it back to client
                    if let Ok(response) = rx.recv() {
                        let _ = stream.write_all(response.as_bytes());
                        // Explicitly shutdown to signal EOF to client
                        let _ = stream.shutdown(std::net::Shutdown::Write);
                    }
                }
            }
            Err(e) => eprintln!("Socket error: {}", e),
        }
    }
}

fn parse_command(input: &str) -> Option<DaemonCommand> {
    let parts: Vec<&str> = input.split_whitespace().collect();
    let cmd = *parts.first()?;

    match cmd {
        "open" => {
            // open <url> [--name <name>]
            let mut url = String::new();
            let mut name = None;
            let mut i = 1;
            while i < parts.len() {
                if parts[i] == "--name" && i + 1 < parts.len() {
                    name = Some(parts[i + 1].to_string());
                    i += 2;
                } else {
                    if !url.is_empty() {
                        url.push(' ');
                    }
                    url.push_str(parts[i]);
                    i += 1;
                }
            }
            Some(DaemonCommand::Open { url, name })
        }
        "show" => {
            // show <tab> [path] [--color]
            let tab = parts.get(1)?.to_string();
            let color = parts.contains(&"--color");
            let path_parts: Vec<&str> = parts[2..]
                .iter()
                .filter(|&&p| p != "--color")
                .copied()
                .collect();
            let path = if path_parts.is_empty() {
                None
            } else {
                Some(path_parts.join("/"))
            };
            Some(DaemonCommand::Show { tab, path, color })
        }
        "use" => {
            // use <tab> <path> [key=value ...]
            let tab = parts.get(1)?.to_string();
            let path = parts.get(2)?.to_string();
            let data = parts[3..]
                .iter()
                .filter_map(|s| {
                    let mut split = s.splitn(2, '=');
                    Some((split.next()?.to_string(), split.next()?.to_string()))
                })
                .collect();
            Some(DaemonCommand::Use { tab, path, data })
        }
        "fork" => {
            // fork <tab> <path> [--name <name>] [key=value ...]
            let tab = parts.get(1)?.to_string();
            let path = parts.get(2)?.to_string();
            let mut name = None;
            let mut data = Vec::new();
            let mut i = 3;
            while i < parts.len() {
                if parts[i] == "--name" && i + 1 < parts.len() {
                    name = Some(parts[i + 1].to_string());
                    i += 2;
                } else if let Some((k, v)) = parts[i].split_once('=') {
                    data.push((k.to_string(), v.to_string()));
                    i += 1;
                } else {
                    i += 1;
                }
            }
            Some(DaemonCommand::Fork {
                tab,
                path,
                name,
                data,
            })
        }
        "close" => {
            let tab = parts.get(1)?.to_string();
            Some(DaemonCommand::Close { tab })
        }
        "name" => {
            let tab = parts.get(1)?.to_string();
            let name = parts.get(2)?.to_string();
            Some(DaemonCommand::Name { tab, name })
        }
        "tabs" => Some(DaemonCommand::Tabs),
        "shutdown" => Some(DaemonCommand::Shutdown),
        _ => None,
    }
}

/// Resolve a tab reference (index or name) to an index
fn resolve_tab(tabs: &[Tab], tab_ref: &str) -> Option<usize> {
    // Try parsing as index first
    if let Ok(idx) = tab_ref.parse::<usize>()
        && idx > 0
        && idx <= tabs.len()
    {
        return Some(idx - 1);
    }
    // Try finding by name
    tabs.iter().position(|t| t.name.as_deref() == Some(tab_ref))
}

fn handle_command(
    cmd: DaemonCommand,
    tabs: &Arc<Mutex<Vec<Tab>>>,
    event_loop: &tao::event_loop::EventLoopWindowTarget<UserEvent>,
    proxy: &EventLoopProxy<UserEvent>,
    response_tx: mpsc::Sender<String>,
) {
    match cmd {
        DaemonCommand::Open { url, name } => {
            // Check if name is already in use
            if let Some(ref n) = name {
                let tabs_lock = tabs.lock().unwrap();
                if tabs_lock.iter().any(|t| t.name.as_deref() == Some(n)) {
                    let _ = response_tx.send(format!("Tab name '{}' already in use\n", n));
                    return;
                }
            }

            let full_url = if url.starts_with("http://") || url.starts_with("https://") {
                url.clone()
            } else {
                format!("https://{}", url)
            };

            let window = WindowBuilder::new()
                .with_visible(false)
                .with_title("mech tab")
                .build(event_loop)
                .expect("Failed to create window");

            let tab_idx = tabs.lock().unwrap().len();
            let proxy_clone = proxy.clone();

            let init_script = r#"
                // Polyfill parent.window.postMessage to use IPC for native CLI
                if (typeof window.ipc !== 'undefined') {
                    window.parent = {
                        window: {
                            postMessage: function(message, origin) {
                                window.ipc.postMessage(message);
                            }
                        }
                    };
                }
            "#;

            let webview = WebViewBuilder::new(window)
                .unwrap()
                .with_url(&full_url)
                .unwrap()
                .with_initialization_script(init_script)
                .with_ipc_handler(move |_window: &tao::window::Window, msg: String| {
                    let _ = proxy_clone.send_event(UserEvent::WebViewMessage(tab_idx, msg));
                })
                .build()
                .expect("Failed to create webview");

            let tab = Tab {
                webview,
                url: full_url,
                name: name.clone(),
                hypermap: Value::Object(serde_json::Map::new()),
            };

            tabs.lock().unwrap().push(tab);
            let display_name = name
                .map(|n| format!("{} ({})", tab_idx + 1, n))
                .unwrap_or_else(|| (tab_idx + 1).to_string());
            let _ = response_tx.send(format!("Opened tab {} at {}\n", display_name, url));
        }
        DaemonCommand::Show { tab, path, color } => {
            let tabs_lock = tabs.lock().unwrap();
            if let Some(idx) = resolve_tab(&tabs_lock, &tab) {
                let tab_data = &tabs_lock[idx];
                let value = if let Some(p) = path {
                    get_value_at_path(&tab_data.hypermap, &p)
                } else {
                    Some(&tab_data.hypermap)
                };
                match value {
                    Some(v) => {
                        let _ = response_tx.send(format_hypermap_styled(v, 0, color));
                    }
                    None => {
                        let _ = response_tx.send("Path not found\n".to_string());
                    }
                }
            } else {
                let _ = response_tx.send(format!("Tab '{}' not found\n", tab));
            }
        }
        DaemonCommand::Use { tab, path, data } => {
            let tabs_lock = tabs.lock().unwrap();
            if let Some(idx) = resolve_tab(&tabs_lock, &tab) {
                let tab_data = &tabs_lock[idx];
                // Set any form data first
                for (key, value) in &data {
                    let full_path = format!("{}/{}", path, key);
                    let path_vec = parse_path(&full_path);
                    let value = parse_value(value);
                    let message = serde_json::json!({
                        "type": "input",
                        "path": path_vec,
                        "value": value
                    });
                    send_to_webview(&tab_data.webview, &message);
                }
                // Then use the control
                let path_vec = parse_path(&path);
                let message = serde_json::json!({
                    "type": "use",
                    "path": path_vec
                });
                send_to_webview(&tab_data.webview, &message);
                let _ = response_tx.send(String::new());
            } else {
                let _ = response_tx.send(format!("Tab '{}' not found\n", tab));
            }
        }
        DaemonCommand::Fork {
            tab,
            path,
            name,
            data,
        } => {
            // For now, fork is not fully implemented - would need to create new tab
            // and navigate it. Placeholder response.
            let _ = response_tx.send(format!(
                "Fork not yet implemented: {} {} {:?} {:?}\n",
                tab, path, name, data
            ));
        }
        DaemonCommand::Close { tab } => {
            let mut tabs_lock = tabs.lock().unwrap();
            if let Some(idx) = resolve_tab(&tabs_lock, &tab) {
                tabs_lock.remove(idx);
                let _ = response_tx.send(format!("Closed tab '{}'\n", tab));
            } else {
                let _ = response_tx.send(format!("Tab '{}' not found\n", tab));
            }
        }
        DaemonCommand::Name { tab, name } => {
            let mut tabs_lock = tabs.lock().unwrap();
            // Check if new name is already in use
            if tabs_lock.iter().any(|t| t.name.as_deref() == Some(&name)) {
                let _ = response_tx.send(format!("Tab name '{}' already in use\n", name));
                return;
            }
            if let Some(idx) = resolve_tab(&tabs_lock, &tab) {
                tabs_lock[idx].name = Some(name.clone());
                let _ = response_tx.send(format!("Tab {} renamed to '{}'\n", idx + 1, name));
            } else {
                let _ = response_tx.send(format!("Tab '{}' not found\n", tab));
            }
        }
        DaemonCommand::Tabs => {
            let tabs_lock = tabs.lock().unwrap();
            if tabs_lock.is_empty() {
                let _ = response_tx.send("No open tabs\n".to_string());
            } else {
                let mut output = String::new();
                for (i, tab) in tabs_lock.iter().enumerate() {
                    let name_part = tab
                        .name
                        .as_ref()
                        .map(|n| format!(" ({})", n))
                        .unwrap_or_default();
                    output.push_str(&format!("{}{}  {}\n", i + 1, name_part, tab.url));
                }
                let _ = response_tx.send(output);
            }
        }
        DaemonCommand::Shutdown => {
            let _ = response_tx.send(String::new());
            cleanup();
            process::exit(0);
        }
    }
}

/// Get a value at a path within a JSON value
fn get_value_at_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for component in path.split('/').filter(|s| !s.is_empty()) {
        match current {
            Value::Object(map) => {
                current = map.get(component)?;
            }
            Value::Array(arr) => {
                let idx: usize = component.parse().ok()?;
                current = arr.get(idx)?;
            }
            _ => return None,
        }
    }
    Some(current)
}

fn parse_path(path_str: &str) -> Vec<Value> {
    path_str
        .split('/')
        .filter(|s| !s.is_empty())
        .map(|component| {
            // Try to parse as number, otherwise string
            if let Ok(num) = component.parse::<i64>() {
                Value::Number(num.into())
            } else {
                Value::String(component.to_string())
            }
        })
        .collect()
}

fn parse_value(value_str: &str) -> Value {
    match value_str {
        "true" | "True" => Value::Bool(true),
        "false" | "False" => Value::Bool(false),
        "null" | "None" => Value::Null,
        s => {
            // Try number
            if let Ok(num) = s.parse::<i64>() {
                Value::Number(num.into())
            } else if let Ok(num) = s.parse::<f64>() {
                Value::Number(serde_json::Number::from_f64(num).unwrap())
            } else {
                // String (remove quotes if present)
                let trimmed = s.trim_matches('"').trim_matches('\'');
                Value::String(trimmed.to_string())
            }
        }
    }
}

fn send_to_webview(webview: &wry::webview::WebView, message: &Value) {
    let script = format!(
        r#"window.dispatchEvent(new MessageEvent('message', {{
            data: {}
        }}));"#,
        serde_json::to_string(&serde_json::to_string(message).unwrap()).unwrap()
    );

    if let Err(e) = webview.evaluate_script(&script) {
        eprintln!("Failed to send message to webview: {}", e);
    }
}

fn handle_webview_message(tab_idx: usize, msg: String, tabs: &Arc<Mutex<Vec<Tab>>>) {
    if let Ok(data) = serde_json::from_str::<Value>(&msg)
        && let Some(msg_type) = data.get("type").and_then(|v| v.as_str())
        && msg_type == "mutation"
        && let Some(hypermap) = data.get("data")
    {
        let mut tabs_lock = tabs.lock().unwrap();
        if let Some(tab) = tabs_lock.get_mut(tab_idx) {
            tab.hypermap = hypermap.clone();
        }
    }
}

fn send_command(cmd: &str) {
    match UnixStream::connect(socket_path()) {
        Ok(mut stream) => {
            if let Err(e) = stream.write_all(cmd.as_bytes()) {
                eprintln!("Failed to send command: {}", e);
                return;
            }
            // Shutdown write side to signal end of command
            let _ = stream.shutdown(std::net::Shutdown::Write);
            // Read response
            let mut response = String::new();
            if stream.read_to_string(&mut response).is_ok() && !response.is_empty() {
                print!("{}", response);
            }
        }
        Err(_) => {
            eprintln!("Failed to connect to daemon. Is it running?");
        }
    }
}

fn stop_daemon() {
    send_command("shutdown");
    std::thread::sleep(std::time::Duration::from_millis(500));
    cleanup();
    println!("Daemon stopped");
}

fn cleanup() {
    let _ = fs::remove_file(socket_path());
    let _ = fs::remove_file(pid_path());
}

#[cfg(test)]
fn format_hypermap(value: &Value, indent: usize) -> String {
    format_hypermap_styled(value, indent, false)
}

fn format_hypermap_styled(value: &Value, indent: usize, use_color: bool) -> String {
    let mut output = String::new();
    format_hypermap_recursive(value, indent, &mut output, use_color);
    output
}

fn format_hypermap_recursive(value: &Value, indent: usize, output: &mut String, use_color: bool) {
    use std::fmt::Write;
    let indent_str = "  ".repeat(indent);

    match value {
        Value::Object(map) => {
            for (key, val) in map {
                // Skip the "#" metadata key
                if key == "#" {
                    continue;
                }

                // Check if this key has a control marker (has "#" child with type: "control")
                let is_control = if let Value::Object(obj) = val {
                    obj.get("#")
                        .and_then(|v| v.get("type"))
                        .and_then(|v| v.as_str())
                        == Some("control")
                } else {
                    false
                };

                // Check if object has non-# children
                let has_children = if let Value::Object(obj) = val {
                    obj.iter().any(|(k, _)| k != "#")
                } else {
                    matches!(val, Value::Array(_))
                };

                // Build suffix: @ for control, / for has children
                let suffix = match (is_control, has_children) {
                    (true, true) => "@/",
                    (true, false) => "@",
                    (false, true) => "/",
                    (false, false) => "",
                };

                // Format the key with optional bold for controls
                let formatted_key = if is_control && use_color {
                    format!("\x1b[1m{}{}\x1b[0m", key, suffix)
                } else {
                    format!("{}{}", key, suffix)
                };

                // Format the value
                match val {
                    Value::Object(_) | Value::Array(_) => {
                        writeln!(output, "{}{}", indent_str, formatted_key).unwrap();
                        if has_children {
                            format_hypermap_recursive(val, indent + 1, output, use_color);
                        }
                    }
                    // Leaf nodes with values
                    Value::String(s) => {
                        writeln!(output, "{}{}: {}", indent_str, formatted_key, s).unwrap();
                    }
                    Value::Number(n) => {
                        writeln!(output, "{}{}: {}", indent_str, formatted_key, n).unwrap();
                    }
                    Value::Bool(b) => {
                        writeln!(output, "{}{}: {}", indent_str, formatted_key, b).unwrap();
                    }
                    Value::Null => {
                        writeln!(output, "{}{}: null", indent_str, formatted_key).unwrap();
                    }
                }
            }
        }
        Value::Array(arr) => {
            for (i, val) in arr.iter().enumerate() {
                let has_children = matches!(val, Value::Object(_) | Value::Array(_));
                let suffix = if has_children { "/" } else { "" };

                match val {
                    Value::Object(_) | Value::Array(_) => {
                        writeln!(output, "{}[{}]{}", indent_str, i, suffix).unwrap();
                        format_hypermap_recursive(val, indent + 1, output, use_color);
                    }
                    Value::String(s) => writeln!(output, "{}[{}]: {}", indent_str, i, s).unwrap(),
                    Value::Number(n) => writeln!(output, "{}[{}]: {}", indent_str, i, n).unwrap(),
                    Value::Bool(b) => writeln!(output, "{}[{}]: {}", indent_str, i, b).unwrap(),
                    Value::Null => writeln!(output, "{}[{}]: null", indent_str, i).unwrap(),
                }
            }
        }
        _ => {
            // For scalar values at root level
            match value {
                Value::String(s) => writeln!(output, "{}{}", indent_str, s).unwrap(),
                Value::Number(n) => writeln!(output, "{}{}", indent_str, n).unwrap(),
                Value::Bool(b) => writeln!(output, "{}{}", indent_str, b).unwrap(),
                Value::Null => writeln!(output, "{}null", indent_str).unwrap(),
                _ => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // parse_command tests

    #[test]
    fn parse_command_open() {
        let cmd = parse_command("open https://example.com").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Open { ref url, name: None } if url == "https://example.com")
        );
    }

    #[test]
    fn parse_command_open_with_name() {
        let cmd = parse_command("open https://example.com --name myapp").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Open { ref url, ref name } if url == "https://example.com" && name.as_deref() == Some("myapp"))
        );
    }

    #[test]
    fn parse_command_open_with_spaces() {
        let cmd = parse_command("open https://example.com/path with spaces").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Open { ref url, .. } if url == "https://example.com/path with spaces")
        );
    }

    #[test]
    fn parse_command_show() {
        let cmd = parse_command("show 1").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Show { ref tab, path: None, color: false } if tab == "1")
        );
    }

    #[test]
    fn parse_command_show_with_path() {
        let cmd = parse_command("show 1 nav/home").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Show { ref tab, ref path, color: false } if tab == "1" && path.as_deref() == Some("nav/home"))
        );
    }

    #[test]
    fn parse_command_show_with_color() {
        let cmd = parse_command("show 1 --color").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Show { ref tab, path: None, color: true } if tab == "1")
        );
    }

    #[test]
    fn parse_command_show_with_path_and_color() {
        let cmd = parse_command("show 1 nav/home --color").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Show { ref tab, ref path, color: true } if tab == "1" && path.as_deref() == Some("nav/home"))
        );
    }

    #[test]
    fn parse_command_use() {
        let cmd = parse_command("use 1 nav/home").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Use { ref tab, ref path, .. } if tab == "1" && path == "nav/home")
        );
    }

    #[test]
    fn parse_command_use_with_data() {
        let cmd = parse_command("use 1 submit quantity=5").unwrap();
        if let DaemonCommand::Use { tab, path, data } = cmd {
            assert_eq!(tab, "1");
            assert_eq!(path, "submit");
            assert_eq!(data, vec![("quantity".to_string(), "5".to_string())]);
        } else {
            panic!("Expected Use command");
        }
    }

    #[test]
    fn parse_command_close() {
        let cmd = parse_command("close 2").unwrap();
        assert!(matches!(cmd, DaemonCommand::Close { ref tab } if tab == "2"));
    }

    #[test]
    fn parse_command_close_by_name() {
        let cmd = parse_command("close myapp").unwrap();
        assert!(matches!(cmd, DaemonCommand::Close { ref tab } if tab == "myapp"));
    }

    #[test]
    fn parse_command_name() {
        let cmd = parse_command("name 1 stocks").unwrap();
        assert!(
            matches!(cmd, DaemonCommand::Name { ref tab, ref name } if tab == "1" && name == "stocks")
        );
    }

    #[test]
    fn parse_command_tabs() {
        let cmd = parse_command("tabs").unwrap();
        assert!(matches!(cmd, DaemonCommand::Tabs));
    }

    #[test]
    fn parse_command_shutdown() {
        let cmd = parse_command("shutdown").unwrap();
        assert!(matches!(cmd, DaemonCommand::Shutdown));
    }

    #[test]
    fn parse_command_empty() {
        assert!(parse_command("").is_none());
    }

    #[test]
    fn parse_command_unknown() {
        assert!(parse_command("unknown").is_none());
    }

    #[test]
    fn parse_command_open_missing_url() {
        // Currently returns empty string URL, which is valid
        let cmd = parse_command("open").unwrap();
        assert!(matches!(cmd, DaemonCommand::Open { ref url, .. } if url.is_empty()));
    }

    #[test]
    fn parse_command_show_by_name() {
        // show now accepts tab references (name or index)
        let cmd = parse_command("show myapp").unwrap();
        assert!(matches!(cmd, DaemonCommand::Show { ref tab, .. } if tab == "myapp"));
    }

    // parse_path tests

    #[test]
    fn parse_path_simple() {
        let path = parse_path("foo");
        assert_eq!(path, vec![json!("foo")]);
    }

    #[test]
    fn parse_path_nested() {
        let path = parse_path("foo/bar/baz");
        assert_eq!(path, vec![json!("foo"), json!("bar"), json!("baz")]);
    }

    #[test]
    fn parse_path_with_numeric() {
        let path = parse_path("items/0/name");
        assert_eq!(path, vec![json!("items"), json!(0), json!("name")]);
    }

    #[test]
    fn parse_path_empty() {
        let path = parse_path("");
        assert_eq!(path, Vec::<Value>::new());
    }

    #[test]
    fn parse_path_leading_slash() {
        let path = parse_path("/foo/bar");
        assert_eq!(path, vec![json!("foo"), json!("bar")]);
    }

    #[test]
    fn parse_path_trailing_slash() {
        let path = parse_path("foo/bar/");
        assert_eq!(path, vec![json!("foo"), json!("bar")]);
    }

    // parse_value tests

    #[test]
    fn parse_value_true() {
        assert_eq!(parse_value("true"), json!(true));
        assert_eq!(parse_value("True"), json!(true));
    }

    #[test]
    fn parse_value_false() {
        assert_eq!(parse_value("false"), json!(false));
        assert_eq!(parse_value("False"), json!(false));
    }

    #[test]
    fn parse_value_null() {
        assert_eq!(parse_value("null"), json!(null));
        assert_eq!(parse_value("None"), json!(null));
    }

    #[test]
    fn parse_value_integer() {
        assert_eq!(parse_value("123"), json!(123));
        assert_eq!(parse_value("-42"), json!(-42));
    }

    #[test]
    fn parse_value_float() {
        assert_eq!(parse_value("45.67"), json!(45.67));
        assert_eq!(parse_value("-3.14"), json!(-3.14));
    }

    #[test]
    fn parse_value_string() {
        assert_eq!(parse_value("hello"), json!("hello"));
    }

    #[test]
    fn parse_value_quoted_string() {
        assert_eq!(parse_value("\"hello world\""), json!("hello world"));
        assert_eq!(parse_value("'hello world'"), json!("hello world"));
    }

    // format_hypermap tests

    #[test]
    fn format_hypermap_simple_value() {
        let value = json!({"price": 42});
        let output = format_hypermap(&value, 0);
        assert_eq!(output, "price: 42\n");
    }

    #[test]
    fn format_hypermap_string_value() {
        let value = json!({"name": "test"});
        let output = format_hypermap(&value, 0);
        assert_eq!(output, "name: test\n");
    }

    #[test]
    fn format_hypermap_null_value() {
        let value = json!({"status": null});
        let output = format_hypermap(&value, 0);
        assert_eq!(output, "status: null\n");
    }

    #[test]
    fn format_hypermap_bool_value() {
        let value = json!({"active": true});
        let output = format_hypermap(&value, 0);
        assert_eq!(output, "active: true\n");
    }

    #[test]
    fn format_hypermap_nested_object() {
        let value = json!({"nav": {"home": "/"} });
        let output = format_hypermap(&value, 0);
        // nav has children, so it gets /
        assert_eq!(output, "nav/\n  home: /\n");
    }

    #[test]
    fn format_hypermap_array() {
        let value = json!({"items": [1, 2, 3]});
        let output = format_hypermap(&value, 0);
        // items has children (array), so it gets /
        assert_eq!(output, "items/\n  [0]: 1\n  [1]: 2\n  [2]: 3\n");
    }

    #[test]
    fn format_hypermap_control_no_children() {
        // Control is an object with only "#" key containing type: "control"
        let value = json!({"home": {"#": {"type": "control"}}});
        let output = format_hypermap(&value, 0);
        // Control with no children gets @ suffix (no bold without color flag)
        assert_eq!(output, "home@\n");
    }

    #[test]
    fn format_hypermap_control_with_color() {
        // Control with color enabled
        let value = json!({"home": {"#": {"type": "control"}}});
        let output = format_hypermap_styled(&value, 0, true);
        // Control with color gets bold
        assert_eq!(output, "\x1b[1mhome@\x1b[0m\n");
    }

    #[test]
    fn format_hypermap_control_with_children() {
        // Control with additional children beyond "#"
        let value = json!({"nav": {"#": {"type": "control"}, "label": "Home"}});
        let output = format_hypermap(&value, 0);
        // Control with children gets @/ suffix
        assert_eq!(output, "nav@/\n  label: Home\n");
    }

    #[test]
    fn format_hypermap_control_with_children_color() {
        // Control with additional children beyond "#", with color
        let value = json!({"nav": {"#": {"type": "control"}, "label": "Home"}});
        let output = format_hypermap_styled(&value, 0, true);
        // Control with children gets @/ suffix and bold
        assert_eq!(output, "\x1b[1mnav@/\x1b[0m\n  label: Home\n");
    }

    #[test]
    fn format_hypermap_skips_hash_key() {
        let value = json!({"#": {"type": "control"}, "name": "test"});
        let output = format_hypermap(&value, 0);
        // "#" key should not appear in output
        assert!(!output.contains("#"));
        assert!(output.contains("name: test"));
    }

    #[test]
    fn format_hypermap_with_indent() {
        let value = json!({"a": 1});
        let output = format_hypermap(&value, 2);
        assert_eq!(output, "    a: 1\n");
    }
}
