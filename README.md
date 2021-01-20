lever-control 🎚
===
Control your wfh setup with levers!

Does it work for me?
---
This software is tailored to my needs, which are:
- Controlling the microphone volume of macOS
- Toggling accessories via webhooks of my Node-RED installation

How does it work?
---
You need a HID-device (needs to be specified in the config) that can be read to determine the levers position. I set up a pm2 instance to let this tool run in the background.