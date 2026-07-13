import type { StreamMode, Tone } from '@rowhouse/types';
import { STREAM_MODES, TONES } from '@rowhouse/types';
import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Toaster,
  toast,
} from '@rowhouse/ui';
import { useEffect, useState } from 'react';
import { api } from '../lib/client';

export interface StudioUser {
  id?: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isCreator: boolean;
}

interface FilmResult {
  slug: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  year: number | null;
  posterPath: string | null;
}

interface CreatedSession {
  id: string;
  status: string;
}

interface EndResult {
  trackId: string;
  totalReactions: number;
  markerCount: number;
  clipCount: number;
  peakViewers: number;
}

/** Small inline film picker used by both the schedule + mini-take forms. */
function FilmSearch({
  selected,
  onSelect,
}: {
  selected: FilmResult | null;
  onSelect: (film: FilmResult | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FilmResult[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2 || selected) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      api<{ results: FilmResult[] }>(`/films/search?q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!cancelled) setResults(r.results);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, selected]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2">
        <span className="text-sm text-text-hi">
          {selected.title}
          {selected.year ? <span className="text-text-dim"> ({selected.year})</span> : null}
        </span>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQ('');
          }}
          className="font-mono text-xs uppercase tracking-wider text-text-dim hover:text-text-hi"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search films & TV..." />
      {(results.length > 0 || busy) && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-surface">
          {busy && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-dim">Searching...</p>
          ) : (
            results.map((f) => (
              <button
                key={f.slug}
                type="button"
                onClick={() => onSelect(f)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-text-mid transition-colors hover:bg-surface-2 hover:text-text-hi"
              >
                <span>{f.title}</span>
                <span className="font-mono text-xs text-text-dim">{f.year ?? f.mediaType}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Studio({ me }: { me: StudioUser }) {
  // Become a creator
  const [becoming, setBecoming] = useState(false);

  // Profile
  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState('');
  const [tone, setTone] = useState<Tone>('analytical');
  const [savingProfile, setSavingProfile] = useState(false);

  // Schedule a live session
  const [liveFilm, setLiveFilm] = useState<FilmResult | null>(null);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveMode, setLiveMode] = useState<StreamMode>('audio');
  const [liveWhen, setLiveWhen] = useState('');
  const [livePlatform, setLivePlatform] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [session, setSession] = useState<CreatedSession | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [endResult, setEndResult] = useState<EndResult | null>(null);

  // Mini-take
  const [takeFilm, setTakeFilm] = useState<FilmResult | null>(null);
  const [takeTitle, setTakeTitle] = useState('');
  const [takeDuration, setTakeDuration] = useState('90');
  const [takingBusy, setTakingBusy] = useState(false);
  const [takeTrackId, setTakeTrackId] = useState<string | null>(null);

  async function becomeCreator() {
    setBecoming(true);
    try {
      await api('/creators/me/become', { method: 'POST' });
      toast.success('You’re a creator now.');
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not become a creator.');
      setBecoming(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api('/creators/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, bio: bio || undefined, tone }),
      });
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function scheduleLive(e: React.FormEvent) {
    e.preventDefault();
    if (!liveFilm) {
      toast.error('Pick a film first.');
      return;
    }
    if (!liveTitle.trim() || !liveWhen) {
      toast.error('Add a title and a time.');
      return;
    }
    setScheduling(true);
    try {
      const scheduledFor = Math.floor(new Date(liveWhen).getTime() / 1000);
      const body: {
        filmSlug: string;
        title: string;
        mode: StreamMode;
        scheduledFor: number;
        platform?: string;
      } = {
        filmSlug: liveFilm.slug,
        title: liveTitle.trim(),
        mode: liveMode,
        scheduledFor,
        ...(livePlatform.trim() ? { platform: livePlatform.trim() } : {}),
      };
      const created = await api<CreatedSession>('/live', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSession(created);
      setEndResult(null);
      toast.success('Live session scheduled.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not schedule.');
    } finally {
      setScheduling(false);
    }
  }

  async function goLive() {
    if (!session) return;
    setSessionBusy(true);
    try {
      await api(`/live/${session.id}/start`, { method: 'POST' });
      setSession({ ...session, status: 'live' });
      toast.success('You’re live.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not go live.');
    } finally {
      setSessionBusy(false);
    }
  }

  async function endAndSave() {
    if (!session) return;
    setSessionBusy(true);
    try {
      const result = await api<EndResult>(`/live/${session.id}/end`, { method: 'POST' });
      setEndResult(result);
      setSession({ ...session, status: 'ended' });
      toast.success('Saved as a track.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not end the session.');
    } finally {
      setSessionBusy(false);
    }
  }

  async function dropMiniTake(e: React.FormEvent) {
    e.preventDefault();
    if (!takeFilm) {
      toast.error('Pick a film first.');
      return;
    }
    const duration = Number.parseInt(takeDuration, 10);
    if (!takeTitle.trim() || !Number.isFinite(duration) || duration <= 0) {
      toast.error('Add a title and a valid length.');
      return;
    }
    setTakingBusy(true);
    try {
      const result = await api<{ trackId: string }>('/tracks', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'mini_take',
          filmSlug: takeFilm.slug,
          title: takeTitle.trim(),
          durationSeconds: duration,
          spoilerSafe: true,
        }),
      });
      setTakeTrackId(result.trackId);
      toast.success('Mini-take created. Record or upload audio next.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the mini-take.');
    } finally {
      setTakingBusy(false);
    }
  }

  const selectClass =
    'h-10 w-full rounded-md border border-border bg-surface px-3 text-base text-text-hi outline-none focus-visible:border-text-dim focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

  return (
    <div className="flex flex-col gap-6">
      <Toaster />

      {/* Become a creator */}
      {!me.isCreator && (
        <Card raised>
          <CardHeader>
            <CardTitle>Become a creator</CardTitle>
            <CardDescription>
              Go live, drop mini-takes, and turn every session into a searchable track.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button onClick={becomeCreator} disabled={becoming}>
              {becoming ? 'Setting up...' : 'Become a creator'}
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you show up across Rowhouse.</CardDescription>
        </CardHeader>
        <CardBody>
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <Field label="Display name" htmlFor="displayName">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Field label="Bio" htmlFor="bio">
              <Input
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="One line about your take."
              />
            </Field>
            <Field label="Tone" htmlFor="tone">
              <select
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className={selectClass}
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save profile'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Schedule a live session */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule a live session</CardTitle>
          <CardDescription>Set the film, the time, and where you’re watching.</CardDescription>
        </CardHeader>
        <CardBody>
          <form onSubmit={scheduleLive} className="flex flex-col gap-4">
            <Field label="Film" htmlFor="liveFilm">
              <FilmSearch selected={liveFilm} onSelect={setLiveFilm} />
            </Field>
            <Field label="Session title" htmlFor="liveTitle">
              <Input
                id="liveTitle"
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="Watch-along: the whole thing"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mode" htmlFor="liveMode">
                <select
                  id="liveMode"
                  value={liveMode}
                  onChange={(e) => setLiveMode(e.target.value as StreamMode)}
                  className={selectClass}
                >
                  {STREAM_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Platform" htmlFor="livePlatform">
                <Input
                  id="livePlatform"
                  value={livePlatform}
                  onChange={(e) => setLivePlatform(e.target.value)}
                  placeholder="Netflix"
                />
              </Field>
            </div>
            <Field label="When" htmlFor="liveWhen">
              <input
                id="liveWhen"
                type="datetime-local"
                value={liveWhen}
                onChange={(e) => setLiveWhen(e.target.value)}
                className={selectClass}
              />
            </Field>
            <div>
              <Button type="submit" disabled={scheduling}>
                {scheduling ? 'Scheduling...' : 'Schedule session'}
              </Button>
            </div>
          </form>

          {/* Session controls: the live-to-on-demand flywheel. */}
          {session && (
            <div className="mt-6 rounded-md border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-text-mid">
                    Session
                  </p>
                  <p className="mt-1 font-mono text-sm text-text-hi">
                    {session.id} · <span className="text-accent-hi">{session.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/live/${session.id}`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-text-mid transition-colors hover:text-text-hi"
                  >
                    Open live page
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={goLive}
                    disabled={
                      sessionBusy || session.status === 'live' || session.status === 'ended'
                    }
                  >
                    Go live
                  </Button>
                  <Button
                    size="sm"
                    onClick={endAndSave}
                    disabled={sessionBusy || session.status === 'ended'}
                  >
                    End &amp; save
                  </Button>
                </div>
              </div>

              {endResult && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-sm text-text-hi">
                    Your live session is now a searchable async track.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-text-dim">
                    <span>{endResult.markerCount} markers</span>
                    <span>{endResult.clipCount} clip suggestions</span>
                    <span>{endResult.totalReactions} reactions</span>
                    <span>peak {endResult.peakViewers}</span>
                  </div>
                  <a
                    href={`/track/${endResult.trackId}`}
                    className="mt-3 inline-block rounded-md bg-accent px-3 py-2 text-sm font-medium text-text-hi hover:bg-accent-hi"
                  >
                    Open the replay track
                  </a>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Drop a mini-take */}
      <Card>
        <CardHeader>
          <CardTitle>Drop a mini-take</CardTitle>
          <CardDescription>A short async commentary. Audio upload comes next.</CardDescription>
        </CardHeader>
        <CardBody>
          <form onSubmit={dropMiniTake} className="flex flex-col gap-4">
            <Field label="Film" htmlFor="takeFilm">
              <FilmSearch selected={takeFilm} onSelect={setTakeFilm} />
            </Field>
            <Field label="Title" htmlFor="takeTitle">
              <Input
                id="takeTitle"
                value={takeTitle}
                onChange={(e) => setTakeTitle(e.target.value)}
                placeholder="The twist, explained"
              />
            </Field>
            <Field label="Length (seconds)" htmlFor="takeDuration">
              <Input
                id="takeDuration"
                type="number"
                min={1}
                value={takeDuration}
                onChange={(e) => setTakeDuration(e.target.value)}
              />
            </Field>
            <div>
              <Button type="submit" disabled={takingBusy}>
                {takingBusy ? 'Creating...' : 'Create mini-take'}
              </Button>
            </div>
          </form>

          {takeTrackId && (
            <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">
              <p className="text-sm text-text-hi">
                Mini-take created. Record or upload audio next.
              </p>
              <a
                href={`/track/${takeTrackId}`}
                className="mt-2 inline-block font-mono text-xs uppercase tracking-widest text-accent-hi hover:text-accent"
              >
                Open the track
              </a>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
