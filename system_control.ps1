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
    "StartSpeech" {
        try {
            Add-Type -AssemblyName System.Speech
            $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
            $recognizer.SetInputToDefaultAudioDevice()
            
            # 1. Choices for all static assistant commands
            $staticChoices = New-Object System.Speech.Recognition.Choices
            $staticChoices.Add(@(
                "help", "commands", "what can i say",
                "volume up", "volume down", "louder", "quieter", "raise volume", "lower volume",
                "mute", "unmute", "silence", "unsilence",
                "brightness up", "brightness down", "brighter", "dimmer",
                "open notepad", "launch notepad", "notepad",
                "open calculator", "open calc", "launch calculator", "calculator", "calc",
                "open browser", "open chrome", "launch browser", "browser", "web",
                "open downloads", "downloads",
                "open tasks file", "edit tasks file", "open notepad tasks", "tasks file", "open tasks",
                "play", "pause", "play music", "pause music", "toggle play", "play pause",
                "next", "next song", "skip song", "skip", "next track",
                "previous", "prev song", "previous song", "go back", "prev track", "previous track",
                "lock pc", "lock screen", "lock computer", "lock workstation", "lock",
                "sleep pc", "sleep computer", "put computer to sleep", "sleep",
                "shutdown pc", "shutdown computer", "shutdown",
                "restart pc", "restart computer", "restart", "reboot",
                "abort shutdown", "cancel shutdown", "stop shutdown", "abort",
                "read tasks", "read my tasks", "what are my tasks", "list tasks", "show tasks", "show my tasks", "tell me my tasks",
                "check system resources", "system stats", "system status", "check status", "status", "telemetry"
            ))

            # 2. Grammar for "volume [0-100]" and "brightness [0-100]"
            $numbers = New-Object System.Speech.Recognition.Choices
            for ($i = 0; $i -le 100; $i++) { 
                [void]$numbers.Add($i.ToString()) 
            }
            $spokenNumbers = @("zero", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "one hundred")
            $numbers.Add($spokenNumbers)

            $volumeGB = New-Object System.Speech.Recognition.GrammarBuilder
            $volumeGB.Append("volume")
            $volumeGB.Append($numbers)

            $brightnessGB = New-Object System.Speech.Recognition.GrammarBuilder
            $brightnessGB.Append("brightness")
            $brightnessGB.Append($numbers)

            # 3. Grammar for adding tasks: "add task [dictation]"
            $addGB = New-Object System.Speech.Recognition.GrammarBuilder
            $addGB.Append("add task")
            $addGB.AppendDictation()

            $remindGB = New-Object System.Speech.Recognition.GrammarBuilder
            $remindGB.Append("remind me to")
            $remindGB.AppendDictation()

            # 4. Grammar for completing/deleting tasks: "complete task [dictation]" and "delete task [dictation]"
            $taskActionChoices = New-Object System.Speech.Recognition.Choices
            $taskActionChoices.Add(@("complete task", "delete task", "remove task", "finish task"))
            $actionGB = New-Object System.Speech.Recognition.GrammarBuilder
            $actionGB.Append($taskActionChoices)
            $actionGB.AppendDictation()

            # Compile into single grammar set with robust fallback
            try {
                $grammarSet = New-Object System.Speech.Recognition.Choices
                $grammarSet.Add($staticChoices)
                $grammarSet.Add($volumeGB)
                $grammarSet.Add($brightnessGB)
                $grammarSet.Add($addGB)
                $grammarSet.Add($remindGB)
                $grammarSet.Add($actionGB)
                $mainGrammar = New-Object System.Speech.Recognition.Grammar($grammarSet)
                $recognizer.LoadGrammar($mainGrammar)
            } catch {
                # Fallback: load only static commands
                $fallbackSet = New-Object System.Speech.Recognition.Choices
                $fallbackSet.Add($staticChoices)
                $mainGrammar = New-Object System.Speech.Recognition.Grammar($fallbackSet)
                $recognizer.LoadGrammar($mainGrammar)
            }

            # Listen for up to 4 seconds
            $result = $recognizer.Recognize([TimeSpan]::FromSeconds(4))
            if ($result -ne $null) {
                Write-Output $result.Text
            } else {
                Write-Output "ERROR: No speech detected"
            }
        } catch {
            Write-Output "ERROR: $_"
        }
    }
    "StartSpeechEngine" {
        try {
            Add-Type -AssemblyName System.Speech
            
            # Find the best English recognizer, fallback to default
            $recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
            $targetRecognizer = $recognizers | Where-Object { $_.Culture.Name -eq "en-US" } | Select-Object -First 1
            if ($targetRecognizer -eq $null) {
                $targetRecognizer = $recognizers | Where-Object { $_.Culture.Name.StartsWith("en") } | Select-Object -First 1
            }
            
            $recognizer = $null
            if ($targetRecognizer -ne $null) {
                $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($targetRecognizer.Culture)
                [Console]::WriteLine("INFO: Speech Culture loaded: $($targetRecognizer.Culture.Name)")
            } else {
                $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
                [Console]::WriteLine("INFO: Default Speech Culture loaded")
            }
            
            try {
                $recognizer.SetInputToDefaultAudioDevice()
            } catch {
                [Console]::WriteLine("FATAL_ERROR: No default recording device found. Verify microphone configuration.")
                return
            }

            # 1. Static assistant commands
            $staticChoices = New-Object System.Speech.Recognition.Choices
            $staticChoices.Add(@(
                "help", "commands", "what can i say",
                "volume up", "volume down", "louder", "quieter", "raise volume", "lower volume",
                "mute", "unmute", "silence", "unsilence",
                "brightness up", "brightness down", "brighter", "dimmer",
                "open notepad", "launch notepad", "notepad",
                "open calculator", "open calc", "launch calculator", "calculator", "calc",
                "open browser", "open chrome", "launch browser", "browser", "web",
                "open downloads", "downloads",
                "open tasks file", "edit tasks file", "open notepad tasks", "tasks file", "open tasks",
                "play", "pause", "play music", "pause music", "toggle play", "play pause",
                "next", "next song", "skip song", "skip", "next track",
                "previous", "prev song", "previous song", "go back", "prev track", "previous track",
                "lock pc", "lock screen", "lock computer", "lock workstation", "lock",
                "sleep pc", "sleep computer", "put computer to sleep", "sleep",
                "shutdown pc", "shutdown computer", "shutdown",
                "restart pc", "restart computer", "restart", "reboot",
                "abort shutdown", "cancel shutdown", "stop shutdown", "abort",
                "read tasks", "read my tasks", "what are my tasks", "list tasks", "show tasks", "show my tasks", "tell me my tasks",
                "check system resources", "system stats", "system status", "check status", "status", "telemetry"
            ))

            # 2. Number ranges for volume/brightness
            $numbers = New-Object System.Speech.Recognition.Choices
            for ($i = 0; $i -le 100; $i++) { 
                [void]$numbers.Add($i.ToString()) 
            }
            $spokenNumbers = @("zero", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "one hundred")
            $numbers.Add($spokenNumbers)

            $volumeGB = New-Object System.Speech.Recognition.GrammarBuilder
            $volumeGB.Append("volume")
            $volumeGB.Append($numbers)

            $brightnessGB = New-Object System.Speech.Recognition.GrammarBuilder
            $brightnessGB.Append("brightness")
            $brightnessGB.Append($numbers)

            # Compile grammar
            $grammarSet = New-Object System.Speech.Recognition.Choices
            $grammarSet.Add($staticChoices)
            $grammarSet.Add($volumeGB)
            $grammarSet.Add($brightnessGB)

            # Add dictation grammars with error catching
            try {
                $addGB = New-Object System.Speech.Recognition.GrammarBuilder
                $addGB.Append("add task")
                $addGB.AppendDictation()
                $grammarSet.Add($addGB)

                $remindGB = New-Object System.Speech.Recognition.GrammarBuilder
                $remindGB.Append("remind me to")
                $remindGB.AppendDictation()
                $grammarSet.Add($remindGB)

                $taskActionChoices = New-Object System.Speech.Recognition.Choices
                $taskActionChoices.Add(@("complete task", "delete task", "remove task", "finish task"))
                $actionGB = New-Object System.Speech.Recognition.GrammarBuilder
                $actionGB.Append($taskActionChoices)
                $actionGB.AppendDictation()
                $grammarSet.Add($actionGB)
            } catch {
                [Console]::WriteLine("INFO: Dictation grammar unsupported. Using static commands.")
            }

            $mainGrammar = New-Object System.Speech.Recognition.Grammar($grammarSet)
            $recognizer.LoadGrammar($mainGrammar)

            # Event triggers
            $recognizedCode = {
                param($sender, $eventArgs)
                [Console]::WriteLine("RECOGNIZED: " + $eventArgs.Result.Text)
            }
            $rejectedCode = {
                param($sender, $eventArgs)
                [Console]::WriteLine("REJECTED")
            }

            Register-ObjectEvent -InputObject $recognizer -EventName "SpeechRecognized" -Action $recognizedCode | Out-Null
            Register-ObjectEvent -InputObject $recognizer -EventName "SpeechRecognitionRejected" -Action $rejectedCode | Out-Null

            [Console]::WriteLine("READY")

            $isListening = $false
            while ($true) {
                $input = [Console]::ReadLine()
                if ($input -eq $null) {
                    break
                }
                $input = $input.Trim()
                if ($input -eq "EXIT") {
                    break
                } elseif ($input -eq "START") {
                    if (-not $isListening) {
                        try {
                            $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
                            $isListening = $true
                            [Console]::WriteLine("LISTENING")
                        } catch {
                            [Console]::WriteLine("FATAL_ERROR: Failed to start listening. " + $_.Exception.Message)
                        }
                    } else {
                        [Console]::WriteLine("LISTENING")
                    }
                } elseif ($input -eq "STOP") {
                    if ($isListening) {
                        $recognizer.RecognizeAsyncCancel()
                        $isListening = $false
                        [Console]::WriteLine("STOPPED")
                    } else {
                        [Console]::WriteLine("STOPPED")
                    }
                }
            }
        } catch {
            [Console]::WriteLine("FATAL_ERROR: $_")
        }
    }
    default {
        Write-Output "Unknown action: $Action"
    }
}
