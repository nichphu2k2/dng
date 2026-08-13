$obsPath = "C:\Program Files\obs-studio\bin\64bit\obs64.exe"
$obsDir = "C:\Program Files\obs-studio\bin\64bit"
$checkInterval = 5

# OBS crash sentinel directory
$obsSentinelDir = Join-Path $env:APPDATA "obs-studio\.sentinel"

# =========================
# VERIFY OBS INSTALLATION
# =========================

if (-not (Test-Path $obsPath)) {
    Write-Host "ERROR: OBS executable was not found:"
    Write-Host $obsPath
    exit 1
}

# =========================
# SINGLE WATCHDOG INSTANCE
# =========================
# Prevents multiple watchdog instances from running.
# If the script is started multiple times, only the first
# instance remains active.

$mutexName = "Global\OBS_WATCHDOG_SINGLE_INSTANCE"
$createdNew = $false

try {
    $mutex = New-Object System.Threading.Mutex(
        $true,
        $mutexName,
        [ref]$createdNew
    )
} catch {
    Write-Host "ERROR: Failed to create watchdog mutex."
    Write-Host $_.Exception.Message
    exit 1
}

if (-not $createdNew) {
    Write-Host "OBS Watchdog is already running."
    Write-Host "This instance will exit."
    exit 0
}

# =========================
# REMOVE OBS CRASH SENTINEL
# =========================
# OBS 32.x uses the .sentinel directory to detect
# an unclean shutdown.
#
# Removing a stale .sentinel before launching OBS
# prevents the Safe Mode / Normal Mode dialog caused
# by a previous unexpected shutdown.

function Remove-OBSCrashSentinel {
    if (-not (Test-Path $obsSentinelDir)) {
        return
    }

    try {
        Remove-Item `
            -Path $obsSentinelDir `
            -Recurse `
            -Force `
            -ErrorAction Stop

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Removed stale OBS crash sentinel."
    } catch {
        Write-Host "WARNING: Failed to remove OBS crash sentinel."
        Write-Host $_.Exception.Message
    }
}

# =========================
# WINDOWS API
# =========================

if (-not ("OBSWindowHelper" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;

public class OBSWindowHelper
{
    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int X,
        int Y,
        int cx,
        int cy,
        uint uFlags
    );

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TOOLWINDOW = 0x00000080;
    public const int WS_EX_APPWINDOW = 0x00040000;
    public const int SW_HIDE = 0;
    public const int SW_SHOW = 5;

    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOACTIVATE = 0x0010;

    public static void HideFromTaskbar(IntPtr hWnd)
    {
        int style = GetWindowLong(hWnd, GWL_EXSTYLE);

        style |= WS_EX_TOOLWINDOW;
        style &= ~WS_EX_APPWINDOW;

        SetWindowLong(
            hWnd,
            GWL_EXSTYLE,
            style
        );

        // Force Windows to refresh the window style.
        SetWindowPos(
            hWnd,
            IntPtr.Zero,
            0,
            0,
            0,
            0,
            SWP_NOSIZE |
            SWP_NOMOVE |
            SWP_NOACTIVATE
        );

        // Hide the OBS window.
        ShowWindow(
            hWnd,
            SW_HIDE
        );
    }

    public static void ShowWindowAgain(IntPtr hWnd)
    {
        ShowWindow(
            hWnd,
            SW_SHOW
        );
    }
}
"@
}

# =========================
# GET OBS PROCESSES
# =========================

function Get-OBSProcesses {
    return @(
        Get-Process `
            -Name "obs64" `
            -ErrorAction SilentlyContinue
    )
}

# =========================
# GET OBS WINDOW
# =========================

function Get-OBSWindow {
    $processes = Get-OBSProcesses

    foreach ($process in $processes) {
        try {
            if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
                return $process
            }
        } catch {
        }
    }

    return $null
}

# =========================
# HIDE OBS FROM TASKBAR
# =========================

function Hide-OBSWindow {
    $obsWindow = Get-OBSWindow

    if ($null -eq $obsWindow) {
        return $false
    }

    $hwnd = $obsWindow.MainWindowHandle

    if ($hwnd -eq [IntPtr]::Zero) {
        return $false
    }

    try {
        [OBSWindowHelper]::HideFromTaskbar($hwnd)

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OBS hidden from Taskbar. PID=$($obsWindow.Id)"

        return $true
    } catch {
        Write-Host "ERROR: Failed to hide OBS: $($_.Exception.Message)"
        return $false
    }
}

