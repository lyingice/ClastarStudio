$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop '像素工坊.lnk'
$target = (Get-Command pyw.exe -ErrorAction SilentlyContinue).Source
if(-not $target){ $target = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source }
if(-not $target){ $target = (Get-Command python.exe -ErrorAction SilentlyContinue).Source }
if(-not $target){ throw '找不到 Python。请先安装 Python 3.9+。' }
$script = Join-Path $root 'tools\launch_kiosk.py'
$icon = Join-Path $root 'clastar.ico'

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = $target
$sc.Arguments = '"' + $script + '"'
$sc.WorkingDirectory = $root
$sc.IconLocation = $icon + ',0'
$sc.Description = '启动像素工坊（本地服务 + 无边框窗口）'
$sc.Hotkey = 'CTRL+ALT+P'
$sc.WindowStyle = 1
$sc.Save()

$check = $ws.CreateShortcut($lnk)
[pscustomobject]@{
    Path = $lnk
    Target = $check.TargetPath
    Arguments = $check.Arguments
    WorkingDirectory = $check.WorkingDirectory
    Icon = $check.IconLocation
    Hotkey = $check.Hotkey
} | Format-List
