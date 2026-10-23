// Both normal startup and the early package launcher must never allocate a console.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    if let Some(code) = juling_lib::try_run_codex_package_launcher() {
        std::process::exit(code);
    }
    juling_lib::run()
}
