import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_SETTINGS_PREFERENCES,
  SettingsPreferences,
} from '../interfaces/settings-preferences';

@Injectable({
  providedIn: 'root',
})
export class SettingsPreferencesStore {
  private readonly storageKey = 'settings:preferences:current';

  readonly settings = signal<SettingsPreferences>(DEFAULT_SETTINGS_PREFERENCES);
  readonly lastSavedAt = signal<number | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    const rawValue = this.getStorage()?.getItem(this.storageKey);
    if (!rawValue) {
      this.settings.set({ ...DEFAULT_SETTINGS_PREFERENCES });
      return;
    }

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (!this.isSettingsPreferences(parsedValue)) {
        this.settings.set({ ...DEFAULT_SETTINGS_PREFERENCES });
        return;
      }

      this.settings.set(this.sanitize(parsedValue));
    } catch {
      this.settings.set({ ...DEFAULT_SETTINGS_PREFERENCES });
    }
  }

  save(nextSettings: SettingsPreferences): void {
    const sanitizedSettings = this.sanitize(nextSettings);
    this.settings.set(sanitizedSettings);
    try {
      this.getStorage()?.setItem(this.storageKey, JSON.stringify(sanitizedSettings));
    } catch {
      // If localStorage fails, the app still keeps the values in memory.
    }
    this.lastSavedAt.set(Date.now());
  }

  resetToDefaults(): void {
    this.save({ ...DEFAULT_SETTINGS_PREFERENCES });
  }

  private sanitize(settings: SettingsPreferences): SettingsPreferences {
    return {
      soundVolume: this.clampVolume(settings.soundVolume),
      musicVolume: this.clampVolume(settings.musicVolume),
      notificationsEnabled: Boolean(settings.notificationsEnabled),
      showOnlineStatus: Boolean(settings.showOnlineStatus),
    };
  }

  private clampVolume(value: number): number {
    if (!Number.isFinite(value)) {
      return 100;
    }

    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private isSettingsPreferences(value: unknown): value is SettingsPreferences {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<SettingsPreferences>;
    return (
      typeof candidate.soundVolume === 'number' &&
      typeof candidate.musicVolume === 'number' &&
      typeof candidate.notificationsEnabled === 'boolean' &&
      typeof candidate.showOnlineStatus === 'boolean'
    );
  }

  private getStorage(): Storage | null {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }

    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }
}
