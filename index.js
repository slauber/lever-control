const printError = (msg) => console.log(`===\n\n${msg}\n\n===\n\n`);

let config;
try {
  config = require("./config");
} catch (error) {
  printError("Please create a config.js file (see example file for help)");
  process.exit(1);
}
const HID = require("node-hid");
const usbDetect = require("usb-detection");
const got = require("got");
const { exec } = require("child_process");

usbDetect.startMonitoring();
let previousVol = -100;
const previousAccessoryStatus = {};

usbDetect.on(`add`, (device) => {
  if (device.vendorId === config.vid && device.productId === config.pid) {
    console.log(
      `New device ${device.deviceName} connected, establishing connection in 3s...`
    );
    setTimeout(() => {
      onControllerDetected();
    }, 5000);
  }
});

usbDetect.find(config.vid, config.pid).then((device) => {
  if (device.length > 0) {
    console.log(`Found new device ${device[0].deviceName}`);
    onControllerDetected();
  } else {
    console.log("Waiting for device");
  }
});

const onControllerDetected = () => {
  console.log("Connecting to device...");
  try {
    const hid = new HID.HID(config.vid, config.pid);
    console.log("Controller initialized");
    hid.on("error", () => {
      printError("HID connection error, this process is killed in 5s");
      setTimeout(() => {
        process.kill(process.pid);
      }, 5000);
    });
    hid.on(
      "data",
      debounce((data) => {
        for (const pair of data.entries()) {
          if (pair[0] === config.levers.volume) {
            const volNormalized = (255 - pair[1]) / 2.55;
            setVolume(volNormalized);
          }
          if (pair[0] === config.levers.videolights) {
            const lightNormalized = (255 - pair[1]) / 2.55;
            if (lightNormalized > 80) {
              setAccessory("videolights", "true");
            } else if (lightNormalized < 20) {
              setAccessory("videolights", "false");
            }
          }
          if (pair[0] === config.switches.bytes) {
            if (testBit(pair[1], config.switches.fan.on)) {
              setAccessory("fan", "true");
            }
            if (testBit(pair[1], config.switches.fan.off)) {
              setAccessory("fan", "false");
            }
          }
        }
      }, 15)
    );
  } catch (error) {
    printError("HID connection error, this process is killed in 5s");
    setTimeout(() => {
      process.kill(process.pid);
    }, 5000);
  }
};

const debounce = (func, wait) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const testBit = (value, bit) => (value >> bit) % 2 !== 0;

const setVolume = (vol) => {
  // ensures to mute the mic
  if (vol < 5) {
    vol = 0;
  }
  if (Math.abs(previousVol - vol) > 3) {
    exec(`osascript -e "set volume input volume ${vol}"`, () => {});
    previousVol = vol;
  }
};

const setVideoLights = async (light) => {
  if (previousVideoLight !== light) {
    const options = {
      username: config.nodered.username,
      password: config.nodered.password,
      json: {
        videolights: light,
      },
    };
    const { body } = await got.post(config.nodered.endpoint, options);
    previousVideoLight = light;
  }
};

const setAccessory = async (accessory, status) => {
  if (previousAccessoryStatus[accessory] !== status) {
    const options = {
      username: config.nodered.username,
      password: config.nodered.password,
      json: {
        [accessory]: status,
      },
    };
    const { body } = await got.post(config.nodered.endpoint, options);
    previousAccessoryStatus[accessory] = status;
  }
};
