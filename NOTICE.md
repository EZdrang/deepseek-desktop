# Upstream attribution and fork changes

This Windows fork is maintained by EZdrang at https://github.com/EZdrang/deepseek-desktop
and is derived from https://github.com/doxdk/deepseek-desktop
at commit b2671ed312891ccc30d369764137e49e9d06d612. Original project author: doxdk (dk)
and upstream contributors. The original MIT license and Copyright (c) 2025 dk are preserved in LICENSE.

Changes: updated Electron and packaging tools; removed the preload that cleared website storage;
close-to-tray behavior with explicit exit; single-instance startup; window position persistence; Chinese menus;
isolated, sandboxed remote content; navigation restrictions; connection-failure recovery;
Windows tray show/hide/quit controls and an installer checkbox for a desktop shortcut.

DeepSeek and the upstream logo belong to their respective owners. This is an unofficial personal
website wrapper, with no affiliation with or endorsement by DeepSeek. The app loads the official
website directly and does not implement a model, API relay, or local chat service.

The build has no automatic updater. Rebuild with a supported Electron version for future updates.
