param (
    [string]$Action = "GetVolume",
    [double]$Value = 0,
    [bool]$MuteState = $false
)

# C# Code for Volume Control using CoreAudio API COM Interfaces
$Source = @"
using System;
using System.Runtime.InteropServices;

namespace AudioEndpoint {
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume {
        int f(); int g(); int h(); int i();
        int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
        int j();
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int k(); int l(); int m(); int n();
        int SetMute(bool bMute, Guid pguidEventContext);
        int GetMute(out bool pbMute);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
    }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        int f();
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorComObject { }

    public class Audio {
        public static float GetVolume() {
            try {
                var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                IMMDevice dev = null;
                enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                IAudioEndpointVolume epv = null;
                var epvid = typeof(IAudioEndpointVolume).GUID;
                dev.Activate(ref epvid, 23, 0, out epv);
                float vol = 0;
                epv.GetMasterVolumeLevelScalar(out vol);
                Marshal.ReleaseComObject(epv);
                Marshal.ReleaseComObject(dev);
                Marshal.ReleaseComObject(enumerator);
                return vol * 100f;
            } catch { return -1f; }
        }

        public static void SetVolume(float vol) {
            try {
                var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                IMMDevice dev = null;
                enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                IAudioEndpointVolume epv = null;
                var epvid = typeof(IAudioEndpointVolume).GUID;
                dev.Activate(ref epvid, 23, 0, out epv);
                epv.SetMasterVolumeLevelScalar(vol / 100f, Guid.Empty);
                Marshal.ReleaseComObject(epv);
                Marshal.ReleaseComObject(dev);
                Marshal.ReleaseComObject(enumerator);
            } catch { }
        }

        public static bool GetMute() {
            try {
                var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                IMMDevice dev = null;
                enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                IAudioEndpointVolume epv = null;
                var epvid = typeof(IAudioEndpointVolume).GUID;
                dev.Activate(ref epvid, 23, 0, out epv);
                bool mute = false;
                epv.GetMute(out mute);
                Marshal.ReleaseComObject(epv);
                Marshal.ReleaseComObject(dev);
                Marshal.ReleaseComObject(enumerator);
                return mute;
            } catch { return false; }
        }

        public static void SetMute(bool mute) {
            try {
                var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                IMMDevice dev = null;
                enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                IAudioEndpointVolume epv = null;
                var epvid = typeof(IAudioEndpointVolume).GUID;
                dev.Activate(ref epvid, 23, 0, out epv);
                epv.SetMute(mute, Guid.Empty);
                Marshal.ReleaseComObject(epv);
                Marshal.ReleaseComObject(dev);
                Marshal.ReleaseComObject(enumerator);
            } catch { }
        }
    }
}
"@

# Helper to check if type is already added
if (-not ([System.Management.Automation.PSTypeName]"AudioEndpoint.Audio").Type) {
    Add-Type -TypeDefinition $Source
}

switch ($Action) {
    "GetVolume" {
        $vol = [AudioEndpoint.Audio]::GetVolume()
        Write-Output $vol
    }
    "SetVolume" {
        [AudioEndpoint.Audio]::SetVolume($Value)
        Write-Output "Volume set to $Value"
    }
    "GetMute" {
        $mute = [AudioEndpoint.Audio]::GetMute()
        Write-Output $mute
    }
    "SetMute" {
        $mState = $false
        if ($MuteState -eq $true -or $MuteState -eq "True" -or $MuteState -eq "true" -or $MuteState -eq 1 -or $MuteState -eq "1") {
            $mState = $true
        }
        [AudioEndpoint.Audio]::SetMute($mState)
        Write-Output "Mute set to $mState"
    }
    "GetBrightness" {
        try {
            $brightness = (Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness
            Write-Output $brightness
        } catch {
            Write-Output -1
        }
    }
    "SetBrightness" {
        try {
            (Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(0, $Value)
            Write-Output "Brightness set to $Value"
        } catch {
            Write-Output "Error setting brightness"
        }
    }
    "GetStats" {
        # CPU
        $cpu = (Get-CimInstance Win32_Processor | Select-Object -ExpandProperty LoadPercentage | Measure-Object -Average).Average
        if ($cpu -eq $null) { $cpu = 0 }
        $cpu = [math]::Round($cpu, 1)
        
        # RAM
        $os = Get-CimInstance Win32_OperatingSystem
        $totalRam = $os.TotalVisibleMemorySize
        $freeRam = $os.FreePhysicalMemory
        $ram = [math]::Round((($totalRam - $freeRam) / $totalRam) * 100, 1)
        
        # Battery
        $battery = Get-CimInstance Win32_Battery
        $batteryLevel = 100
        $charging = $true
        if ($battery) {
            $batteryLevel = $battery.EstimatedChargeRemaining
            $charging = ($battery.BatteryStatus -eq 2 -or $battery.BatteryStatus -eq 6 -or $battery.BatteryStatus -eq 7 -or $battery.BatteryStatus -eq 8)
        }
        
        # Disk
        $disk = Get-Volume -DriveLetter C
        $diskCapacity = 0
        if ($disk) {
            $diskCapacity = [math]::Round((($disk.Size - $disk.SizeRemaining) / $disk.Size) * 100, 1)
        }
        
        $result = @{
            cpu = $cpu
            ram = $ram
            batteryLevel = $batteryLevel
            charging = $charging
            diskCapacity = $diskCapacity
        } | ConvertTo-Json
        
        Write-Output $result
    }
    default {
        Write-Output "Unknown action: $Action"
    }
}
