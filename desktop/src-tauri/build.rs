fn main() {
  let attributes = tauri_build::Attributes::new();
  // Validate only the selected channel's capabilities. The default directory
  // contains updater permissions whose plugin is deliberately absent in MAS.
  #[cfg(feature = "mac-app-store")]
  let attributes = attributes.capabilities_path_pattern("./store-capabilities/*.json");
  tauri_build::try_build(attributes).expect("failed to build Tauri application");
}
