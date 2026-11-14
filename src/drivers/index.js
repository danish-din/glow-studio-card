// Driver registry + auto-detection. A driver knows how to paint, run effects and count segments for one strip family.
import { aqaraT1, aqaraT1M, hueGradient } from "./zigbee2mqtt.js";
import { wled } from "./wled.js";
import { segmentLights } from "./lights.js";
import { DRIFT_STYLES, isDrift } from "../drift.js";

// Order matters: explicit segment lists win, then specific hardware.
export const DRIVERS = [segmentLights, aqaraT1, aqaraT1M, hueGradient, wled];

export const DRIVER_OPTIONS = DRIVERS.map((d) => ({ value: d.id, label: d.label + (d.beta ? " (beta)" : "") }));

/** Explicit `driver:` config, else the first driver that recognises the device, else null. */
export function pickDriver(hass, cfg) {
  if (cfg.driver && cfg.driver !== "auto") return DRIVERS.find((d) => d.id === cfg.driver) || null;
  return DRIVERS.find((d) => d.match(hass, cfg.entity, cfg)) || null;
}

/** Hardware styles plus the slow (Home Assistant driven) styles every driver can paint. */
export const allStyles = (driver, ctx) => [...driver.styles(ctx), ...DRIFT_STYLES];

/** Style metadata for an effect type under a driver (max colours, speed/minutes, segments). */
export function styleInfo(driver, ctx, type) {
  const s = allStyles(driver, ctx).find((x) => x.id === type);
  if (isDrift(type)) return { label: s?.label || type, colors: 8, speed: false, minutes: true, segments: false };
  const colors = s && s.colors !== undefined ? s.colors : driver.caps.colors;
  return { label: s?.label || type, colors, speed: driver.caps.speed, minutes: false, segments: driver.caps.segments };
}
