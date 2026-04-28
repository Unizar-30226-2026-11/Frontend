export interface SettingsPreferences {
  soundVolume: number;
  musicVolume: number;
  notificationsEnabled: boolean;
  showOnlineStatus: boolean;
}

export const DEFAULT_SETTINGS_PREFERENCES: SettingsPreferences = {
  soundVolume: 100,
  musicVolume: 100,
  notificationsEnabled: false,
  showOnlineStatus: false,
};
