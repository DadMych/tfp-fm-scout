# FM26 Display Fix (BETA)

**Not installed by `install_macos.sh`.** This plugin is experimental and may break UI layout on some screens.

Build and stage:

```bash
bash build_displayfix.sh
bash install_displayfix_beta.sh
```

The DLL lands in `~/fm26_bep/BETA/FM26DisplayFix/` — outside `BepInEx/plugins/`, so the game will not load it until you opt in:

```bash
mkdir -p ~/fm26_bep/plugins/FM26DisplayFix
cp ~/fm26_bep/BETA/FM26DisplayFix/FM26DisplayFix.dll \
   ~/fm26_bep/plugins/FM26DisplayFix/
```

Remove `~/fm26_bep/plugins/FM26DisplayFix/` to disable.

Config (after first enabled launch): `BepInEx/config/com.tfpdev.fm26displayfix.cfg`
