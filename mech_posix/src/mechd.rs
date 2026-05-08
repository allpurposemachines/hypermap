// Headless browser daemon for mech CLI using Servo
//
// This is the daemon binary (mechd) that runs the Servo browser engine.
// It listens on a Unix socket and processes commands from the mech client.

use clap::Parser;
use serde_json::Value;
use std::cell::RefCell;
use std::collections::HashMap;
use std::fs::{self, File};
use std::os::fd::AsRawFd;
use std::os::unix::net::{UnixListener, UnixStream};
use std::process;
use std::rc::Rc;
use std::sync::mpsc;

use dpi::PhysicalSize;
use servo::{
    JSValue, LoadStatus, RenderingContext, Servo, ServoBuilder, ServoDelegate,
    SoftwareRenderingContext, WebView, WebViewBuilder, WebViewDelegate,
};
use url::Url;

use mech_cli::{
    cleanup, format_hypermap_styled, pid_path, read_message, socket_path, write_message,
    DaemonCommand, DaemonError, DaemonReply,
};

#[derive(Parser)]
#[command(name = "mechd", about = "Mech daemon - headless browser backend")]
struct Cli {
    /// Run in foreground (don't daemonize)
    #[arg(short, long)]
    foreground: bool,
}

/// Convert Servo's JSValue to serde_json::Value
fn jsvalue_to_json(jsval: &JSValue) -> Value {
    match jsval {
        JSValue::Undefined | JSValue::Null => Value::Null,
        JSValue::Boolean(b) => Value::Bool(*b),
        JSValue::Number(n) => {
            if let Some(num) = serde_json::Number::from_f64(*n) {
                Value::Number(num)
            } else {
                Value::Null
            }
        }
        JSValue::String(s) => Value::String(s.clone()),
        JSValue::Array(arr) => Value::Array(arr.iter().map(jsvalue_to_json).collect()),
        JSValue::Object(map) => Value::Object(
            map.iter()
                .map(|(k, v)| (k.clone(), jsvalue_to_json(v)))
                .collect(),
        ),
        // DOM references - just return their string representation
        JSValue::Element(s) | JSValue::ShadowRoot(s) | JSValue::Frame(s) | JSValue::Window(s) => {
            Value::String(s.clone())
        }
    }
}

/// A tab managed by the Servo daemon
struct Tab {
    webview: WebView,
    url: String,
    name: Option<String>,
}

/// State shared across the daemon
struct DaemonState {
    servo: Servo,
    tabs: Vec<Tab>,
    tab_counter: usize,
    #[allow(dead_code)]
    pending_responses: HashMap<usize, mpsc::Sender<DaemonReply>>,
}

/// Delegate for handling Servo-level events
struct MechServoDelegate;

impl ServoDelegate for MechServoDelegate {
    fn notify_error(&self, error: servo::ServoError) {
        // Log error but don't crash the daemon
        eprintln!("Servo error: {:?}", error);
    }
}

/// Delegate for handling WebView-level events
struct MechWebViewDelegate {
    #[allow(dead_code)]
    state: Rc<RefCell<DaemonState>>,
}

impl WebViewDelegate for MechWebViewDelegate {
    fn notify_load_status_changed(&self, _webview: WebView, _status: LoadStatus) {
        // Page load complete - no special handling needed
        // The shim auto-initializes when loaded
    }

    fn notify_new_frame_ready(&self, webview: WebView) {
        // Paint the frame (required for rendering pipeline to progress)
        webview.paint();
    }

    fn notify_crashed(&self, _webview: WebView, reason: String, _backtrace: Option<String>) {
        // Log crash but don't take down the daemon
        // The tab will remain but with no content
        eprintln!("WebView crashed: {}", reason);
    }
}

fn main() {
    let cli = Cli::parse();
    start_daemon(cli.foreground);
}

