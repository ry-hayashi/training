'use client';

import { useEffect } from 'react';
import { seedDefaults } from '@/lib/db';

export default function DBInitializer() {
  useEffect(() => {
    seedDefaults().catch(console.error);
  }, []);
  return null;
}
