// Shared types and utilities for mech CLI
//
// This module contains code shared between the mech client and mechd daemon.

use serde_json::Value;
use std::fmt::Write;
use std::fs;

pub fn socket_path() -> String {
    std::env::var("MECH_SOCKET_PATH").unwrap_or_else(|_| "/tmp/mech.sock".to_string())
}

pub fn pid_path() -> String {
    std::env::var("MECH_PID_PATH").unwrap_or_else(|_| "/tmp/mech.pid".to_string())
}

pub fn cleanup() {
    let _ = fs::remove_file(socket_path());
    let _ = fs::remove_file(pid_path());
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
    Set {
        tab: String,
        path: String,
        value: String,
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
        "set" => {
            // set <tab> <path> <value>
            let tab = parts.get(1)?.to_string();
            let path = parts.get(2)?.to_string();
            let value = parts.get(3)?.to_string();
            Some(DaemonCommand::Set { tab, path, value })
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
    fn parse_command_set() {
        let cmd = parse_command("set 1 market/ibm/quantity 100").unwrap();
        if let DaemonCommand::Set { tab, path, value } = cmd {
            assert_eq!(tab, "1");
            assert_eq!(path, "market/ibm/quantity");
            assert_eq!(value, "100");
        } else {
            panic!("Expected Set command");
        }
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
