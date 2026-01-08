use serde_json::Value;
use std::fs;
use std::io::{Read, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::Path;
use std::process;
use std::sync::{Arc, Mutex};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop, EventLoopProxy};
use tao::window::WindowBuilder;
use wry::webview::WebViewBuilder;

const SOCKET_PATH: &str = "/tmp/mech.sock";
const PID_PATH: &str = "/tmp/mech.pid";

#[derive(Debug, Clone)]
enum DaemonCommand {
    Open(String),
    TabCommand(usize, String),
    Show(usize),
    Close(usize),
    Shutdown,
}

#[derive(Debug, Clone)]
enum UserEvent {
    Command(DaemonCommand),
    WebViewMessage(usize, String),
}

struct Tab {
    #[allow(dead_code)]
    webview: wry::webview::WebView,
    #[allow(dead_code)]
    url: String,
    hypermap: Value,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        print_usage();
        return;
    }

    match args[1].as_str() {
        "start" => start_daemon(),
        "stop" => stop_daemon(),
        "open" => {
            if args.len() < 3 {
                eprintln!("Usage: mech open <url>");
                return;
            }
            send_command(&format!("open {}", args[2]));
        }
        "close" => {
            if args.len() < 3 {
                eprintln!("Usage: mech close <tab>");
                return;
            }
            send_command(&format!("close {}", args[2]));
        }
        arg if arg.starts_with('@') => {
            // Handle @N or @N path syntax
            let tab_ref = &arg[1..];

            if args.len() < 3 {
                // Just @N - show the tab
                send_command(&format!("show {}", tab_ref));
            } else {
                // @N path - use control at path
                let path = args[2..].join(" ");
                send_command(&format!("tabs {} {}", tab_ref, path));
            }
        }
        _ => print_usage(),
    }
}

fn print_usage() {
    println!("Usage:");
    println!("  mech start          - Start the daemon");
    println!("  mech stop           - Stop the daemon");
    println!("  mech open <url>     - Open a new tab");
    println!("  mech @<n>           - Show tab contents");
    println!("  mech @<n> <path>    - Use control at path");
    println!("  mech close <n>      - Close tab");
}

fn start_daemon() {
    // Check if already running
    if Path::new(PID_PATH).exists() {
        eprintln!("Daemon already running (PID file exists)");
        return;
    }

    // Write PID file
    fs::write(PID_PATH, process::id().to_string()).expect("Failed to write PID file");

    // Remove old socket if exists
    let _ = fs::remove_file(SOCKET_PATH);

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
                UserEvent::Command(cmd) => {
                    handle_command(cmd, &tabs_clone, event_loop, &proxy);
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
    let listener = UnixListener::bind(SOCKET_PATH).expect("Failed to bind socket");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                let mut buffer = String::new();
                if stream.read_to_string(&mut buffer).is_ok()
                    && let Some(cmd) = parse_command(&buffer)
                {
                    let _ = proxy.send_event(UserEvent::Command(cmd));
                }
            }
            Err(e) => eprintln!("Socket error: {}", e),
        }
    }
}

fn parse_command(input: &str) -> Option<DaemonCommand> {
    let parts: Vec<&str> = input.split_whitespace().collect();

    match *parts.first()? {
        "open" => Some(DaemonCommand::Open(parts[1..].join(" "))),
        "tabs" => {
            let idx = parts.get(1)?.parse::<usize>().ok()?;
            let cmd = parts[2..].join(" ");
            Some(DaemonCommand::TabCommand(idx, cmd))
        }
        "show" => {
            let idx = parts.get(1)?.parse::<usize>().ok()?;
            Some(DaemonCommand::Show(idx))
        }
        "close" => {
            let idx = parts.get(1)?.parse::<usize>().ok()?;
            Some(DaemonCommand::Close(idx))
        }
        "shutdown" => Some(DaemonCommand::Shutdown),
        _ => None,
    }
}

fn handle_command(
    cmd: DaemonCommand,
    tabs: &Arc<Mutex<Vec<Tab>>>,
    event_loop: &tao::event_loop::EventLoopWindowTarget<UserEvent>,
    proxy: &EventLoopProxy<UserEvent>,
) {
    match cmd {
        DaemonCommand::Open(url) => {
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
                hypermap: Value::Object(serde_json::Map::new()),
            };

            tabs.lock().unwrap().push(tab);
            println!("Opened tab {} at {}", tab_idx + 1, url);
        }
        DaemonCommand::TabCommand(idx, cmd) => {
            let tabs_lock = tabs.lock().unwrap();
            if let Some(tab) = tabs_lock.get(idx - 1) {
                handle_tab_command(tab, &cmd);
            } else {
                eprintln!("Tab {} not found", idx);
            }
        }
        DaemonCommand::Show(idx) => {
            let tabs_lock = tabs.lock().unwrap();
            if let Some(tab) = tabs_lock.get(idx - 1) {
                print_hypermap(&tab.hypermap, 0);
            } else {
                eprintln!("Tab {} not found", idx);
            }
        }
        DaemonCommand::Close(idx) => {
            let mut tabs_lock = tabs.lock().unwrap();
            if idx > 0 && idx <= tabs_lock.len() {
                tabs_lock.remove(idx - 1);
                println!("Closed tab {}", idx);
            } else {
                eprintln!("Tab {} not found", idx);
            }
        }
        DaemonCommand::Shutdown => {
            cleanup();
            process::exit(0);
        }
    }
}

