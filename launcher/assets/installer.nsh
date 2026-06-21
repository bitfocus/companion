; Custom NSIS installer hooks for Bitfocus Companion.
;
; This file is referenced explicitly via `nsis.include` in the `nsis` block of
; tools/build/package.mts. It defines the `customInstall` / `customUnInstall`
; macros that electron-builder inserts into the generated installer.
;
; Purpose: add Windows Defender Firewall inbound rules for every bundled Node.js
; runtime. Companion's network services (admin UI, TCP/UDP/OSC API, Satellite,
; Art-Net, Ember+, etc.) all run inside the bundled `node.exe` processes, not the
; Companion launcher, so without these rules Windows pops a per-binary firewall
; prompt the first time a service binds to a non-loopback address.
;
; Modifying the firewall requires administrator rights, so the rules are only
; applied for an elevated (per-machine) install/uninstall. For a non-elevated
; per-user install we silently skip it and let Windows show its usual prompt.

; Add one inbound "allow" rule per bundled node runtime, covering the domain,
; private AND public firewall profiles. Re-running is idempotent: each rule is
; deleted before being re-added.
!macro companionAddFirewallRules
  ; $0 = runtimes dir, $1 = find handle, $2 = runtime folder name, $3 = exit code
  StrCpy $0 "$INSTDIR\resources\node-runtimes"
  FindFirst $1 $2 "$0\*.*"
  companionFwAddLoop:
    StrCmp $2 "" companionFwAddDone
    StrCmp $2 "." companionFwAddNext
    StrCmp $2 ".." companionFwAddNext
    IfFileExists "$0\$2\node.exe" 0 companionFwAddNext
      ; Delete any stale rule of the same name first so reinstalls stay clean
      nsExec::Exec 'netsh advfirewall firewall delete rule name="Bitfocus Companion ($2)"'
      Pop $3
      nsExec::Exec 'netsh advfirewall firewall add rule name="Bitfocus Companion ($2)" dir=in action=allow program="$0\$2\node.exe" enable=yes profile=domain,private,public'
      Pop $3
      DetailPrint "Added Windows Firewall rule for node-runtimes\$2 (exit $3)"
    companionFwAddNext:
    FindNext $1 $2
    Goto companionFwAddLoop
  companionFwAddDone:
  FindClose $1
!macroend

; Remove the firewall rules previously added for each bundled node runtime.
!macro companionRemoveFirewallRules
  StrCpy $0 "$INSTDIR\resources\node-runtimes"
  FindFirst $1 $2 "$0\*.*"
  companionFwDelLoop:
    StrCmp $2 "" companionFwDelDone
    StrCmp $2 "." companionFwDelNext
    StrCmp $2 ".." companionFwDelNext
    IfFileExists "$0\$2\node.exe" 0 companionFwDelNext
      nsExec::Exec 'netsh advfirewall firewall delete rule name="Bitfocus Companion ($2)"'
      Pop $3
      DetailPrint "Removed Windows Firewall rule for node-runtimes\$2"
    companionFwDelNext:
    FindNext $1 $2
    Goto companionFwDelLoop
  companionFwDelDone:
  FindClose $1
!macroend

!macro customInstall
  UserInfo::GetAccountType
  Pop $R0
  ${If} $R0 == "Admin"
    DetailPrint "Configuring Windows Firewall rules for Companion..."
    !insertmacro companionAddFirewallRules
  ${Else}
    DetailPrint "Skipping Windows Firewall configuration (requires an elevated per-machine install)."
  ${EndIf}
!macroend

!macro customUnInstall
  UserInfo::GetAccountType
  Pop $R0
  ${If} $R0 == "Admin"
    DetailPrint "Removing Companion Windows Firewall rules..."
    !insertmacro companionRemoveFirewallRules
  ${EndIf}
!macroend
