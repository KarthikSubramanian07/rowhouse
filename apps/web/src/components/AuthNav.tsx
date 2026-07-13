import { Button } from '@rowhouse/ui';
import { useEffect, useState } from 'react';
import { api } from '../lib/client';

interface Me {
  user: {
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    isCreator: boolean;
  } | null;
  google: boolean;
}

export default function AuthNav() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Me>('/auth/me')
      .then(setMe)
      .catch(() => setMe({ user: null, google: false }));
  }, []);

  async function signIn() {
    if (me?.google) {
      window.location.href = '/api/auth/google';
      return;
    }
    setBusy(true);
    try {
      await api('/auth/dev', { method: 'POST' });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  }

  if (!me) return <span className="inline-block w-16" />;

  if (!me.user) {
    return (
      <Button size="sm" onClick={signIn} disabled={busy}>
        {busy ? 'Signing in...' : 'Sign in'}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/creator/${me.user.handle}`}
        className="hidden rounded-md px-3 py-1.5 text-text-mid transition-colors hover:bg-surface hover:text-text-hi sm:inline"
      >
        {me.user.isCreator ? 'Studio' : 'Profile'}
      </a>
      <a
        href={`/creator/${me.user.handle}`}
        className="flex items-center gap-2"
        aria-label="Your profile"
      >
        <span className="grid size-8 place-items-center rounded-full bg-surface-2 font-mono text-xs text-text-hi ring-1 ring-border">
          {me.user.displayName.slice(0, 1).toUpperCase()}
        </span>
      </a>
      <button
        type="button"
        onClick={signOut}
        className="rounded-md px-2 py-1.5 text-xs text-text-dim transition-colors hover:text-text-hi"
      >
        Sign out
      </button>
    </div>
  );
}
