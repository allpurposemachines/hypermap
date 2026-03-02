---
name: mech
description: Use mech to browse HyperMap resources, navigate controls, fill forms, and achieve goals. Invoke when the user wants to interact with HyperMap URLs or asks to use mech.
argument-hint: <goal or URL>
---

# Mech CLI Skill

Run `mech --help` for syntax reference and `man mech` for full command reference.

## Agent Workflow

1. **Start daemon** (once at the beginning): `mech start`
2. **Open and explore** — `mech open <URL> -n <name>`, then `mech show <TAB>` to understand the structure
3. **Navigate step by step** — `mech use <TAB:PATH>` on a control, then `mech show <TAB>` again to see the result
4. **Interact with forms** — `mech set <TAB:PATH> <VALUE>` for individual fields, or `mech use <TAB:PATH> key=value ...` to pass form data inline
5. **Fork before risky changes** — `mech fork <TAB>` to preserve state
6. **Clean up** when done: `mech close <TAB>`, then `mech stop`

## Tips

- Always run `mech show <TAB>` after `mech use <TAB:PATH>` to see results
- Add `sleep 1-3` after `use` commands to allow page loads
- Use `-n` with `mech open` to give tabs meaningful names, then reference by name
- Controls are marked with *@* in output — these are the interactive elements
- If stuck, explore adjacent paths or `mech fork <TAB>` and try alternatives