# =========================
# WAIT FOR OBS WINDOW
# =========================

function Wait-OBSWindow {
    param(
        [int]$TimeoutSeconds = 30
    )

    $elapsed = 0

    while ($elapsed -lt $TimeoutSeconds) {
        $window = Get-OBSWindow

        if ($null -ne $window) {
            return $window
        }

        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
    }

    return $null
}

# =========================
# START OBS
# =========================

function Start-OBS {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "OBS is not running."
    Write-Host "Preparing OBS startup..."
    Write-Host "=========================================="

    # Remove any stale crash sentinel before starting OBS.
    Remove-OBSCrashSentinel

    try {
        # The working directory is required so OBS can correctly
        # locate its locale, data, plugins, and other files.

        $newProcess = Start-Process `
            -FilePath $obsPath `
            -WorkingDirectory $obsDir `
            -ArgumentList "--startstreaming" `
            -PassThru

        Write-Host "OBS process started."
        Write-Host "PID = $($newProcess.Id)"
    } catch {
        Write-Host "ERROR: Failed to start OBS."
        Write-Host $_.Exception.Message
        return $false
    }

    Write-Host "Waiting for OBS to initialize..."

    $obsWindow = Wait-OBSWindow -TimeoutSeconds 30

    if ($null -eq $obsWindow) {
        Write-Host "WARNING: OBS process may be running, but its window was not found."
        return $false
    }

    Write-Host "OBS is ready."
    Write-Host "PID = $($obsWindow.Id)"

    Hide-OBSWindow | Out-Null

    return $true
}

# =========================
# START WATCHDOG
# =========================

Write-Host ""
Write-Host "=========================================="
Write-Host "OBS WATCHDOG STARTED"
Write-Host "=========================================="
Write-Host "OBS Path:"
Write-Host $obsPath
Write-Host "Check Interval: $checkInterval seconds"
Write-Host "Sentinel Path:"
Write-Host $obsSentinelDir
Write-Host "=========================================="
Write-Host ""

# =========================
# INITIAL OBS CHECK
# =========================
# If OBS is not already running when the watchdog starts,
# remove any stale sentinel before launching OBS.

$initialOBS = Get-OBSProcesses

if ($initialOBS.Count -eq 0) {
    Remove-OBSCrashSentinel
}

# =========================
# WATCHDOG LOOP
# =========================

while ($true) {
    try {
        # Check whether obs64.exe is running.
        # MainWindowHandle is not used to determine whether
        # the OBS process itself is alive.

        $obsProcesses = Get-OBSProcesses

        # =========================
        # OBS NOT RUNNING
        # =========================

        if ($obsProcesses.Count -eq 0) {
            Write-Host ""
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OBS is not running."

            Start-OBS | Out-Null

            Start-Sleep -Seconds 3
            continue
        }

        # =========================
        # OBS IS RUNNING
        # =========================

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OBS is running. PID: $($obsProcesses.Id -join ', ')"

        # If multiple OBS processes already exist, do not terminate
        # any of them automatically to avoid interrupting a stream.

        if ($obsProcesses.Count -gt 1) {
            Write-Host "WARNING: Multiple OBS processes detected:"

            foreach ($p in $obsProcesses) {
                Write-Host "  PID = $($p.Id)"
            }

            Write-Host "The watchdog will not terminate any OBS process."
        }

        # =========================
        # CHECK OBS WINDOW
        # =========================

        $obsWindow = Get-OBSWindow

        if ($null -ne $obsWindow) {
            Hide-OBSWindow | Out-Null
        } else {
            # OBS is running, but no visible window was found.
            # This can happen while OBS is starting or when
            # the window has already been hidden.

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OBS process is running, but no window was found."
        }

        # =========================
        # NEXT CHECK
        # =========================

        Start-Sleep -Seconds $checkInterval

    } catch {
        Write-Host ""
        Write-Host "WATCHDOG ERROR:"
        Write-Host $_.Exception.Message
        Write-Host "The watchdog will continue running."
        Write-Host ""

        Start-Sleep -Seconds 5
    }
}