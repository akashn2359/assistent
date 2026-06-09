$Source = @"
using System;
using System.Runtime.InteropServices;

namespace AudioEndpointTest {
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
        }

        public static void SetVolume(float vol) {
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
        }

        public static bool GetMute() {
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
        }

        public static void SetMute(bool mute) {
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
        }
    }
}
"@

Add-Type -TypeDefinition $Source
[AudioEndpointTest.Audio]::GetVolume()
