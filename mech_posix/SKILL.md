---
name: mech
description: Use mech to browse HyperMap resources, navigate controls, fill forms, and achieve goals. Invoke when the user wants to interact with HyperMap URLs or asks to use mech.
allowed-tools: Bash
argument-hint: <goal or URL>
---

# Mech CLI Skill

Run `man mech` for full command reference.

## Agent Workflow

1. **Start daemon** (once at the beginning): `mech start`
2. **Open and explore** — always `mech show` after opening to understand the structure
3. **Navigate step by step** — use controls, then `mech show` again to see the result
4. **Interact with forms** — use `mech set` for individual fields, or pass key=value pairs inline to `mech use`
5. **Fork before risky changes** — use `mech fork` to preserve state
6. **Clean up** when done: close tabs, then `mech stop`

## Tips

- Always run `mech show` after `mech use` to see results
- Add `sleep 1-3` after `use` commands to allow page loads
- Use meaningful tab names for clarity
- Controls are marked with *@* in output — these are the interactive elements
- If stuck, explore adjacent paths or fork and try alternatives
