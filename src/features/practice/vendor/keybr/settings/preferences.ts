// Modified for Keybard: preferences use Keybard's namespaced `appStorage` instead
// of raw `localStorage` (spec §9.2), so github.io previews keep their own values.
import { appStorage } from "@/utils/app-storage";
import { type AnyProp } from "./props.ts";

export class Preferences {
  static get<T>(prop: AnyProp<T>): T {
    return prop.fromJson(getItem(prop.key));
  }

  static set<T>(prop: AnyProp<T>, value: T): void {
    setItem(prop.key, prop.toJson(value));
  }
}

function getItem(key: string): unknown {
  if (typeof window === "object") {
    const item = appStorage.getItem(key);
    if (item != null) {
      try {
        return JSON.parse(item);
      } catch {
        appStorage.removeItem(key);
      }
    }
  }
  return null;
}

function setItem(key: string, value: unknown): void {
  if (typeof window === "object") {
    if (value != null) {
      appStorage.setItem(key, JSON.stringify(value));
    } else {
      appStorage.removeItem(key);
    }
  }
}
