# Scaffold Forge — Future Upgrades

Shipped in 1.0.0: Forge Configuration editor, Appearance settings, Port configuration UI,
Jinja2 template files (with user overrides), visual constraint enforcement, the sidebar
scrolling fix, the AI note + Scaffold Spec in generated READMEs, the "Copy AI review prompt"
button, and the Electron dev-mode frontend launch fix.

Dropped: the AI Co-pilot sidebar. The constraint engine already gives instant, consistent
advice, and generated projects carry a full spec for whatever AI assistant is used in the
editor. The Review step's "Copy AI review prompt" button covers the second-opinion case with
no API keys.

## Ideas (not planned)

- **Describe-to-fill:** type a plain-English project description and have the wizard filled in.
  This is the one AI feature the rules engine can't replace; revisit only if it's missed.
