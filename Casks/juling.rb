cask "juling" do
  version "1.3.34"
  sha256 "874c3dc301d1a16d59c692904d5cb5a2ac2741fbe3846d1adf6cdc6997698e67"

  url "https://github.com/wu798998264-crypto/juling/releases/download/v#{version}/Juling_#{version}_universal.dmg",
      verified: "github.com/wu798998264-crypto/juling/"
  name "Juling"
  desc "Local account manager for AI IDEs (Antigravity and Codex)"
  homepage "https://github.com/wu798998264-crypto/juling"

  auto_updates true

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/聚灵.app"],
                   sudo: true
  end

  app "聚灵.app"

  zap trash: [
    "~/Library/Application Support/com.jlcodes.cockpit-tools",
    "~/Library/Caches/com.jlcodes.cockpit-tools",
    "~/Library/Preferences/com.jlcodes.cockpit-tools.plist",
    "~/Library/Saved Application State/com.jlcodes.cockpit-tools.savedState",
  ]

  caveats <<~EOS
    The app is automatically quarantined by macOS. A postflight hook has been added to remove this quarantine.
    If you still encounter the "App is damaged" error, please run:
      sudo xattr -rd com.apple.quarantine "/Applications/聚灵.app"
  EOS
end
