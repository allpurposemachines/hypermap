mech(1)

# NAME

mech - browse and interact with HyperMap resources

# SYNOPSIS

*mech* start \[-f|--foreground]

*mech* stop

*mech* open <url> \[--name <name>]

*mech* show <tab\[:path]>

*mech* set <tab:path> <value>

*mech* use <tab:path> \[key=value ...]

*mech* fork <tab> \[--name <name>]

*mech* close <tab>

*mech* name <tab> <name>

*mech* tabs

# DESCRIPTION

*mech* is a command-line client for browsing and interacting with HyperMap
resources. HyperMap is a hypermedia format that exposes structured data and
controls (actions) which can be navigated and triggered programmatically.

*mech* communicates with a background daemon (*mechd*) over a Unix socket. The
daemon must be started before any other commands will work.

# COMMANDS

## Daemon

*start* \[-f|--foreground]
	Start the daemon. With *-f*, run in the foreground instead of
	daemonizing. The client will wait up to 3 seconds for the daemon to
	become ready.

*stop*
	Stop the daemon and clean up its socket and PID files.

## Tabs

*open* <url> \[--name <name>]
	Open a URL in a new tab. Optionally assign a name for easier reference.

*tabs*
	List all open tabs with their indices and names.

*close* <tab>
	Close a tab.

*name* <tab> <name>
	Name or rename a tab.

*fork* <tab> \[--name <name>]
	Duplicate a tab, creating a copy of its current state. Useful for
	preserving state before making changes or for exploring alternatives.

## Viewing and Interacting

*show* <tab\[:path]>
	Display the contents of a tab, optionally narrowed to a specific path.
	Output is colorized when writing to a terminal.

*set* <tab:path> <value>
	Set a value at a path without triggering any control. Used for filling
	in form fields before submission.

*use* <tab:path> \[key=value ...]
	Trigger a control at the given path. Optionally pass form data as
	key=value pairs inline. This is the primary way to navigate and submit
	actions.

# TAB REFERENCES

Tabs are referenced by index or by name:

- *Index*: the order in which tabs were opened, starting at 1.
- *Name*: a label assigned with *--name* or the *name* command.

A tab reference can include a path, separated by a colon:

	1:market/ibm/price
	stocks:nav/home

# PATHS

HyperMap content is hierarchical. Paths use */* as a separator:

	market
	market/ibm
	market/ibm/price

# OUTPUT FORMAT

The *show* command renders HyperMap content as an indented tree. Each line is
one of:

*key: value*
	A leaf node with a scalar value (string, number, boolean, or null).

*key/*
	A container with children. The trailing */* indicates nesting below.

*key@*
	A control — an interactive element that can be triggered with *mech use*.

*key@/*
	A control that also has children (e.g., a form with input fields).

*\[N]*
	An array element at index N. May have a value or children.

Children are indented under their parent. The *#* metadata key is hidden from
output.

Example:

```
nav/
  home@
  stocks@
market/
  ibm/
    ticker: IBM
    price: 142.50
    submitOrder@/
      quantity: 0
      submit@
```

# ENVIRONMENT

*MECH_SOCKET_PATH*
	Path to the Unix domain socket used for client-daemon communication.
	Default: _/tmp/mech.sock_

*MECH_PID_PATH*
	Path to the daemon PID file. Default: _/tmp/mech.pid_

# EXAMPLES

Start the daemon and open a resource:

```
mech start
mech open https://example.com/ --name main
mech show main
```

Navigate using a control, then view the result:

```
mech use main:nav/stocks
mech show main
```

Fill a form field, then submit:

```
mech set main:market/ibm/submitOrder/quantity 100
mech use main:market/ibm/submitOrder/submit
mech show main
```

Or submit with inline values:

```
mech use main:market/ibm/submitOrder quantity=100
```

Fork a tab before making changes:

```
mech fork main --name backup
mech use main:market/ibm/submitOrder quantity=100
```

Clean up:

```
mech close main
mech stop
```
