cask "juling" do
  version "1.3.72"
  sha256 "9adbda4758488487eeffd47cce6b6998680dcfc53369ce6606203a0586e4faca"

  url "https://github.com/wu798998264-crypto/juling/releases/download/v#{version}/Juling_#{version}_universal.dmg"
  name "聚灵"
  desc "Account manager for AI IDEs (Antigravity and Codex)"
  homepage "https://github.com/wu798998264-crypto/juling"

  auto_updates true

  app "聚灵.app"

  postflight_steps do
    run "/usr/bin/xattr",
        args: ["-cr", "{{appdir}}/聚灵.app"],
        sudo: true
  end

  zap trash: [
    "~/Library/Application Support/com.wu798998264.juling",
    "~/Library/Caches/com.wu798998264.juling",
    "~/Library/Preferences/com.wu798998264.juling.plist",
    "~/Library/Saved Application State/com.wu798998264.juling.savedState",
  ]

  caveats <<~EOS
    The app is automatically quarantined by macOS. A postflight hook has been added to remove this quarantine.
    If you still encounter the "App is damaged" error, please run:
      sudo xattr -rd com.apple.quarantine "/Applications/聚灵.app"
  EOS
end
