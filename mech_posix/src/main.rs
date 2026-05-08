// mech - CLI client for interacting with HyperMap resources
//
// This is the lightweight client binary. It communicates with the mechd daemon
// over a Unix socket using the varlink protocol (JSON + null-byte framing).

use clap::{Parser, Subcommand};
use std::collections::HashMap;
use std::io::{IsTerminal, Read};
use std::os::unix::net::UnixStream;
use std::process::Command;

use mech_cli::{cleanup, socket_path, write_message, DaemonCommand, DaemonReply};

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
            send_command(&DaemonCommand::Open { url, name });
        }
        Commands::Show { target } => {
            let (tab, path) = parse_target(&target);
            let color = std::io::stdout().is_terminal();
            send_command(&DaemonCommand::Show { tab, path, color });
        }
        Commands::Set { target, value } => {
            let (tab, path) = parse_target(&target);
            let Some(path) = path else {
                eprintln!("error: set requires a path (e.g., \"{}:path/to/field\")", tab);
                std::process::exit(1);
            };
            send_command(&DaemonCommand::Set { tab, path, value });
        }
        Commands::Use { target, data } => {
            let (tab, path) = parse_target(&target);
            let Some(path) = path else {
                eprintln!("error: use requires a path (e.g., \"{}:path/to/control\")", tab);
                std::process::exit(1);
            };
            let data: HashMap<String, String> = data
                .iter()
                .filter_map(|s| {
                    let mut split = s.splitn(2, '=');
                    Some((split.next()?.to_string(), split.next()?.to_string()))
                })
                .collect();
            send_command(&DaemonCommand::Use { tab, path, data });
        }
        Commands::Fork { tab, name } => {
            send_command(&DaemonCommand::Fork { tab, name });
        }
        Commands::Close { tab } => {
            send_command(&DaemonCommand::Close { tab });
        }
        Commands::Name { tab, name } => {
            send_command(&DaemonCommand::Name { tab, name });
        }
        Commands::Tabs => {
            send_command(&DaemonCommand::Tabs);
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

fn send_command(cmd: &DaemonCommand) {
    match UnixStream::connect(socket_path()) {
        Ok(mut stream) => {
            let json = serde_json::to_vec(cmd).expect("Failed to serialize command");
            if let Err(e) = write_message(&mut stream, &json) {
                eprintln!("Failed to send command: {}", e);
                return;
            }
            let _ = stream.shutdown(std::net::Shutdown::Write);
            let mut buf = Vec::new();
            if stream.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
                if buf.last() == Some(&0) {
                    buf.pop();
                }
                match serde_json::from_slice::<DaemonReply>(&buf) {
                    Ok(DaemonReply::Ok { parameters }) => {
                        if !parameters.message.is_empty() {
                            print!("{}", parameters.message);
                        }
                    }
                    Ok(DaemonReply::Err(err)) => {
                        eprintln!("{}", err.user_message());
                        std::process::exit(1);
                    }
                    Err(_) => {
                        eprintln!("Invalid response from daemon. Is mechd up to date?");
                        std::process::exit(1);
                    }
                }
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

    // Spawn mechd from PATH
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
    if UnixStream::connect(socket_path()).is_err() {
        // No daemon listening — just clean up stale files
        cleanup();
        eprintln!("Daemon is not running");
        return;
    }
    send_command(&DaemonCommand::Shutdown);
    std::thread::sleep(std::time::Duration::from_millis(500));
    cleanup();
    println!("Daemon stopped");
}

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
