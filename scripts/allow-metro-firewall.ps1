# Run as Administrator. Fixes Expo Go "appears to be offline" on Windows LAN.
# Allows inbound Metro ports + Node.js on private networks.

$ErrorActionPreference = "Stop"

function Add-RuleIfMissing($Name, $Params) {
  $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Already exists: $Name"
    return
  }
  New-NetFirewallRule -DisplayName $Name @Params | Out-Null
  Write-Host "Added: $Name"
}

Add-RuleIfMissing "TrackYourLift Metro TCP" @{
  Direction = "Inbound"
  Action    = "Allow"
  Protocol  = "TCP"
  LocalPort = "5000,8081,8082,19000,19001,19002"
  Profile   = "Private"
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($node) {
  Add-RuleIfMissing "TrackYourLift Node.js (Private)" @{
    Direction = "Inbound"
    Action    = "Allow"
    Program   = $node
    Profile   = "Private"
  }
}

Write-Host ""
Write-Host "Done. Set your Wi-Fi network to Private (not Public) in Windows Settings."
Write-Host "iPhone: Settings -> Expo Go -> Local Network -> ON"
Write-Host "Then: npm start  and scan the QR again."
