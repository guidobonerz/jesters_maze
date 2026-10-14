// spacemouse.js - a 3Dconnexion SpaceMouse through WebHID (Chrome, Edge; localhost or https).
// The device sends its six axes and its buttons as HID input reports:
//   report 1  translation x, y, z (int16 LE) - newer devices: all six axes in one report of 12 bytes
//   report 2  rotation rx, ry, rz (int16 LE)
//   report 3  the buttons, one bit each
// While the cap is off its rest, onMotion(axes, dt) is called every frame with the axes in -1..1
// (x slide right / left, y slide forward / back, z push / pull, rx tilt, ry roll, rz twist - as the
// device reports them; app.js maps them to the views) and the seconds since the last frame. A device granted once is opened again
// at the next start without asking.

const FILTERS = [
  { vendorId: 0x256f, usagePage: 0x01, usage: 0x08 },   // 3Dconnexion: multi-axis controller
  { vendorId: 0x046d, usagePage: 0x01, usage: 0x08 },   // older devices under Logitech's id
];
const FULL = 350;          // the axes report about ±350 at full deflection
const DEAD = .06;          // the rest of the cap is never exactly zero
const QUIET_MS = 250;      // no report for this long: the cap is at rest

export const supported = () => typeof navigator !== 'undefined' && 'hid' in navigator;

export function createSpaceMouse({ onMotion, onButton, onChange, auto = () => true }) {
  const axes = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 };
  const raw = { ...axes };       // without the dead zone, for the meter of the settings
  let device = null, buttons = 0, lastReport = 0, frame = 0, lastFrame = 0;

  const norm = v => {
    const x = Math.max(-1, Math.min(1, v / FULL));
    return Math.abs(x) < DEAD ? 0 : Math.sign(x) * (Math.abs(x) - DEAD) / (1 - DEAD);
  };
  const set = (k, v) => { raw[k] = Math.max(-1, Math.min(1, v / FULL)); axes[k] = norm(v); };

  function report(e) {
    const d = e.data, n = d.byteLength;
    if (e.reportId === 1 && n >= 6) {
      set('tx', d.getInt16(0, true)); set('ty', d.getInt16(2, true)); set('tz', d.getInt16(4, true));
      if (n >= 12) { set('rx', d.getInt16(6, true)); set('ry', d.getInt16(8, true)); set('rz', d.getInt16(10, true)); }
    } else if (e.reportId === 2 && n >= 6) {
      set('rx', d.getInt16(0, true)); set('ry', d.getInt16(2, true)); set('rz', d.getInt16(4, true));
    } else if (e.reportId === 3) {
      let mask = 0;
      for (let i = 0; i < Math.min(n, 4); i++) mask |= d.getUint8(i) << (8 * i);
      const changed = mask ^ buttons;
      buttons = mask;
      for (let b = 0; b < 32; b++) if (changed & (1 << b)) onButton?.(b, !!(mask & (1 << b)));
      return;
    } else return;
    lastReport = performance.now();
    if (!frame) { lastFrame = lastReport; frame = requestAnimationFrame(tick); }
  }

  function tick(now) {
    frame = 0;
    if (now - lastReport > QUIET_MS) for (const k in axes) axes[k] = raw[k] = 0;
    const moving = Object.values(axes).some(v => v);
    const dt = Math.min(.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (moving && dt > 0) onMotion?.({ ...axes }, dt);
    if (moving || Object.values(raw).some(v => v)) frame = requestAnimationFrame(tick);
  }

  async function open(dev) {
    if (device === dev && dev.opened) return;
    await close();
    if (!dev.opened) await dev.open();
    dev.addEventListener('inputreport', report);
    device = dev;
    onChange?.();
  }
  async function close() {
    if (!device) return;
    device.removeEventListener('inputreport', report);
    try { await device.close(); } catch { /* gone already */ }
    device = null;
    for (const k in axes) axes[k] = raw[k] = 0;
    onChange?.();
  }

  // a SpaceMouse the browser may open without asking (granted before): open it at the start and
  // whenever it is plugged in (auto(): the setting "Connect automatically")
  let granted = false;
  async function openGranted() {
    const list = await navigator.hid.getDevices();
    const d = list.find(isSpaceMouse);
    granted = !!d;
    if (d && !device && auto()) await open(d).catch(() => {});
  }
  if (supported()) {
    openGranted();
    navigator.hid.addEventListener('connect', e => {
      if (isSpaceMouse(e.device)) granted = true;
      if (!device && auto() && isSpaceMouse(e.device)) open(e.device).catch(() => {});
    });
    navigator.hid.addEventListener('disconnect', e => { if (e.device === device) { device = null; onChange?.(); } });
  }

  return {
    get device() { return device; },
    get name() { return device?.productName || (device ? 'SpaceMouse' : null); },
    // a device was granted before: no need to ask
    get granted() { return granted; },
    // the cap is off its rest, or was a moment ago
    get active() { return !!device && performance.now() - lastReport < QUIET_MS && Object.values(raw).some(v => v); },
    openGranted,
    raw,
    // asks the browser for a device: only from a click
    async connect() {
      const list = await navigator.hid.requestDevice({ filters: FILTERS });
      if (list.length) { granted = true; await open(list[0]); }
      return !!device;
    },
    // closes the device and takes the permission back (it is not opened at the next start)
    async forget() {
      const d = device;
      await close();
      try { await d?.forget?.(); } catch { /* older browsers */ }
      granted = false;
    },
  };
}

const isSpaceMouse = d => FILTERS.some(f => f.vendorId === d.vendorId) &&
  d.collections.some(c => c.usagePage === 0x01 && c.usage === 0x08);
