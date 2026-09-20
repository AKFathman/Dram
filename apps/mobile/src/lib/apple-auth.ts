/**
 * Guarded access to expo-apple-authentication.
 *
 * Sign in with Apple is a native module. It is absent on Android, absent on
 * web, and may be absent in Expo Go depending on the client build. Importing
 * it unconditionally crashes the first screen in those environments, so load
 * it defensively and let callers fall back to email or Google.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type AppleAuthModule = typeof import('expo-apple-authentication');

function load(): AppleAuthModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-apple-authentication') as AppleAuthModule;
    // The JS module can resolve while the native view stays unregistered, so
    // check the export at runtime rather than trusting its static type.
    const hasButton = (mod as { AppleAuthenticationButton?: unknown } | undefined)?.AppleAuthenticationButton;
    return hasButton ? mod : null;
  } catch {
    return null;
  }
}

export const AppleAuth = load();

/** Message shown when the user taps Apple sign-in somewhere it cannot work. */
export const APPLE_UNAVAILABLE =
  'Sign in with Apple needs a development build of Dram on an iPhone. Use email or Google here.';

/**
 * True only once the device confirms Apple sign-in is usable. Starts false, so
 * the button never flashes on a device that cannot support it.
 */
export function useAppleAuthAvailable(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!AppleAuth) return;
    AppleAuth.isAvailableAsync()
      .then((ok) => {
        if (active) setReady(ok);
      })
      .catch(() => {
        if (active) setReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return ready;
}
