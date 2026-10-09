// Modified for Keybard (spec §9.2):
// - keybr's TimeToType (which divides by the OS-visible Shift/Alt/AltGraph/Dead
//   keys) is replaced: the handler reports the raw interval since the previous
//   input, and Practice divides by physical presses (input/timeToType.ts, §6.5).
//   A different timer can be passed to the constructor.
// - Tab is no longer prevented, so Tab leaves the practice text (§5.11).
// - `Focusable` from @keybr/widget is not vendored; the methods are kept.
// - `process.env.NODE_ENV` checks use Vite's `import.meta.env.PROD`.
import { mapEvent, timeStampOf } from "./events.ts";
import { ModifierState } from "./modifiers.ts";
import { type IInputEvent, type IKeyboardEvent, type InputListener } from "./types.ts";

/** Measures the time taken to type a character, from the input event stream. */
export type InputTimer = {
  add(event: IKeyboardEvent): void;
  measure(event: Pick<IInputEvent, "timeStamp">): number;
};

/** The interval since the previous input event, with no modifier divisor. */
export class IntervalTimer implements InputTimer {
  #timeStamp = 0;

  add(_event: IKeyboardEvent): void {}

  measure({ timeStamp }: Pick<IInputEvent, "timeStamp">): number {
    const duration = timeStamp - this.#timeStamp;
    this.#timeStamp = timeStamp;
    return duration;
  }
}

// https://w3c.github.io/uievents/
// https://www.w3.org/TR/input-events-1/
// https://www.w3.org/TR/input-events-2/
// https://domeventviewer.com/key-event-viewer.html

export type Callbacks = {
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
} & Partial<InputListener>;

export class InputHandler {
  readonly #timeToType: InputTimer;
  #callbacks: Callbacks = {};
  #input: HTMLTextAreaElement | null = null;

  constructor(timer: InputTimer = new IntervalTimer()) {
    this.#timeToType = timer;
  }

  setCallbacks(callbacks: Callbacks) {
    this.#callbacks = callbacks;
  }

  setInput(input: HTMLTextAreaElement | null) {
    if (input != null) {
      this.#input = input;
      this.#attachInput();
    } else {
      this.#detachInput();
      this.#input = null;
    }
  }

  focus() {
    this.#input?.focus();
  }

  blur() {
    this.#input?.blur();
  }

  #attachInput() {
    ModifierState.initialize();
    const input = this.#input;
    if (input != null) {
      input.addEventListener("focus", this.handleFocus);
      input.addEventListener("blur", this.handleBlur);
      input.addEventListener("keydown", this.handleKeyboard);
      input.addEventListener("keyup", this.handleKeyboard);
      input.addEventListener("input", this.handleInput as any);
      input.addEventListener("compositionstart", this.handleComposition);
      input.addEventListener("compositionupdate", this.handleComposition);
      input.addEventListener("compositionend", this.handleComposition);
    }
    this.focus();
    this.#clearInput();
  }

  #detachInput() {
    const input = this.#input;
    if (input != null) {
      input.removeEventListener("focus", this.handleFocus);
      input.removeEventListener("blur", this.handleBlur);
      input.removeEventListener("keydown", this.handleKeyboard);
      input.removeEventListener("keyup", this.handleKeyboard);
      input.removeEventListener("input", this.handleInput as any);
      input.removeEventListener("compositionstart", this.handleComposition);
      input.removeEventListener("compositionupdate", this.handleComposition);
      input.removeEventListener("compositionend", this.handleComposition);
    }
  }

  #clearInput() {
    const input = this.#input;
    if (input != null) {
      // Keep the input value non-empty, otherwise Safari will not generate
      // events `deleteContentBackward` and `deleteWordBackward`.
      input.value = "?";
    }
  }

  handleFocus = () => {
    this.#callbacks.onFocus?.();
  };

  handleBlur = () => {
    this.#callbacks.onBlur?.();
  };

  handleKeyboard = (event: KeyboardEvent) => {
    if (import.meta.env.PROD) {
      if (!(event instanceof KeyboardEvent && event.isTrusted)) {
        return;
      }
    }
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    const mapped = mapEvent(event);
    if (event.code) {
      this.#timeToType.add(mapped);
      switch (mapped.type) {
        case "keydown":
          this.#callbacks.onKeyDown?.(mapped);
          break;
        case "keyup":
          this.#callbacks.onKeyUp?.(mapped);
          break;
      }
    }
  };

  handleInput = (event: InputEvent) => {
    if (import.meta.env.PROD) {
      if (!(event instanceof InputEvent && event.isTrusted)) {
        return;
      }
    }
    switch (event.inputType) {
      case "insertText":
        this.#appendChar(event);
        this.#clearInput();
        break;
      case "insertLineBreak":
        this.#callbacks.onInput?.({
          type: "input",
          timeStamp: timeStampOf(event),
          inputType: "appendLineBreak",
          codePoint: 0x0000,
          timeToType: this.#timeToType.measure(event),
        });
        this.#clearInput();
        break;
      case "deleteContentBackward":
        this.#callbacks.onInput?.({
          type: "input",
          timeStamp: timeStampOf(event),
          inputType: "clearChar",
          codePoint: 0x0000,
          timeToType: this.#timeToType.measure(event),
        });
        this.#clearInput();
        break;
      case "deleteWordBackward":
        this.#callbacks.onInput?.({
          type: "input",
          timeStamp: timeStampOf(event),
          inputType: "clearWord",
          codePoint: 0x0000,
          timeToType: this.#timeToType.measure(event),
        });
        this.#clearInput();
        break;
      case "insertFromPaste":
        this.#clearInput();
        break;
    }
  };

  handleComposition = (event: CompositionEvent) => {
    switch (event.type) {
      case "compositionstart":
      case "compositionupdate":
        break;
      case "compositionend":
        this.#appendChar(event);
        this.#clearInput();
        break;
    }
  };

  #appendChar(event: InputEvent | CompositionEvent) {
    const { data } = event;
    if (data != null && data.length > 0) {
      const codePoint = data.codePointAt(0) ?? 0x0000;
      if (codePoint > 0x0000) {
        this.#callbacks.onInput?.({
          type: "input",
          timeStamp: timeStampOf(event),
          inputType: "appendChar",
          codePoint,
          timeToType: this.#timeToType.measure(event),
        });
      }
    }
  }
}
