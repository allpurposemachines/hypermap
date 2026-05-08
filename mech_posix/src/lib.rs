// Shared types and utilities for mech CLI
//
// This module contains code shared between the mech client and mechd daemon.
// Communication uses the varlink protocol: JSON messages over a Unix socket,
// framed with null byte (\0) delimiters.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fmt::Write;
use std::fs;
use std::io;

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

// -- Varlink framing ----------------------------------------------------------

/// Write a varlink message: JSON bytes followed by a null byte.
pub fn write_message(writer: &mut impl io::Write, msg: &[u8]) -> io::Result<()> {
    writer.write_all(msg)?;
    writer.write_all(&[0])?;
    writer.flush()
}

/// Read a varlink message: consume bytes until a null byte or EOF.
pub fn read_message(reader: &mut impl io::Read) -> io::Result<Vec<u8>> {
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        match reader.read(&mut byte) {
            Ok(0) => {
                if buf.is_empty() {
                    return Err(io::Error::new(
                        io::ErrorKind::UnexpectedEof,
                        "connection closed",
                    ));
                }
                break;
            }
            Ok(_) => {
                if byte[0] == 0 {
                    break;
                }
                buf.push(byte[0]);
            }
            Err(e) => return Err(e),
        }
    }
    Ok(buf)
}

// -- Protocol types -----------------------------------------------------------

/// Daemon protocol commands (varlink methods).
///
/// Serializes as `{"method": "Open", "parameters": {"url": "..."}}` which
/// matches the varlink wire format.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", content = "parameters")]
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
        data: HashMap<String, String>,
    },
    Fork {
        tab: String,
        name: Option<String>,
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

/// Daemon error variants (varlink errors).
///
/// Serializes as `{"error": "TabNotFound", "parameters": {"tab": "1"}}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "error", content = "parameters")]
pub enum DaemonError {
    TabNotFound { tab: String },
    PathNotFound { tab: String, path: String },
    NameInUse { name: String },
    InvalidUrl { url: String, reason: String },
    PageError { message: String },
}

impl DaemonError {
    /// Human-readable rendering for the CLI to print to stderr.
    pub fn user_message(&self) -> String {
        match self {
            DaemonError::TabNotFound { tab } => format!("Tab '{}' not found", tab),
            DaemonError::PathNotFound { tab, path } => {
                format!("Path '{}' not found in tab '{}'", path, tab)
            }
            DaemonError::NameInUse { name } => format!("Tab name '{}' already in use", name),
            DaemonError::InvalidUrl { url, reason } => {
                format!("Invalid URL '{}': {}", url, reason)
            }
            DaemonError::PageError { message } => message.trim_end().to_string(),
        }
    }
}

/// Successful response parameters.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DaemonOk {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub message: String,
}

/// Daemon reply (varlink reply).
///
/// On success: `{"parameters": {"message": "..."}}` (or `{"parameters": {}}` for unit returns).
/// On error: `{"error": "TabNotFound", "parameters": {"tab": "1"}}`.
///
/// `Err` is tried first when deserializing untagged: it requires a top-level
/// `error` field, so success replies fall through to the `Ok` variant.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DaemonReply {
    Err(DaemonError),
    Ok { parameters: DaemonOk },
}

impl DaemonReply {
    pub fn ok() -> Self {
        DaemonReply::Ok {
            parameters: DaemonOk::default(),
        }
    }

    pub fn ok_message(message: impl Into<String>) -> Self {
        DaemonReply::Ok {
            parameters: DaemonOk {
                message: message.into(),
            },
        }
    }
}

