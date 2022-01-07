- **Enable emulator control for Logitec R400/Mastercue/dSan**  
  A logitec R400/Mastercue/dSan will send a button press to button; 2 (Back), 3 (forward), 4 (black) and for logitec: 10/11 (Start and stop) on each page.

- **Enable connected xkeys (Companion restart required)**  
  Enable Companion to use xkeys buttons to press banks. When changing the setting, restarting Companion is required to properly latch/release any xkeys panels connected to USB.

- **Periodic USB Rescan**  
  You can enable this to automatically find new or recover existing USB devices. A USB rescan is a blocking action and, hardware depdendant, can interrupt precise delay timing of banks. If your environment requires this, use caution:

  - Stress test complex banks during rescans
  - Use the longest reasonable interval

- **Rescan Interval (in seconds)**  
  The period in seconds the system will use to automatically rescan for USB devices, when enabled.