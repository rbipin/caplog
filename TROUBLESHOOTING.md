# Troubleshooting

Known issues and fixes for CapLog.

## CapLog runs in the taskbar but no window appears

### Symptom

After launching `CapLog.exe` (or the installed app), the process shows in the
taskbar / Task Manager but no window is ever drawn. The app appears to hang.

When a debug build is run from a terminal, the underlying error is:

```
migration 1 was previously applied but has been modified
```

### Root cause

Three issues combined to produce this failure mode:

1. **Window is hidden until frontend init succeeds.**
   `src-tauri/tauri.conf.json` sets the main window to `visible: false`
   to avoid a white flash before the dark theme paints. `src/app.ts` then
   calls `getCurrentWindow().show()` only after `initDB()` and the `App`
   constructor finish:

   ```ts
   window.addEventListener('DOMContentLoaded', async () => {
     await initDB();
     const app = new App();
     await app.ready;
     await getCurrentWindow().show();  // never reached on error
   });
   ```

   If anything throws before `show()`, the window stays hidden forever
   and the only visible symptom is a phantom taskbar entry.

2. **Missing migration registration.**
   The file `src-tauri/migrations/002_settings_chat_days.sql` existed
   on disk but `src-tauri/src/lib.rs` only registered migration v1 in
   `tauri_plugin_sql::Builder::add_migrations`. Migration 2 was never
   applied in production builds.

3. **Migration 1 checksum mismatch (the actual crash).**
   `tauri-plugin-sql` is backed by `sqlx`, which stores a SHA-384 of
   each applied migration in the `_sqlx_migrations` table. If the file
   content changes after a migration has been applied to a DB, sqlx
   refuses to open the connection and throws
   `migration 1 was previously applied but has been modified`. The
   `001_init.sql` file had been edited at some point after early
   installs, so any DB created before that edit now fails this check.

### Fix

Applied in this repo:

1. **`src/app.ts`** — wrap startup in `try/catch/finally` so the window
   is always shown, even on init failure. A 3-second safety timer
   ensures the window appears even if `DOMContentLoaded` work hangs.
   On error, the exception is rendered into the page so the user can
   see what went wrong instead of staring at a blank taskbar.

   ```ts
   window.addEventListener('DOMContentLoaded', async () => {
     const showWindow = async () => {
       try { await getCurrentWindow().show(); }
       catch (e) { console.error('show window failed', e); }
     };
     const safetyTimer = setTimeout(() => { void showWindow(); }, 3000);
     try {
       await initDB();
       const app = new App();
       await app.ready;
     } catch (e) {
       console.error('CapLog init failed', e);
       document.body.innerHTML =
         `<div style="color:#eee;background:#0e0e0e;padding:24px;
           font-family:monospace;white-space:pre-wrap;">
           CapLog failed to start:\n\n${String((e as Error)?.stack || e)}
         </div>`;
     } finally {
       clearTimeout(safetyTimer);
       await showWindow();
     }
   });
   ```

2. **`src-tauri/src/lib.rs`** — register every file in
   `src-tauri/migrations/`. Whenever a new `NNN_*.sql` file is added,
   append a matching `tauri_plugin_sql::Migration` entry with a unique
   `version` number.

   ```rust
   .add_migrations(
       "sqlite:caplog.db",
       vec![
           tauri_plugin_sql::Migration {
               version: 1,
               description: "init",
               sql: include_str!("../migrations/001_init.sql"),
               kind: tauri_plugin_sql::MigrationKind::Up,
           },
           tauri_plugin_sql::Migration {
               version: 2,
               description: "settings_chat_days",
               sql: include_str!("../migrations/002_settings_chat_days.sql"),
               kind: tauri_plugin_sql::MigrationKind::Up,
           },
       ],
   )
   ```

3. **Existing DB checksum repair.** For users whose DB was created
   before `001_init.sql` was edited, the stored checksum has to be
   refreshed once. The current `001_init.sql` only contains
   `CREATE TABLE IF NOT EXISTS` statements so re-applying it is a
   no-op — patching the checksum is safe.

   PowerShell:

   ```powershell
   $db   = "$env:APPDATA\com.bipin.caplog\caplog.db"
   $file = "C:\path\to\caplog\src-tauri\migrations\001_init.sql"

   # 1. Back up the DB
   Copy-Item $db "$db.bak" -Force

   # 2. Compute SHA-384 of the current migration file
   $bytes = [System.IO.File]::ReadAllBytes($file)
   $hash  = [System.Security.Cryptography.SHA384]::Create().ComputeHash($bytes)
   $hex   = ($hash | ForEach-Object { $_.ToString("X2") }) -join ""

   # 3. Update the stored checksum
   sqlite3 $db "UPDATE _sqlx_migrations SET checksum = x'$hex' WHERE version = 1;"
   ```

   Verify with `sqlite3 $db "SELECT version, description, hex(checksum) FROM _sqlx_migrations;"`.

### Prevention

- **Never edit an existing migration file** once it has shipped. Add a
  new `NNN_*.sql` instead and register it in `lib.rs`.
- **Always register new migrations in `lib.rs`.** A migration file
  alone does nothing — it must be added to the `add_migrations` vec
  with a unique `version` number.
- **Keep the startup `try/catch/finally`** so the window is always
  visible even when something deeper fails.

### DB location

- Windows: `%APPDATA%\com.bipin.caplog\caplog.db`
- WebView2 cache: `%LOCALAPPDATA%\com.bipin.caplog\EBWebView`
