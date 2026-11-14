// Driver registry + auto-detection. A driver knows how to paint, run effects and count segments for one strip family.
import { aqaraT1, aqaraT1M, hueGradient } from "./zigbee2mqtt.js";
import { wled } from "./wled.js";
import { segmentLights } from "./lights.js";

// Order matters: explicit segment lists win, then specific hardware.
export const DRIVERS = [segmentLights, aqaraT1, aqaraT1M, hueGradient, wled];

export const DRIVER_OPTIONS = DRIVERS.map((d) => ({ value: d.id, label: d.label + (d.beta ? " (beta)" : "") }));

/** Explicit `driver:` config, else the first driver that recognises the device, else null. */
export function pickDriver(hass, cfg) {
  if (cfg.driver && cfg.driver !== "auto") return DRIVERS.find((d) => d.id === cfg.driver) || null;
  return DRIVERS.find((d) => d.match(hass, cfg.entity, cfg)) || null;
}

/** Style metadata for an effect type under a driver (max colours, speed, segments). */
export function styleInfo(driver, ctx, type) {
  const s = driver.styles(ctx).find((x) => x.id === type);
  const colors = s && s.colors !== undefined ? s.colors : driver.caps.colors;
  return { label: s?.label || type, colors, speed: driver.caps.speed, segments: driver.caps.segments };
}