#[cfg(test)]
pub fn format_hypermap(value: &Value, indent: usize) -> String {
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
    use std::io::Cursor;

    // -- Roundtrip serialization tests ----------------------------------------

    fn roundtrip(cmd: &DaemonCommand) -> DaemonCommand {
        let json = serde_json::to_vec(cmd).unwrap();
        serde_json::from_slice(&json).unwrap()
    }

    #[test]
    fn roundtrip_open() {
        let cmd = DaemonCommand::Open {
            url: "https://example.com".into(),
            name: None,
        };
        assert!(matches!(
            roundtrip(&cmd),
            DaemonCommand::Open { ref url, name: None } if url == "https://example.com"
        ));
    }

    #[test]
    fn roundtrip_open_with_name() {
        let cmd = DaemonCommand::Open {
            url: "https://example.com".into(),
            name: Some("myapp".into()),
        };
        assert!(matches!(
            roundtrip(&cmd),
            DaemonCommand::Open { ref url, ref name }
                if url == "https://example.com" && name.as_deref() == Some("myapp")
        ));
    }

    #[test]
    fn roundtrip_show() {
        let cmd = DaemonCommand::Show {
            tab: "1".into(),
            path: Some("nav/home".into()),
            color: true,
        };
        assert!(matches!(
            roundtrip(&cmd),
            DaemonCommand::Show { ref tab, ref path, color: true }
                if tab == "1" && path.as_deref() == Some("nav/home")
        ));
    }

    #[test]
    fn roundtrip_set() {
        let cmd = DaemonCommand::Set {
            tab: "1".into(),
            path: "market/ibm/quantity".into(),
            value: "100".into(),
        };
        if let DaemonCommand::Set { tab, path, value } = roundtrip(&cmd) {
            assert_eq!(tab, "1");
            assert_eq!(path, "market/ibm/quantity");
            assert_eq!(value, "100");
        } else {
            panic!("Expected Set");
        }
    }

    #[test]
    fn roundtrip_use_with_data() {
        let mut data = HashMap::new();
        data.insert("quantity".into(), "5".into());
        let cmd = DaemonCommand::Use {
            tab: "1".into(),
            path: "submit".into(),
            data,
        };
        if let DaemonCommand::Use { tab, path, data } = roundtrip(&cmd) {
            assert_eq!(tab, "1");
            assert_eq!(path, "submit");
            assert_eq!(data.get("quantity"), Some(&"5".to_string()));
            assert_eq!(data.len(), 1);
        } else {
            panic!("Expected Use");
        }
    }

    #[test]
    fn use_data_serializes_as_json_object() {
        let mut data = HashMap::new();
        data.insert("quantity".into(), "5".into());
        data.insert("symbol".into(), "IBM".into());
        let cmd = DaemonCommand::Use {
            tab: "1".into(),
            path: "submit".into(),
            data,
        };
        let val: Value = serde_json::to_value(&cmd).unwrap();
        let params = &val["parameters"];
        assert!(params["data"].is_object());
        assert_eq!(params["data"]["quantity"], "5");
        assert_eq!(params["data"]["symbol"], "IBM");
    }

    #[test]
    fn roundtrip_fork() {
        let cmd = DaemonCommand::Fork {
            tab: "stocks".into(),
            name: Some("stocks2".into()),
        };
        assert!(matches!(
            roundtrip(&cmd),
            DaemonCommand::Fork { ref tab, ref name }
                if tab == "stocks" && name.as_deref() == Some("stocks2")
        ));
    }

    #[test]
    fn roundtrip_close() {
        let cmd = DaemonCommand::Close {
            tab: "2".into(),
        };
        assert!(matches!(roundtrip(&cmd), DaemonCommand::Close { ref tab } if tab == "2"));
    }

    #[test]
    fn roundtrip_name() {
        let cmd = DaemonCommand::Name {
            tab: "1".into(),
            name: "stocks".into(),
        };
        assert!(matches!(
            roundtrip(&cmd),
            DaemonCommand::Name { ref tab, ref name } if tab == "1" && name == "stocks"
        ));
    }

    #[test]
    fn roundtrip_tabs() {
        assert!(matches!(roundtrip(&DaemonCommand::Tabs), DaemonCommand::Tabs));
    }

    #[test]
    fn roundtrip_shutdown() {
        assert!(matches!(
            roundtrip(&DaemonCommand::Shutdown),
            DaemonCommand::Shutdown
        ));
    }

    #[test]
    fn json_shape_matches_varlink() {
        let cmd = DaemonCommand::Open {
            url: "https://example.com".into(),
            name: None,
        };
        let val: Value = serde_json::to_value(&cmd).unwrap();
        assert_eq!(val["method"], "Open");
        assert!(val["parameters"].is_object());
    }

    #[test]
    fn json_shape_unit_variant() {
        let val: Value = serde_json::to_value(&DaemonCommand::Tabs).unwrap();
        assert_eq!(val["method"], "Tabs");
        // Unit variants have no "parameters" key
        assert!(val.get("parameters").is_none());
    }

    // -- Framing tests --------------------------------------------------------

    #[test]
    fn framing_roundtrip() {
        let msg = b"hello";
        let mut buf = Vec::new();
        write_message(&mut buf, msg).unwrap();
        assert_eq!(buf, b"hello\0");

        let mut reader = Cursor::new(buf);
        let read_back = read_message(&mut reader).unwrap();
        assert_eq!(read_back, b"hello");
    }

    #[test]
    fn framing_empty_stream() {
        let mut reader = Cursor::new(Vec::<u8>::new());
        assert!(read_message(&mut reader).is_err());
    }

    #[test]
    fn framing_eof_without_null() {
        // Data without null terminator — read_message returns data at EOF
        let mut reader = Cursor::new(b"partial".to_vec());
        let msg = read_message(&mut reader).unwrap();
        assert_eq!(msg, b"partial");
    }

    // -- Reply tests ----------------------------------------------------------

    #[test]
    fn reply_ok_roundtrip() {
        let reply = DaemonReply::ok_message("Opened tab 1");
        let json = serde_json::to_vec(&reply).unwrap();
        let parsed: DaemonReply = serde_json::from_slice(&json).unwrap();
        match parsed {
            DaemonReply::Ok { parameters } => assert_eq!(parameters.message, "Opened tab 1"),
            DaemonReply::Err(_) => panic!("Expected Ok"),
        }
    }

    #[test]
    fn reply_ok_wire_shape() {
        let val: Value = serde_json::to_value(DaemonReply::ok_message("Opened tab 1")).unwrap();
        assert!(val.get("error").is_none());
        assert_eq!(val["parameters"]["message"], "Opened tab 1");
    }

    #[test]
    fn reply_ok_empty_omits_message() {
        let val: Value = serde_json::to_value(DaemonReply::ok()).unwrap();
        // Unit-return methods (`-> ()`) serialize as `{"parameters": {}}`.
        assert!(val["parameters"].is_object());
        assert_eq!(val["parameters"].as_object().unwrap().len(), 0);
    }

    #[test]
    fn reply_error_roundtrip() {
        let reply = DaemonReply::Err(DaemonError::TabNotFound { tab: "1".into() });
        let json = serde_json::to_vec(&reply).unwrap();
        let parsed: DaemonReply = serde_json::from_slice(&json).unwrap();
        match parsed {
            DaemonReply::Err(DaemonError::TabNotFound { tab }) => assert_eq!(tab, "1"),
            _ => panic!("Expected TabNotFound"),
        }
    }

    #[test]
    fn reply_error_wire_shape() {
        let reply = DaemonReply::Err(DaemonError::InvalidUrl {
            url: "bogus".into(),
            reason: "no scheme".into(),
        });
        let val: Value = serde_json::to_value(&reply).unwrap();
        assert_eq!(val["error"], "InvalidUrl");
        assert_eq!(val["parameters"]["url"], "bogus");
        assert_eq!(val["parameters"]["reason"], "no scheme");
    }

    #[test]
    fn reply_distinguishes_ok_from_err() {
        let err_json = r#"{"error": "TabNotFound", "parameters": {"tab": "1"}}"#;
        let parsed: DaemonReply = serde_json::from_str(err_json).unwrap();
        assert!(matches!(parsed, DaemonReply::Err(DaemonError::TabNotFound { .. })));

        let ok_json = r#"{"parameters": {"message": "hi"}}"#;
        let parsed: DaemonReply = serde_json::from_str(ok_json).unwrap();
        assert!(matches!(parsed, DaemonReply::Ok { .. }));
    }

    #[test]
    fn reply_ok_unit_parses_from_empty_parameters() {
        let parsed: DaemonReply = serde_json::from_str(r#"{"parameters": {}}"#).unwrap();
        match parsed {
            DaemonReply::Ok { parameters } => assert_eq!(parameters.message, ""),
            DaemonReply::Err(_) => panic!("Expected Ok"),
        }
    }

    #[test]
    fn error_user_messages() {
        assert_eq!(
            DaemonError::TabNotFound { tab: "1".into() }.user_message(),
            "Tab '1' not found"
        );
        assert_eq!(
            DaemonError::PathNotFound {
                tab: "1".into(),
                path: "nav/home".into()
            }
            .user_message(),
            "Path 'nav/home' not found in tab '1'"
        );
        assert_eq!(
            DaemonError::NameInUse { name: "stocks".into() }.user_message(),
            "Tab name 'stocks' already in use"
        );
    }

    // -- format_hypermap tests ------------------------------------------------

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
