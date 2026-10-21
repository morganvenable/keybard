# Two halves on separate USB cables

Status: tracking only. Nothing is built yet.

## The case

Both halves of one Svalboard plugged into the same computer, each by its own
USB cable, with or without the split cable between them. Each half then runs
as its own USB device. The halves never run the split link with each other, so
nothing passes between them on its own.

## What already works

- Identity: each half has its own serial (the identity record, from the chip),
  which is also its USB serial. It is not tied to the side or the firmware.
  WebHID can't read the USB serial, but the identity INFO request (VIA custom
  value, channel 0x49, op 0) returns it, so Keybard can tell the two devices
  apart. Sval get_info's UID is the same on every Svalboard and can't. The USB
  ID (0x4044) is the same on every build and says nothing about the side.
- Side: Keybard reads each half's side with Sval 0x33 GET. A half with no side
  doesn't type.

## What's missing

1. **Pairing.** Keybard has to know that two connected devices are the two
   halves of one board, and remember that across sessions. This should be
   confirmed by the customer, never assumed.
2. **Same side check.** The firmware checks for two halves on the same side over
   the split link, which isn't running here. Keybard has to compare the two
   sides itself, warn, and ask the customer which half is which.
3. **Layer state.** A layer key held on one half has to change the layer on the
   other half. With no split link, Keybard (or Keybard Overlay) would have to
   relay layer state between the two devices, and fast enough not to be felt.
   This is the subtle part: timing, missed messages, a host that sleeps or
   drops one device, and which half owns the state.
4. **Shared state beyond layers.** Modifiers held across halves, one-shot
   keys, combos that span halves, caps word, Auto Shift and pointing modes all
   assume one keyboard. Each needs a decision.
5. **Keymap and settings.** Today the half with USB holds the whole keymap.
   With two devices, edits and updates have to reach both and stay in sync.

## Open questions

- Is this a supported setup, or a fallback for a broken split cable?
- Does relaying belong in Keybard in the browser, in Keybard Overlay, or in
  the firmware?
- What latency is acceptable for a relayed layer change?

## Test plan, when work starts

Test only on test boards, one job per board, always by serial. Never the daily
driver.