fn handle_tab_command(tab: &Tab, cmd: &str) {
    // Parse command like "home" or "foo/bar=True"
    if let Some(eq_pos) = cmd.find('=') {
        // Input command: foo/bar=True
        let path_str = &cmd[..eq_pos];
        let value_str = &cmd[eq_pos + 1..];

        let path = parse_path(path_str);
        let value = parse_value(value_str);

        let message = serde_json::json!({
            "type": "input",
            "path": path,
            "value": value
        });

        send_to_webview(&tab.webview, &message);
    } else {
        // Use command: home
        let path = parse_path(cmd);

        let message = serde_json::json!({
            "type": "use",
            "path": path
        });

        send_to_webview(&tab.webview, &message);
    }
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
    match UnixStream::connect(SOCKET_PATH) {
        Ok(mut stream) => {
            if let Err(e) = stream.write_all(cmd.as_bytes()) {
                eprintln!("Failed to send command: {}", e);
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
    let _ = fs::remove_file(SOCKET_PATH);
    let _ = fs::remove_file(PID_PATH);
}

fn print_hypermap(value: &Value, indent: usize) {
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

                // Print the value
                match val {
                    Value::Object(_) if has_children => {
                        // Key with children - show with colon
                        if is_control {
                            println!("{}\x1b[1m{}\x1b[0m:", indent_str, key); // Bold
                        } else {
                            println!("{}{}:", indent_str, key);
                        }
                        print_hypermap(val, indent + 1);
                    }
                    Value::Object(_) => {
                        // Control with only "#" key - treat as leaf node
                        if is_control {
                            println!("{}\x1b[1m{}\x1b[0m", indent_str, key); // Bold, no colon
                        } else {
                            println!("{}{}", indent_str, key);
                        }
                    }
                    Value::Array(_) => {
                        // Key with children - show with colon
                        if is_control {
                            println!("{}\x1b[1m{}\x1b[0m:", indent_str, key); // Bold
                        } else {
                            println!("{}{}:", indent_str, key);
                        }
                        print_hypermap(val, indent + 1);
                    }
                    // Leaf nodes with values - show with colon
                    Value::String(s) => {
                        if is_control {
                            println!("{}\x1b[1m{}\x1b[0m: {}", indent_str, key, s);
                        } else {
                            println!("{}{}: {}", indent_str, key, s);
                        }
                    }
                    Value::Number(n) => {
                        if is_control {
                            println!("{}\x1b[1m{}\x1b[0m: {}", indent_str, key, n);
                        } else {
                            println!("{}{}: {}", indent_str, key, n);
                        }
                    }
                    Value::Bool(b) => {
                        if is_control {
                            println!("{}\x1b[1m{}\x1b[0m: {}", indent_str, key, b);
                        } else {
                            println!("{}{}: {}", indent_str, key, b);
                        }
                    }
                    Value::Null => {
                        if is_control {
                            println!("{}\x1b[1m{}\x1b[0m: null", indent_str, key);
                        } else {
                            println!("{}{}: null", indent_str, key);
                        }
                    }
                }
            }
        }
        Value::Array(arr) => {
            for (i, val) in arr.iter().enumerate() {
                match val {
                    Value::Object(_) => {
                        println!("{}[{}]:", indent_str, i);
                        print_hypermap(val, indent + 1);
                    }
                    Value::Array(_) => {
                        println!("{}[{}]:", indent_str, i);
                        print_hypermap(val, indent + 1);
                    }
                    Value::String(s) => println!("{}[{}] {}", indent_str, i, s),
                    Value::Number(n) => println!("{}[{}] {}", indent_str, i, n),
                    Value::Bool(b) => println!("{}[{}] {}", indent_str, i, b),
                    Value::Null => println!("{}[{}] null", indent_str, i),
                }
            }
        }
        _ => {
            // For scalar values at root level
            match value {
                Value::String(s) => println!("{}{}", indent_str, s),
                Value::Number(n) => println!("{}{}", indent_str, n),
                Value::Bool(b) => println!("{}{}", indent_str, b),
                Value::Null => println!("{}null", indent_str),
                _ => {}
            }
        }
    }
}
