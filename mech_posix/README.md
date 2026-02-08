# mech

A command-line client for browsing and interacting with HyperMap resources.

mech provides a tabbed browsing interface over a client-daemon architecture,
communicating with the **mechd** daemon over a Unix socket.

## Building

    cargo build --release

## Man page

    make          # requires scdoc
    man doc/mech.1

## Usage

    mech start
    mech open https://example.com/ --name main
    mech show main
    mech use main:nav/home
    mech show main
    mech stop

See `man mech` for full documentation.

## License

MIT — see [LICENSE](LICENSE).
