"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { deleteGeneratedMusic, deleteMusicStyleProfile, generateAndSaveMusic, generateRandomMusicIdea, getMusicStyleProfiles, getUserGeneratedMusic, improveMusicCaption, improveMusicIdea, improveMusicLyrics, saveMusicStyleProfile, suggestMusicDuration } from '@/lib/user-api';
import { getPackage, getUserData } from '@/lib/database';
import type { GeneratedMusic, MusicStyleProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, Loader2, Music2, Sparkles, Dices, AlertCircle, Clock3, Download, ExternalLink, Library, ChevronLeft, ChevronRight, Trash2, Save } from 'lucide-react';

const TRACKS_PER_PAGE = 6;

function formatTrackDate(value: GeneratedMusic['createdAt']) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recently generated'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function LoadingState() {
  return (
    <div>
      <Card className="mb-8">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-36" />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export default function MusicGenerationPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [songIdea, setSongIdea] = useState('');
  const [lyricsPrompt, setLyricsPrompt] = useState('');
  const [altPrompt, setAltPrompt] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('40');
  const [styleProfiles, setStyleProfiles] = useState<MusicStyleProfile[]>([]);
  const [selectedStyleProfileId, setSelectedStyleProfileId] = useState('');
  const [styleProfileName, setStyleProfileName] = useState('');
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [isDeletingStyle, setIsDeletingStyle] = useState(false);

  const [tracks, setTracks] = useState<GeneratedMusic[]>([]);
  const [galleryPage, setGalleryPage] = useState(1);
  const [pendingDeleteTrackId, setPendingDeleteTrackId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [songIdeaAction, setSongIdeaAction] = useState<'improve' | 'random' | null>(null);
  const [isImprovingLyrics, setIsImprovingLyrics] = useState(false);
  const [isImprovingCaption, setIsImprovingCaption] = useState(false);
  const [isSuggestingDuration, setIsSuggestingDuration] = useState(false);

  const [limit, setLimit] = useState(0);
  const [count, setCount] = useState(0);
  const [limitType, setLimitType] = useState<'daily' | 'lifetime'>('daily');
  const [allowMusicGeneration, setAllowMusicGeneration] = useState(false);
  const [allowAiAssist, setAllowAiAssist] = useState(false);
  const [allowStyleProfiles, setAllowStyleProfiles] = useState(false);
  const lastDurationSuggestionRef = useRef('');
  const durationSuggestionRequestRef = useRef(0);

  const fetchPageData = async () => {
    if (!user) return;
    setIsPageLoading(true);

    try {
      const [userData, generatedMusicResult] = await Promise.all([
        getUserData(user.uid),
        getUserGeneratedMusic(user.uid),
      ]);

      if (!generatedMusicResult.success) {
        throw new Error(generatedMusicResult.message || 'Could not load generated music.');
      }

      if (userData?.packageId) {
        const pkg = await getPackage(userData.packageId);
        const packageLimit = pkg?.musicGenerationLimit ?? 0;
        const packageLimitType = pkg?.musicGenerationLimitType || 'daily';

        setLimit(packageLimit);
        setLimitType(packageLimitType);
        setAllowMusicGeneration(pkg?.allowMusicGeneration === true);
        setAllowAiAssist(pkg?.allowMusicGenerationAssist === true);
        const styleProfilesAllowed = pkg?.allowMusicStyleProfiles === true;
        setAllowStyleProfiles(styleProfilesAllowed);
        if (styleProfilesAllowed) {
          const profilesResult = await getMusicStyleProfiles(user.uid);
          if (profilesResult.success) setStyleProfiles(profilesResult.profiles || []);
        } else {
          setStyleProfiles([]);
        }

        if (packageLimitType === 'lifetime') {
          setCount(userData.packageMusicGenerationCount || 0);
        } else {
          const lastReset = userData.lastMusicGenerationReset ? new Date(userData.lastMusicGenerationReset) : new Date(0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          setCount(lastReset < today ? 0 : userData.dailyMusicGenerationCount || 0);
        }
      } else {
        setLimit(0);
        setCount(0);
        setAllowMusicGeneration(false);
        setAllowAiAssist(false);
        setAllowStyleProfiles(false);
        setStyleProfiles([]);
      }

      setTracks(generatedMusicResult.music || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Could not load music generation data.', variant: 'destructive' });
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchPageData();
    }
  }, [authLoading, user]);

  const canGenerate = allowMusicGeneration && limit > 0 && count < limit;

  useEffect(() => {
    if (!user || !allowAiAssist || !canGenerate || isGenerating) return;
    const lyrics = lyricsPrompt.trim();
    const wordCount = lyrics.split(/\s+/).filter(Boolean).length;
    if (wordCount < 8) return;

    const caption = altPrompt.trim();
    const signature = `${lyrics}\u0000${caption}`;
    if (lastDurationSuggestionRef.current === signature) return;

    const requestId = ++durationSuggestionRequestRef.current;
    const timeout = window.setTimeout(async () => {
      setIsSuggestingDuration(true);
      try {
        const result = await suggestMusicDuration(user.uid, lyrics, caption || undefined);
        if (requestId !== durationSuggestionRequestRef.current) return;
        if (result.success && result.durationSeconds) {
          lastDurationSuggestionRef.current = signature;
          setDurationSeconds(String(result.durationSeconds));
        }
      } catch {
        // Automatic suggestions are best-effort; the manual duration control remains available.
      } finally {
        if (requestId === durationSuggestionRequestRef.current) setIsSuggestingDuration(false);
      }
    }, 1500);

    return () => {
      window.clearTimeout(timeout);
      durationSuggestionRequestRef.current += 1;
      setIsSuggestingDuration(false);
    };
  }, [user, lyricsPrompt, altPrompt, allowAiAssist, canGenerate, isGenerating]);

  const limitMessage = () => {
    if (!allowMusicGeneration) return 'Music generation is not included in your current package.';
    if (limit <= 0) return 'Your current package has no music generation quota.';
    if (!canGenerate) return `You have reached your ${limitType} music generation limit.`;
    return `${limit - count} of ${limit} generations remaining ${limitType === 'lifetime' ? 'for this package' : 'today'}.`;
  };

  const handleGeneratePrompts = async () => {
    if (!user || !songIdea.trim()) return;

    setIsGeneratingPrompts(true);
    try {
      const styleContext = altPrompt.trim() ? `\n\nRequired music style:\n${altPrompt.trim()}` : '';
      const [lyricsResult, captionResult] = await Promise.all([
        improveMusicLyrics(user.uid, `${songIdea}${styleContext}`),
        improveMusicCaption(user.uid, `${songIdea}${styleContext}`),
      ]);

      const generatedLyrics = lyricsResult.success ? lyricsResult.improvedPrompt?.trim() : '';
      const generatedCaption = captionResult.success ? captionResult.improvedPrompt?.trim() : '';

      if (generatedLyrics) setLyricsPrompt(generatedLyrics);
      if (generatedCaption) setAltPrompt(generatedCaption);

      if (generatedLyrics && generatedCaption) {
        toast({ title: 'Lyrics and caption generated' });
      } else {
        const failedParts = [
          !generatedLyrics ? 'lyrics' : '',
          !generatedCaption ? 'caption' : '',
        ].filter(Boolean).join(' and ');
        toast({
          title: `Could not generate ${failedParts}`,
          description: lyricsResult.message || captionResult.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const handleSongIdeaAction = async (action: 'improve' | 'random') => {
    if (!user || (action === 'improve' && !songIdea.trim())) return;

    setSongIdeaAction(action);
    try {
      const selectedStyle = styleProfiles.find((profile) => profile.id === selectedStyleProfileId);
      const activeStyle = selectedStyle?.caption || altPrompt.trim();
      const result = action === 'improve'
        ? await improveMusicIdea(user.uid, songIdea)
        : await generateRandomMusicIdea(user.uid, activeStyle || undefined);

      if (result.success && result.improvedPrompt) {
        const generatedIdea = result.improvedPrompt;
        setSongIdea(generatedIdea);

        if (action === 'random') {
          const styleContext = activeStyle ? `\n\nRequired music style:\n${activeStyle}` : '';
          const [lyricsResult, captionResult] = await Promise.all([
            improveMusicLyrics(user.uid, `${generatedIdea}${styleContext}`),
            improveMusicCaption(user.uid, `${generatedIdea}${styleContext}`),
          ]);
          const generatedLyrics = lyricsResult.improvedPrompt?.trim();
          const generatedCaption = captionResult.improvedPrompt?.trim() || activeStyle;
          if (!lyricsResult.success || !generatedLyrics || !captionResult.success || !generatedCaption) {
            throw new Error(lyricsResult.message || captionResult.message || 'Could not complete the random song draft.');
          }

          setLyricsPrompt(generatedLyrics);
          setAltPrompt(generatedCaption);
          const durationResult = await suggestMusicDuration(user.uid, generatedLyrics, generatedCaption);
          if (durationResult.success && durationResult.durationSeconds) {
            lastDurationSuggestionRef.current = `${generatedLyrics}\u0000${generatedCaption}`;
            setDurationSeconds(String(durationResult.durationSeconds));
          }
          toast({ title: activeStyle ? 'Style-aligned song draft generated' : 'Random song draft generated' });
        } else {
          toast({ title: 'Song description improved' });
        }
      } else {
        toast({ title: 'Could not generate song description', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSongIdeaAction(null);
    }
  };

  const handleImproveLyrics = async () => {
    if (!user || !lyricsPrompt.trim()) return;
    setIsImprovingLyrics(true);
    try {
      const result = await improveMusicLyrics(user.uid, lyricsPrompt);
      if (result.success && result.improvedPrompt) {
        setLyricsPrompt(result.improvedPrompt);
        toast({ title: 'Lyrics improved' });
      } else {
        toast({ title: 'Could not improve lyrics', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsImprovingLyrics(false);
    }
  };

  const handleImproveCaption = async () => {
    if (!user || !altPrompt.trim()) return;
    setIsImprovingCaption(true);
    try {
      const result = await improveMusicCaption(user.uid, altPrompt);
      if (result.success && result.improvedPrompt) {
        setAltPrompt(result.improvedPrompt);
        toast({ title: 'Music caption improved' });
      } else {
        toast({ title: 'Could not improve caption', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsImprovingCaption(false);
    }
  };

  const handleSuggestDuration = async () => {
    if (!user || !lyricsPrompt.trim()) return;
    setIsSuggestingDuration(true);
    try {
      const result = await suggestMusicDuration(user.uid, lyricsPrompt, altPrompt);
      if (result.success && result.durationSeconds) {
        lastDurationSuggestionRef.current = `${lyricsPrompt.trim()}\u0000${altPrompt.trim()}`;
        setDurationSeconds(String(result.durationSeconds));
        toast({ title: 'Duration suggested', description: `${result.durationSeconds} seconds based on your lyrics.` });
      } else {
        toast({ title: 'Could not suggest duration', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: 'Could not suggest duration',
        description: error instanceof Error ? error.message : 'Unknown error.',
        variant: 'destructive',
      });
    } finally {
      setIsSuggestingDuration(false);
    }
  };

  const handleSaveStyleProfile = async () => {
    if (!user || !styleProfileName.trim() || !altPrompt.trim()) return;
    setIsSavingStyle(true);
    try {
      const result = await saveMusicStyleProfile(user.uid, styleProfileName, altPrompt);
      if (!result.success || !result.profile) throw new Error(result.message || 'Could not save music style.');
      const savedProfile = result.profile;
      setStyleProfiles((previous) => [...previous.filter((profile) => profile.id !== savedProfile.id && profile.name.toLowerCase() !== savedProfile.name.toLowerCase()), savedProfile].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedStyleProfileId(savedProfile.id);
      setStyleProfileName(savedProfile.name);
      toast({ title: result.message || 'Music style saved' });
    } catch (error) {
      toast({ title: 'Could not save style', description: error instanceof Error ? error.message : 'Unknown error.', variant: 'destructive' });
    } finally {
      setIsSavingStyle(false);
    }
  };

  const handleDeleteStyleProfile = async () => {
    if (!user || !selectedStyleProfileId) return;
    setIsDeletingStyle(true);
    try {
      const result = await deleteMusicStyleProfile(user.uid, selectedStyleProfileId);
      if (!result.success) throw new Error(result.message || 'Could not delete music style.');
      setStyleProfiles((previous) => previous.filter((profile) => profile.id !== selectedStyleProfileId));
      setSelectedStyleProfileId('');
      setStyleProfileName('');
      toast({ title: 'Music style deleted' });
    } catch (error) {
      toast({ title: 'Could not delete style', description: error instanceof Error ? error.message : 'Unknown error.', variant: 'destructive' });
    } finally {
      setIsDeletingStyle(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return;
    }

    if (!lyricsPrompt.trim()) {
      toast({ title: 'Lyrics prompt required', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateAndSaveMusic(user.uid, {
        prompt: lyricsPrompt,
        altPrompt,
        durationSeconds: Number(durationSeconds) || 40,
      });

      if (result.success && result.music) {
        const generatedMusic = result.music;
        toast({ title: 'Music generated successfully' });
        setTracks((prev) => [generatedMusic, ...prev]);
        setGalleryPage(1);
        setCount((prev) => prev + 1);
      } else {
        toast({ title: 'Generation failed', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteTrack = async () => {
    if (!user || !pendingDeleteTrackId || deletingTrackId) return;
    const trackId = pendingDeleteTrackId;
    setDeletingTrackId(trackId);
    try {
      const result = await deleteGeneratedMusic(user.uid, trackId);
      if (!result.success) throw new Error(result.message || 'Could not delete track.');

      setTracks((previous) => previous.filter((track) => track.id !== trackId));
      setPendingDeleteTrackId(null);
      toast({ title: 'Track deleted' });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Could not delete track.',
        variant: 'destructive',
      });
    } finally {
      setDeletingTrackId(null);
    }
  };

  if (authLoading || isPageLoading) return <LoadingState />;

  const totalGalleryPages = Math.max(1, Math.ceil(tracks.length / TRACKS_PER_PAGE));
  const currentGalleryPage = Math.min(galleryPage, totalGalleryPages);
  const visibleTracks = tracks.slice(
    (currentGalleryPage - 1) * TRACKS_PER_PAGE,
    currentGalleryPage * TRACKS_PER_PAGE
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">AI Music Generation</h1>
        <p className="text-muted-foreground mt-1">Create tracks from lyrics and optional music caption guidance.</p>
      </div>

      {!allowMusicGeneration && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Music generation unavailable</AlertTitle>
          <AlertDescription>
            Your current package does not allow music generation. Upgrade or change your package to create music.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Compose Prompt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Music Style</p>
              <p className="text-xs text-muted-foreground">
                Define the sound first. Every generated idea, lyric, caption, and duration can then follow this creative identity.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select
                value={selectedStyleProfileId}
                onValueChange={(profileId) => {
                  const profile = styleProfiles.find((item) => item.id === profileId);
                  setSelectedStyleProfileId(profileId);
                  if (profile) {
                    setStyleProfileName(profile.name);
                    setAltPrompt(profile.caption);
                  }
                }}
                disabled={!allowStyleProfiles || styleProfiles.length === 0 || isGenerating}
              >
                <SelectTrigger><SelectValue placeholder="Choose saved style" /></SelectTrigger>
                <SelectContent>
                  {styleProfiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={styleProfileName}
                onChange={(event) => setStyleProfileName(event.target.value)}
                placeholder="Style name, e.g. Christian Rock"
                maxLength={60}
                disabled={!allowStyleProfiles || isSavingStyle || isGenerating}
              />
            </div>
            <Textarea
              value={altPrompt}
              onChange={(event) => setAltPrompt(event.target.value)}
              placeholder="Describe genre, tempo, instruments, mood, vocals, and production identity"
              className="min-h-24"
              disabled={isGenerating || isGeneratingPrompts || !canGenerate}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleImproveCaption} disabled={!altPrompt.trim() || !allowAiAssist || isImprovingCaption || isGenerating}>
                {isImprovingCaption ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Improve Style with AI
              </Button>
              <Button type="button" variant="outline" onClick={handleSaveStyleProfile} disabled={!allowStyleProfiles || !styleProfileName.trim() || !altPrompt.trim() || isSavingStyle || isGenerating}>
                {isSavingStyle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Style
              </Button>
              <Button type="button" variant="ghost" onClick={handleDeleteStyleProfile} disabled={!selectedStyleProfileId || isDeletingStyle || isGenerating}>
                {isDeletingStyle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Style
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {allowStyleProfiles ? 'Save up to 10 reusable styles with your current package.' : 'You can enter a style manually, but reusable style profiles are not included in your package.'}
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">Describe Your Song <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Textarea
                value={songIdea}
                onChange={(e) => setSongIdea(e.target.value)}
                placeholder="Describe the story, mood, genre, characters, or message you want in the song"
                className="min-h-24"
                disabled={isGenerating || isGeneratingPrompts || songIdeaAction !== null || !canGenerate || !allowAiAssist}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleSongIdeaAction('improve')}
                variant="outline"
                disabled={songIdeaAction !== null || isGeneratingPrompts || isGenerating || !songIdea.trim() || !canGenerate || !allowAiAssist}
              >
                {songIdeaAction === 'improve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Improve with AI
              </Button>
              <Button
                onClick={() => handleSongIdeaAction('random')}
                variant="outline"
                disabled={songIdeaAction !== null || isGeneratingPrompts || isGenerating || !canGenerate || !allowAiAssist}
              >
                {songIdeaAction === 'random' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dices className="mr-2 h-4 w-4" />}
                Generate Random Song
              </Button>
              <Button
                onClick={handleGeneratePrompts}
                variant="secondary"
                disabled={songIdeaAction !== null || isGeneratingPrompts || isGenerating || !songIdea.trim() || !canGenerate || !allowAiAssist}
              >
                {isGeneratingPrompts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Lyrics &amp; Caption
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {allowAiAssist
                ? 'Use this for a first draft, or skip it and enter your lyrics and caption manually below.'
                : 'AI lyrics and caption assistance is not included in your current package.'}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Lyrics Prompt (Required. Lyrics with [Verse], [Chorus], [Bridge] markers)</label>
            <Textarea
              value={lyricsPrompt}
              onChange={(e) => setLyricsPrompt(e.target.value)}
              placeholder="Write lyrics, hooks, or a concept for the song"
              className="min-h-28"
              disabled={isGenerating || isGeneratingPrompts || !canGenerate}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button onClick={handleImproveLyrics} variant="outline" disabled={isImprovingLyrics || isGeneratingPrompts || isGenerating || !lyricsPrompt.trim() || !canGenerate || !allowAiAssist}>
              {isImprovingLyrics ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Improve Lyrics With AI
            </Button>
            <div className="flex gap-2">
              <Input
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
                type="number"
                min={10}
                max={240}
                className="min-w-0"
                disabled={isGenerating || isGeneratingPrompts || isSuggestingDuration || !canGenerate}
                placeholder="Duration (sec)"
                aria-label="Music duration in seconds"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleSuggestDuration}
                disabled={isSuggestingDuration || isGenerating || isGeneratingPrompts || !lyricsPrompt.trim() || !canGenerate || !allowAiAssist}
                title="Suggest duration with AI"
                aria-label="Suggest duration with AI"
              >
                {isSuggestingDuration ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">{limitMessage()}</p>
            <Button onClick={handleGenerate} disabled={isGenerating || isGeneratingPrompts || !canGenerate || !lyricsPrompt.trim()}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Music
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold font-headline">
              <Library className="h-6 w-6" />
              Your Music Gallery
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Your generated tracks are stored safely in your library.</p>
          </div>
          {tracks.length > 0 && <Badge variant="secondary">{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</Badge>}
        </div>
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed py-16 text-center text-muted-foreground">
            <div className="mb-4 rounded-full bg-muted p-4"><Music2 className="h-8 w-8" /></div>
            <p className="font-medium text-foreground">Your gallery is waiting for its first track</p>
            <p className="mt-1 text-sm">Generated music will appear here and remain stored in your library.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleTracks.map((track, index) => {
              const absoluteIndex = (currentGalleryPage - 1) * TRACKS_PER_PAGE + index;
              return (
              <Card key={track.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="h-1 bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500" />
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary"><Music2 className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm">AI Track {tracks.length - absoluteIndex}</CardTitle>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {formatTrackDate(track.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{track.durationSeconds}s</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 p-3 pt-1">
                  {track.altPrompt && (
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="line-clamp-2 text-xs text-muted-foreground">{track.altPrompt}</p>
                    </div>
                  )}

                  <audio controls preload="metadata" className="w-full" src={track.audioUrl}>
                    Your browser does not support audio playback.
                  </audio>

                  <details className="group rounded-md border px-2.5 py-1.5">
                    <summary className="cursor-pointer select-none text-xs font-medium">View lyrics</summary>
                    <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap border-t pt-2 text-xs leading-relaxed text-muted-foreground">{track.prompt}</p>
                  </details>

                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs" asChild>
                      <a href={track.audioUrl} download={`ai-track-${track.id}`}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
                      <a href={track.audioUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> Open file
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDeleteTrackId(track.id)}
                      disabled={deletingTrackId === track.id}
                    >
                      {deletingTrackId === track.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
            </div>

            {totalGalleryPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGalleryPage((page) => Math.max(1, page - 1))}
                  disabled={currentGalleryPage === 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentGalleryPage} of {totalGalleryPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGalleryPage((page) => Math.min(totalGalleryPages, page + 1))}
                  disabled={currentGalleryPage === totalGalleryPages}
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(pendingDeleteTrackId)} onOpenChange={(open) => !open && !deletingTrackId && setPendingDeleteTrackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this track?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the audio file and its gallery record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingTrackId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteTrack();
              }}
              disabled={Boolean(deletingTrackId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingTrackId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete track
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
