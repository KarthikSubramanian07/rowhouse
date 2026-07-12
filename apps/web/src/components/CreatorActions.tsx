import { Button } from '@rowhouse/ui';
import { useState } from 'react';
import { api } from '../lib/client';

type FollowProps = {
  mode?: 'follow';
  handle: string;
  initialFollowing: boolean;
};

type UpvoteProps = {
  mode: 'upvote';
  handle: string;
  filmSlug: string;
  initialUpvotes: number;
};

type Props = FollowProps | UpvoteProps;

/**
 * Interactive creator-profile actions. Two shapes:
 *  - follow (default): Follow/Following toggle → POST/DELETE /creators/:handle/follow
 *  - upvote: watch-list upvote → POST /watchlist/:handle/:filmSlug/upvote
 * Both are optimistic and surface a subtle sign-in hint on 401.
 */
export default function CreatorActions(props: Props) {
  if (props.mode === 'upvote') return <UpvoteButton {...props} />;
  return <FollowButton {...props} />;
}

function isAuthError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('401');
}

function FollowButton({ handle, initialFollowing }: FollowProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setNeedsAuth(false);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      const res = await api<{ following: boolean }>(`/creators/${handle}/follow`, {
        method: next ? 'POST' : 'DELETE',
      });
      setFollowing(res.following);
    } catch (err) {
      setFollowing(!next); // revert
      if (isAuthError(err)) setNeedsAuth(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        size="sm"
        variant={following ? 'outline' : 'primary'}
        onClick={toggle}
        disabled={busy}
      >
        {following ? 'Following' : 'Follow'}
      </Button>
      {needsAuth && <span className="font-mono text-[11px] text-text-dim">Sign in to follow.</span>}
    </div>
  );
}

function UpvoteButton({ handle, filmSlug, initialUpvotes }: UpvoteProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  async function upvote() {
    if (busy || voted) return;
    setBusy(true);
    setNeedsAuth(false);
    setUpvotes((n) => n + 1); // optimistic
    setVoted(true);
    try {
      const res = await api<{ ok: boolean; counted: boolean }>(
        `/watchlist/${handle}/${filmSlug}/upvote`,
        { method: 'POST' },
      );
      if (!res.counted) setUpvotes((n) => n - 1); // already voted server-side
    } catch (err) {
      setUpvotes((n) => n - 1); // revert
      setVoted(false);
      if (isAuthError(err)) setNeedsAuth(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={upvote}
      disabled={busy || voted}
      title={needsAuth ? 'Sign in to upvote' : 'Upvote'}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-text-mid transition-colors hover:border-accent/40 hover:text-text-hi disabled:opacity-60"
      aria-pressed={voted}
    >
      <span aria-hidden="true" className={voted ? 'text-accent-hi' : ''}>
        ▲
      </span>
      <span className="tabular-nums">{upvotes}</span>
    </button>
  );
}
