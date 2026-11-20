# Security

CPI Helper runs inside SAP Cloud Integration with the session of the user. Please treat security problems accordingly.

## Reporting a vulnerability

**Do not open a public issue or pull request for a security problem.**

Send the details to **cpihelper@kangoolutions.com**:

- what the problem is and where (file, plugin, version)
- how to reproduce it
- what an attacker could do with it

You get an answer within a few working days. Please give us time to ship a fixed version to the stores before you talk about it in public.

## Scope

- the core of the extension (everything outside `plugins/`)
- the plugins shipped with CPI Helper. Plugins are community code and switched off by default, but we still want to know about problems and remove or fix the plugin.

Extensions in the stores that use the name "CPI Helper" but are not published from this repository are not ours. Please report them to the store.

## Supported versions

Only the latest version in the Chrome, Edge and Firefox stores gets fixes.
