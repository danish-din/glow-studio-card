# Strip Studio

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Validate](https://github.com/danish-din/strip-studio-card/actions/workflows/validate.yml/badge.svg)](https://github.com/danish-din/strip-studio-card/actions/workflows/validate.yml)

A Home Assistant dashboard card for the **Aqara LED Strip T1** that finally uses what the strip can do:
paint every segment its own colour, save your designs, and run the strip's built-in animated effects
(woodfire, candlelight, aurora…) with your own colours. Like the Yeelight / Aqara apps, but inside Home Assistant.

<p align="center">
  <img src="https://raw.githubusercontent.com/danish-din/strip-studio-card/main/docs/paint.png" width="270" alt="Paint">
  <img src="https://raw.githubusercontent.com/danish-din/strip-studio-card/main/docs/patterns.png" width="270" alt="Patterns">
  <img src="https://raw.githubusercontent.com/danish-din/strip-studio-card/main/docs/effects.png" width="270" alt="Effects">
</p>

## Features

- **🎨 Paint**: tap or drag across a live preview of the strip to colour each segment. Long-press to select segments, **Mirror** for symmetric designs, **Blend** for smooth gradients, 14 quick swatches plus a full colour picker.
- **▦ Patterns**: save designs with a name; apply, rename, update or delete them. Ships with 11 starters (Golden hour, Dusk, Ocean, Forest, Neon, Rainbow…).
- **✨ Effects**: 14 ready-made effects (Woodfire, Candlelight, Ember glow, Ocean waves, Aurora, Lava lamp, Starry night, Disco, Christmas…). Make your own: pick a style (flicker, breathe, chase, dash, hop, flash, rainbow), up to 8 colours, speed, and which segments it runs on. **▶ Try on strip** before saving.
- **Runs on the strip itself.** Effects use the T1's hardware effect engine, so they're smooth and don't flood your Zigbee network.
- **Shared library.** Patterns and effects are stored in a retained MQTT topic (mirrored into an MQTT sensor), so everyone in the house sees the same library on every device. No extra integration needed.
- **Zero config.** Pick the light; the Zigbee2MQTT topic and the number of segments (5 per metre) are detected automatically.
- Brightness and power controls built in, visual card editor, follows reduced-motion settings.

<p align="center"><img src="https://raw.githubusercontent.com/danish-din/strip-studio-card/main/docs/editor.png" width="300" alt="Effect editor"></p>

## Requirements

- An **Aqara LED Strip T1** (`LGYCDD01LM` / `lumi.light.acn132`) paired with **[Zigbee2MQTT](https://www.zigbee2mqtt.io/)**. A Zigbee2MQTT release with T1 `segment_colors` support (2.x) is needed; ZHA is not supported.
- The **MQTT** integration in Home Assistant (already there if you use Zigbee2MQTT).

## Installation

### HACS (recommended)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/danish-din/strip-studio-card`, type **Dashboard**.
2. Search for **Strip Studio**, install, and reload your browser.

### Manual

1. Download `strip-studio-card.js` from the [latest release](https://github.com/danish-din/strip-studio-card/releases).
2. Copy it to `config/www/`.
3. Settings → Dashboards → ⋮ → **Resources** → add `/local/strip-studio-card.js` as a **JavaScript module**.

## Usage

Add the card from the dashboard editor (search "Strip Studio") and pick your strip, or in YAML:

```yaml
type: custom:strip-studio-card
entity: light.bedroom_strip
```

The first time, the card shows **✨ Set up Strip Studio**. Tap it to create the shared library with the starter patterns and effects.

| Option | Default | Description |
| --- | --- | --- |
| `entity` | **required** | The strip's light entity. |
| `title` | `Strip Studio` | Card title. |
| `z2m_topic` | auto | Zigbee2MQTT set topic, e.g. `zigbee2mqtt/Bedroom Strip/set`. Auto-detected from the device name. Set it if your Home Assistant device name differs from the Zigbee2MQTT friendly name. |
| `z2m_base` | `zigbee2mqtt` | Base topic, if you changed it in Zigbee2MQTT. |
| `segments` | auto | Number of segments. Auto-detected from the strip's `length` (5 segments per metre), else 10. |
| `library_topic` | `strip_studio/<light>/library` | Retained MQTT topic that stores the library. |
| `library_entity` | `sensor.strip_studio_<light>` | The MQTT sensor that mirrors the library. |

### Tip: open Strip Studio instead of the normal light dialog

With [browser_mod](https://github.com/thomasloven/hass-browser_mod) you can make tapping the light open Strip Studio:

```yaml
type: custom:popup-card
target:
  entity_id: light.bedroom_strip
popup_card_all_views: true
title: Bedroom strip
card:
  type: custom:strip-studio-card
  entity: light.bedroom_strip
```

## How it works

- Painting sends Zigbee2MQTT `segment_colors`; an all-black design switches the strip off.
- Effects send `effect_colors`, `effect_segments`, `effect_speed` and `effect` in turn (the strip's built-in engine does the animation).
- The library is one JSON document on a retained MQTT topic, exposed to the frontend through an MQTT-discovery sensor's attributes. Any change from any device updates everyone.

## Development

```bash
npm install
npm test        # unit + DOM tests (node:test + happy-dom) with coverage
npm run build   # bundles src/ into dist/strip-studio-card.js
```

Open `dev/index.html` through a local web server for a mock Home Assistant to click around in.

## Licence

MIT
