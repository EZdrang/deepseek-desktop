!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var DesktopShortcutCheckbox
Var DesktopShortcutChoice

!macro customInit
  StrCpy $DesktopShortcutChoice ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom ShortcutOptionsPage ShortcutOptionsLeave
!macroend

Function ShortcutOptionsPage
  !insertmacro MUI_HEADER_TEXT "安装选项" "选择是否创建桌面快捷方式。"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateCheckbox} 0 12u 100% 14u "创建桌面快捷方式"
  Pop $DesktopShortcutCheckbox
  ${NSD_SetState} $DesktopShortcutCheckbox $DesktopShortcutChoice
  ${NSD_CreateLabel} 0 40u 100% 32u "关闭应用窗口后，DeepSeek 会保留在右下角托盘。右键托盘图标，选择“退出”可彻底关闭。"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function ShortcutOptionsLeave
  ${NSD_GetState} $DesktopShortcutCheckbox $DesktopShortcutChoice
FunctionEnd

!macro customInstall
  ${If} ${Silent}
    StrCpy $DesktopShortcutChoice ${BST_CHECKED}
    ${If} ${isNoDesktopShortcut}
      StrCpy $DesktopShortcutChoice ${BST_UNCHECKED}
    ${EndIf}
  ${EndIf}
  ${If} $DesktopShortcutChoice == ${BST_CHECKED}
    SetOutPath "$INSTDIR"
    System::Call 'ole32::CoInitializeEx(p 0, i 2) i.R3'
    StrCpy $R0 0
    ${Do}
      ClearErrors
      CreateShortCut "$newDesktopLink" "$appExe"
      ${IfNot} ${Errors}
        ${ExitDo}
      ${EndIf}
      IntOp $R0 $R0 + 1
      Sleep 250
    ${LoopWhile} $R0 < 8
    ${If} $R3 >= 0
      System::Call 'ole32::CoUninitialize()'
    ${EndIf}
    ${IfNot} ${FileExists} "$newDesktopLink"
      ; Keep user-selected paths as data, never as executable command text.
      System::Call 'kernel32::SetEnvironmentVariableW(w "DEEPSEEK_INSTALLER_SHORTCUT", w "$newDesktopLink")'
      System::Call 'kernel32::SetEnvironmentVariableW(w "DEEPSEEK_INSTALLER_TARGET", w "$appExe")'
      nsExec::ExecToStack /TIMEOUT=10000 `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "$$ErrorActionPreference = 'Stop'; $$w = New-Object -ComObject WScript.Shell; $$s = $$w.CreateShortcut($$env:DEEPSEEK_INSTALLER_SHORTCUT); $$s.TargetPath = $$env:DEEPSEEK_INSTALLER_TARGET; $$s.WorkingDirectory = [IO.Path]::GetDirectoryName($$s.TargetPath); $$s.IconLocation = $$s.TargetPath + ',0'; $$s.Save()"`
      Pop $R1
      Pop $R2
      System::Call 'kernel32::SetEnvironmentVariableW(w "DEEPSEEK_INSTALLER_SHORTCUT", p 0)'
      System::Call 'kernel32::SetEnvironmentVariableW(w "DEEPSEEK_INSTALLER_TARGET", p 0)'
    ${EndIf}
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${Else}
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${EndIf}
!macroend
!endif
