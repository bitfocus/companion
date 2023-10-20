!macro customInstall
  File /oname=$PLUGINSDIR\vc_redist.x64.exe "${PROJECT_DIR}\..\.cache\vc_redist.x64.exe"
  ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /passive /norestart'
!macroend