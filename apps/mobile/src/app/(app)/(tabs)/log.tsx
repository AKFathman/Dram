// Placeholder tab target; the tab press is intercepted in _layout.tsx and opens the /log modal.
import { Redirect } from 'expo-router';
import React from 'react';

export default function LogTab() {
  return <Redirect href="/log" />;
}
