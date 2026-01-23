use clap::{Parser, Subcommand};
use serde_json::Value;
use std::fs;
use std::io::{IsTerminal, Read, Write};
use std::os::unix::net::UnixStream;

mod servo_daemon;

pub fn socket_path() -> String {
    std::env::var("MECH_SOCKET_PATH").unwrap_or_else(|_| "/tmp/mech.sock".to_string())
}

pub fn pid_path() -> String {
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
pub enum DaemonCommand {
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

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Start => servo_daemon::start_daemon(),
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

pub fn parse_command(input: &str) -> Option<DaemonCommand> {
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

pub fn cleanup() {
    let _ = fs::remove_file(socket_path());
    let _ = fs::remove_file(pid_path());
}

#[cfg(test)]
fn format_hypermap(value: &Value, indent: usize) -> String {
    format_hypermap_styled(value, indent, false)
}

pub fn format_hypermap_styled(value: &Value, indent: usize, use_color: bool) -> String {
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
