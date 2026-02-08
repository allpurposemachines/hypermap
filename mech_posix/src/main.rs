// mech - CLI client for interacting with HyperMap resources
//
// This is the lightweight client binary. It communicates with the mechd daemon
// over a Unix socket to manage tabs and navigate HyperMap resources.

use clap::{Parser, Subcommand};
use std::io::{IsTerminal, Read, Write};
use std::os::unix::net::UnixStream;
use std::process::Command;

use mech_cli::{cleanup, socket_path};

#[cfg(test)]
use mech_cli::format_hypermap_styled;

#[derive(Parser)]
#[command(name = "mech", about = "CLI for interacting with HyperMap resources")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the daemon
    Start {
        /// Run in foreground (don't daemonize)
        #[arg(short, long)]
        foreground: bool,
    },
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
        #[arg(value_name = "TAB[:PATH]")]
        target: String,
    },
    /// Set a value at a path (input without triggering control)
    Set {
        /// Tab and path (e.g., "1:market/ibm/submitOrder/quantity")
        #[arg(value_name = "TAB:PATH")]
        target: String,
        /// Value to set
        #[arg(value_name = "VALUE")]
        value: String,
    },
    /// Use a control at a path
    Use {
        /// Tab and path (e.g., "1:nav/home", "stocks:submit")
        #[arg(value_name = "TAB:PATH")]
        target: String,
        /// Form data as key=value pairs
        #[arg(value_name = "KEY=VALUE")]
        data: Vec<String>,
    },
    /// Fork a tab (create a copy)
    Fork {
        /// Tab to fork (e.g., "1", "stocks")
        #[arg(value_name = "TAB")]
        tab: String,
        /// Optional name for the new tab
        #[arg(short, long)]
        name: Option<String>,
    },
    /// Close a tab
    Close {
        /// Tab reference (index or name)
        #[arg(value_name = "TAB")]
        tab: String,
    },
    /// Name or rename a tab
    Name {
        /// Tab reference (index or current name)
        #[arg(value_name = "TAB")]
        tab: String,
        /// New name for the tab
        #[arg(value_name = "NAME")]
        name: String,
    },
    /// List all open tabs
    Tabs,
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Start { foreground } => start_daemon(foreground),
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
        Commands::Set { target, value } => {
            let (tab, path) = parse_target(&target);
            let Some(path) = path else {
                eprintln!("error: set requires a path (e.g., \"{}:path/to/field\")", tab);
                std::process::exit(1);
            };
            send_command(&format!("set {} {} {}", tab, path, value));
        }
        Commands::Use { target, data } => {
            let (tab, path) = parse_target(&target);
            let Some(path) = path else {
                eprintln!("error: use requires a path (e.g., \"{}:path/to/control\")", tab);
                std::process::exit(1);
            };
            let data_str = data.join(" ");
            send_command(&format!("use {} {} {}", tab, path, data_str));
        }
        Commands::Fork { tab, name } => {
            let name_part = name.map(|n| format!(" --name {}", n)).unwrap_or_default();
            send_command(&format!("fork {}{}", tab, name_part));
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
            eprintln!("Failed to connect to daemon. Is it running? Try: mech start");
        }
    }
}

fn start_daemon(foreground: bool) {
    // Check if already running
    if UnixStream::connect(socket_path()).is_ok() {
        eprintln!("Daemon already running");
        return;
    }

    println!("Starting mech daemon...");

    // Spawn mechd
    let mut cmd = Command::new("mechd");
    if foreground {
        cmd.arg("--foreground");
    }

    match cmd.spawn() {
        Ok(mut child) => {
            if foreground {
                // Wait for the daemon if running in foreground
                let _ = child.wait();
            } else {
                // Wait for daemon to start (up to 3 seconds)
                let mut started = false;
                for _ in 0..30 {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    if UnixStream::connect(socket_path()).is_ok() {
                        started = true;
                        break;
                    }
                }

                if started {
                    println!("Daemon started");
                } else {
                    eprintln!("Daemon failed to start");
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to start daemon: {}", e);
            eprintln!("Make sure 'mechd' is in your PATH");
        }
    }
}

fn stop_daemon() {
    send_command("shutdown");
    std::thread::sleep(std::time::Duration::from_millis(500));
    cleanup();
    println!("Daemon stopped");
}

// Re-export for tests that need these
#[cfg(test)]
pub use mech_cli::{parse_command, DaemonCommand};

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_target_simple() {
        let (tab, path) = parse_target("1");
        assert_eq!(tab, "1");
        assert_eq!(path, None);
    }

    #[test]
    fn parse_target_with_path() {
        let (tab, path) = parse_target("1:nav/home");
        assert_eq!(tab, "1");
        assert_eq!(path, Some("nav/home".to_string()));
    }

    #[test]
    fn parse_target_named() {
        let (tab, path) = parse_target("stocks");
        assert_eq!(tab, "stocks");
        assert_eq!(path, None);
    }

    #[test]
    fn parse_target_named_with_path() {
        let (tab, path) = parse_target("stocks:submit");
        assert_eq!(tab, "stocks");
        assert_eq!(path, Some("submit".to_string()));
    }

    #[test]
    fn format_hypermap_simple() {
        let value = json!({"price": 42});
        let output = format_hypermap_styled(&value, 0, false);
        assert_eq!(output, "price: 42\n");
    }
}