fn start_daemon(foreground: bool) {
    // Check if already running
    if UnixStream::connect(socket_path()).is_ok() {
        eprintln!("Daemon already running");
        process::exit(1);
    }

    // Clean up stale files
    let _ = fs::remove_file(socket_path());
    let _ = fs::remove_file(pid_path());

    if !foreground {
        // Daemonize: fork and let parent exit
        // This gives clean shell output (no background job notification)
        match unsafe { libc::fork() } {
            -1 => {
                eprintln!("Failed to fork");
                process::exit(1);
            }
            0 => {
                // Child process - continue as daemon
            }
            _ => {
                // Parent process - exit cleanly
                // Small delay to let child set up socket before parent exits
                std::thread::sleep(std::time::Duration::from_millis(100));
                return;
            }
        }

        // Create new session, detach from controlling terminal
        unsafe {
            libc::setsid();
        }
    }

    // Write PID file (now with daemon's actual PID)
    fs::write(pid_path(), process::id().to_string()).expect("Failed to write PID file");

    // Redirect stdout/stderr - use log file if MECH_LOG is set, otherwise /dev/null
    // In foreground mode, don't redirect unless MECH_LOG is set
    let log_path = std::env::var("MECH_LOG").ok();
    let log_target = if foreground && log_path.is_none() {
        None // Keep stdout/stderr in foreground mode
    } else {
        log_path
            .as_ref()
            .and_then(|p| File::options().create(true).append(true).open(p).ok())
            .or_else(|| File::options().write(true).open("/dev/null").ok())
    };

    if let Some(log_file) = log_target {
        let log_fd = log_file.as_raw_fd();
        unsafe {
            libc::dup2(log_fd, libc::STDOUT_FILENO);
            libc::dup2(log_fd, libc::STDERR_FILENO);
        }
        // Keep file open
        std::mem::forget(log_file);
    }

    // Build Servo instance (after redirecting output)
    let servo = ServoBuilder::default().build();

    servo.set_delegate(Rc::new(MechServoDelegate));

    let state = Rc::new(RefCell::new(DaemonState {
        servo,
        tabs: Vec::new(),
        tab_counter: 0,
        pending_responses: HashMap::new(),
    }));

    // Start socket listener thread
    let (cmd_tx, cmd_rx) = mpsc::channel::<(DaemonCommand, mpsc::Sender<DaemonReply>)>();
    std::thread::spawn(move || {
        socket_listener(cmd_tx);
    });

    // Set up panic hook to log panics before crashing
    std::panic::set_hook(Box::new(|info| {
        eprintln!("Daemon panic: {}", info);
    }));

    // Main event loop
    loop {
        // Process any pending commands
        while let Ok((cmd, response_tx)) = cmd_rx.try_recv() {
            handle_command(&state, cmd, response_tx);
        }

        // Spin Servo's event loop to process rendering/JS
        {
            let state_ref = state.borrow();
            state_ref.servo.spin_event_loop();
        }

        // Small sleep to avoid busy-waiting
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}

fn socket_listener(cmd_tx: mpsc::Sender<(DaemonCommand, mpsc::Sender<DaemonReply>)>) {
    let listener = UnixListener::bind(socket_path()).expect("Failed to bind socket");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                let msg = match read_message(&mut stream) {
                    Ok(m) => m,
                    Err(e) => {
                        eprintln!("Failed to read message: {}", e);
                        continue;
                    }
                };

                let cmd: DaemonCommand = match serde_json::from_slice(&msg) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Invalid command: {}", e);
                        let reply = DaemonReply::Err(DaemonError::PageError {
                            message: format!("Protocol error: {}. Is mechd up to date?", e),
                        });
                        if let Ok(json) = serde_json::to_vec(&reply) {
                            let _ = write_message(&mut stream, &json);
                        }
                        let _ = stream.shutdown(std::net::Shutdown::Write);
                        continue;
                    }
                };

                let (tx, rx) = mpsc::channel();
                let _ = cmd_tx.send((cmd, tx));

                if let Ok(reply) = rx.recv() {
                    if let Ok(json) = serde_json::to_vec(&reply) {
                        let _ = write_message(&mut stream, &json);
                    }
                    let _ = stream.shutdown(std::net::Shutdown::Write);
                }
            }
            Err(e) => eprintln!("Socket error: {}", e),
        }
    }
}

fn handle_command(
    state: &Rc<RefCell<DaemonState>>,
    cmd: DaemonCommand,
    response_tx: mpsc::Sender<DaemonReply>,
) {
    let mut state_ref = state.borrow_mut();

    match cmd {
        DaemonCommand::Open { url, name } => {
            if let Some(ref n) = name
                && state_ref.tabs.iter().any(|t| t.name.as_deref() == Some(n))
            {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::NameInUse {
                    name: n.clone(),
                }));
                return;
            }

            let full_url = if url.starts_with("http://") || url.starts_with("https://") {
                url.clone()
            } else {
                format!("https://{}", url)
            };

            let size = PhysicalSize::new(1024, 768);
            let rendering_context: Rc<dyn RenderingContext> =
                match SoftwareRenderingContext::new(size) {
                    Ok(ctx) => Rc::new(ctx),
                    Err(e) => {
                        let _ = response_tx.send(DaemonReply::Err(DaemonError::PageError {
                            message: format!("Failed to create rendering context: {:?}", e),
                        }));
                        return;
                    }
                };

            let tab_id = state_ref.tab_counter;
            state_ref.tab_counter += 1;

            let servo_url = match Url::parse(&full_url) {
                Ok(u) => u,
                Err(e) => {
                    let _ = response_tx.send(DaemonReply::Err(DaemonError::InvalidUrl {
                        url: full_url,
                        reason: format!("{:?}", e),
                    }));
                    return;
                }
            };

            let delegate = Rc::new(MechWebViewDelegate {
                state: state.clone(),
            });

            let webview = WebViewBuilder::new(&state_ref.servo, rendering_context)
                .url(servo_url)
                .delegate(delegate)
                .build();

            let tab = Tab {
                webview,
                url: full_url.clone(),
                name: name.clone(),
            };

            state_ref.tabs.push(tab);

            let display_name = name
                .map(|n| format!("{} ({})", tab_id + 1, n))
                .unwrap_or_else(|| (tab_id + 1).to_string());
            let _ = response_tx.send(DaemonReply::ok_message(format!(
                "Opened tab {} at {}\n",
                display_name, url
            )));
        }

        DaemonCommand::Show { tab, path, color } => {
            if let Some(idx) = resolve_tab(&state_ref.tabs, &tab) {
                let tab_data = &state_ref.tabs[idx];

                // Query JavaScript for the current hypermap state.
                // Returns hypermap if available, or diagnostic info if not.
                let script = r#"
                    (function() {
                        if (window.hypermap) {
                            return { ok: true, data: JSON.parse(JSON.stringify(window.hypermap)) };
                        }
                        return {
                            ok: false,
                            readyState: document.readyState,
                            title: document.title || null,
                            bodyText: document.body ? document.body.innerText.slice(0, 200) : null,
                            hasPre: !!document.querySelector('pre')
                        };
                    })()
                "#
                .to_string();

                let tab_clone = tab.clone();
                let path_clone = path.clone();
                let response_tx_clone = response_tx.clone();
                tab_data
                    .webview
                    .evaluate_javascript(script, move |result| match result {
                        Ok(jsval) => {
                            let response = jsvalue_to_json(&jsval);

                            if response.get("ok") == Some(&Value::Bool(true)) {
                                let hypermap = response.get("data").cloned().unwrap_or(Value::Null);

                                let value = if let Some(ref p) = path_clone {
                                    get_value_at_path(&hypermap, p).cloned()
                                } else {
                                    Some(hypermap)
                                };
                                match value {
                                    Some(v) => {
                                        let _ = response_tx_clone.send(DaemonReply::ok_message(
                                            format_hypermap_styled(&v, 0, color),
                                        ));
                                    }
                                    None => {
                                        let _ = response_tx_clone.send(DaemonReply::Err(
                                            DaemonError::PathNotFound {
                                                tab: tab_clone.clone(),
                                                path: path_clone.clone().unwrap_or_default(),
                                            },
                                        ));
                                    }
                                }
                            } else {
                                let msg = format_load_error(&response);
                                let _ = response_tx_clone.send(DaemonReply::Err(
                                    DaemonError::PageError { message: msg },
                                ));
                            }
                        }
                        Err(e) => {
                            let _ = response_tx_clone.send(DaemonReply::Err(
                                DaemonError::PageError {
                                    message: format!("Failed to query page: {:?}", e),
                                },
                            ));
                        }
                    });
                // Response will be sent by the callback above.
            } else {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::TabNotFound { tab }));
            }
        }

        DaemonCommand::Set { tab, path, value } => {
            if let Some(idx) = resolve_tab(&state_ref.tabs, &tab) {
                let tab_data = &state_ref.tabs[idx];

                let script = format!(
                    r#"
                    if (window.hypermap) {{
                        window.hypermap.input({:?}.split('/'), {:?});
                    }}
                    "#,
                    path, value
                );
                tab_data.webview.evaluate_javascript(script, |_| {});
                let _ = response_tx.send(DaemonReply::ok());
            } else {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::TabNotFound { tab }));
            }
        }

        DaemonCommand::Use { tab, path, data } => {
            if let Some(idx) = resolve_tab(&state_ref.tabs, &tab) {
                let tab_data = &state_ref.tabs[idx];

                for (key, value) in &data {
                    let full_path = format!("{}/{}", path, key);
                    let script = format!(
                        r#"
                        if (window.hypermap) {{
                            window.hypermap.input({:?}.split('/'), {:?});
                        }}
                        "#,
                        full_path, value
                    );
                    tab_data.webview.evaluate_javascript(script, |_| {});
                }

                let script = format!(
                    r#"
                    if (window.hypermap) {{
                        window.hypermap.use({:?}.split('/'));
                    }}
                    "#,
                    path
                );
                tab_data.webview.evaluate_javascript(script, |_| {});

                let state_clone = state.clone();
                tab_data
                    .webview
                    .evaluate_javascript("window.location.href".to_string(), move |result| {
                        if let Ok(JSValue::String(url)) = result {
                            if let Ok(mut state) = state_clone.try_borrow_mut() {
                                if let Some(tab) = state.tabs.get_mut(idx) {
                                    tab.url = url;
                                }
                            }
                        }
                    });

                let _ = response_tx.send(DaemonReply::ok());
            } else {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::TabNotFound { tab }));
            }
        }

        DaemonCommand::Fork { tab, name } => {
            if let Some(ref n) = name
                && state_ref.tabs.iter().any(|t| t.name.as_deref() == Some(n))
            {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::NameInUse {
                    name: n.clone(),
                }));
                return;
            }

            if let Some(idx) = resolve_tab(&state_ref.tabs, &tab) {
                let source_url = state_ref.tabs[idx].url.clone();

                let size = PhysicalSize::new(1024, 768);
                let rendering_context: Rc<dyn RenderingContext> =
                    match SoftwareRenderingContext::new(size) {
                        Ok(ctx) => Rc::new(ctx),
                        Err(e) => {
                            let _ = response_tx.send(DaemonReply::Err(DaemonError::PageError {
                                message: format!("Failed to create rendering context: {:?}", e),
                            }));
                            return;
                        }
                    };

                let tab_id = state_ref.tab_counter;
                state_ref.tab_counter += 1;

                let servo_url = match Url::parse(&source_url) {
                    Ok(u) => u,
                    Err(e) => {
                        let _ = response_tx.send(DaemonReply::Err(DaemonError::InvalidUrl {
                            url: source_url,
                            reason: format!("{:?}", e),
                        }));
                        return;
                    }
                };

                let delegate = Rc::new(MechWebViewDelegate {
                    state: state.clone(),
                });

                let webview = WebViewBuilder::new(&state_ref.servo, rendering_context)
                    .url(servo_url)
                    .delegate(delegate)
                    .build();

                let new_tab = Tab {
                    webview,
                    url: source_url,
                    name: name.clone(),
                };

                state_ref.tabs.push(new_tab);

                let display_name = name
                    .map(|n| format!("{} ({})", tab_id + 1, n))
                    .unwrap_or_else(|| (tab_id + 1).to_string());
                let _ = response_tx.send(DaemonReply::ok_message(format!(
                    "Forked to tab {}\n",
                    display_name
                )));
            } else {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::TabNotFound { tab }));
            }
        }

        DaemonCommand::Close { tab } => {
            if let Some(idx) = resolve_tab(&state_ref.tabs, &tab) {
                state_ref.tabs.remove(idx);
                let _ = response_tx.send(DaemonReply::ok_message(format!(
                    "Closed tab '{}'\n",
                    tab
                )));
            } else {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::TabNotFound { tab }));
            }
        }

        DaemonCommand::Name { tab, name } => {
            if state_ref
                .tabs
                .iter()
                .any(|t| t.name.as_deref() == Some(&name))
            {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::NameInUse { name }));
                return;
            }
            if let Some(idx) = resolve_tab(&state_ref.tabs, &tab) {
                state_ref.tabs[idx].name = Some(name.clone());
                let _ = response_tx.send(DaemonReply::ok_message(format!(
                    "Tab {} renamed to '{}'\n",
                    idx + 1,
                    name
                )));
            } else {
                let _ = response_tx.send(DaemonReply::Err(DaemonError::TabNotFound { tab }));
            }
        }

        DaemonCommand::Tabs => {
            if state_ref.tabs.is_empty() {
                let _ = response_tx.send(DaemonReply::ok_message("No open tabs\n"));
            } else {
                let mut output = String::new();
                for (i, tab) in state_ref.tabs.iter().enumerate() {
                    let name_part = tab
                        .name
                        .as_ref()
                        .map(|n| format!(" ({})", n))
                        .unwrap_or_default();
                    output.push_str(&format!("{}{}  {}\n", i + 1, name_part, tab.url));
                }
                let _ = response_tx.send(DaemonReply::ok_message(output));
            }
        }

        DaemonCommand::Shutdown => {
            let _ = response_tx.send(DaemonReply::ok());
            cleanup();
            process::exit(0);
        }
    }
}

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

/// Build a diagnostic message describing why hypermap content is unavailable.
/// The returned string is wrapped in `DaemonError::PageError`, so it carries
/// no trailing newline.
fn format_load_error(diagnostics: &Value) -> String {
    let ready_state = diagnostics
        .get("readyState")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let title = diagnostics
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let body_text = diagnostics
        .get("bodyText")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let has_pre = diagnostics
        .get("hasPre")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let title_lower = title.to_lowercase();
    let body_lower = body_text.to_lowercase();

    if title_lower.contains("not found") || body_lower.contains("not found") || title.contains("404")
    {
        return format!("Page not found (404): {}", title);
    }

    if title_lower.contains("error") || body_lower.contains("error") {
        let error_hint = if !title.is_empty() {
            title
        } else {
            body_text.lines().next().unwrap_or("Unknown error")
        };
        return format!("Page error: {}", error_hint);
    }

    if ready_state == "loading" {
        return "Page is still loading...".to_string();
    }

    if ready_state == "complete" && !has_pre {
        return "Page loaded but contains no hypermap content (no <pre> element)".to_string();
    }

    if ready_state == "complete" && has_pre {
        return "Page loaded but hypermap failed to initialize (check if page serves valid JSON)"
            .to_string();
    }

    format!(
        "No hypermap content (readyState: {}, title: {})",
        ready_state,
        if title.is_empty() { "<none>" } else { title }
    )
}
