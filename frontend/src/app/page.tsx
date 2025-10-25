"use client";

import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimePolls } from "@/hooks/use-realtime-polls";
import type { Poll } from "@/types/poll";

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const DEFAULT_WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE_URL ?? deriveWebsocketBase(process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE);

const MAX_OPTIONS = 6;

type BannerState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

export default function Home() {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [optionInputs, setOptionInputs] = useState<string[]>(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  const [pendingPollActions, setPendingPollActions] = useState<Record<number, boolean>>({});

  const { polls, loading, error, refresh } = useRealtimePolls({
    apiBase: DEFAULT_API_BASE,
    wsBase: DEFAULT_WS_BASE,
  });

  const totalPolls = polls.length;

  const resetForm = useCallback(() => {
    setQuestion("");
    setDescription("");
    setOptionInputs(["", ""]);
  }, []);

  const handleAddOption = () => {
    if (optionInputs.length >= MAX_OPTIONS) {
      return;
    }
    setOptionInputs((current) => [...current, ""]);
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptionInputs((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveOption = (index: number) => {
    if (optionInputs.length <= 2) return;
    setOptionInputs((current) => current.filter((_, idx) => idx !== index));
  };

  const handleCreatePoll = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    const normalizedOptions = optionInputs.map((option) => option.trim()).filter(Boolean);
    const uniqueOptions = Array.from(new Set(normalizedOptions));

    if (!trimmedQuestion) {
      setFormError("A question is required.");
      return;
    }

    if (uniqueOptions.length < 2) {
      setFormError("Provide at least two unique options.");
      return;
    }

    setFormError(null);
    setBanner(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${DEFAULT_API_BASE}/polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          description: description.trim() || undefined,
          options: uniqueOptions,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Failed to create poll. Please try again.");
      }

      resetForm();
      setBanner({ type: "success", message: "Poll created successfully!" });

      // Ensure we have the latest state in case the websocket event is delayed.
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unexpected error creating poll.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePollPending = useCallback((pollId: number, pending: boolean) => {
    setPendingPollActions((current) => {
      const next = { ...current };
      if (pending) {
        next[pollId] = true;
      } else {
        delete next[pollId];
      }
      return next;
    });
  }, []);

  const handleVote = async (pollId: number, optionId: number) => {
    setBanner(null);
    togglePollPending(pollId, true);
    try {
      const response = await fetch(`${DEFAULT_API_BASE}/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: optionId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Failed to record vote.");
      }
    } catch (err) {
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Voting failed. Please retry.",
      });
      // fallback to latest data
      await refresh();
    } finally {
      togglePollPending(pollId, false);
    }
  };

  const handleLike = async (pollId: number) => {
    setBanner(null);
    togglePollPending(pollId, true);
    try {
      const response = await fetch(`${DEFAULT_API_BASE}/polls/${pollId}/like`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail ?? "Failed to register like.");
      }
    } catch (err) {
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Could not like the poll.",
      });
      await refresh();
    } finally {
      togglePollPending(pollId, false);
    }
  };

  return (
    <main className="container mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10">
      <section className="space-y-6">
        <header className="space-y-2">
          <Badge variant="secondary" className="uppercase tracking-wide">
            QuickPoll
          </Badge>
          <h1 className="text-3xl font-semibold sm:text-4xl">Real-time opinion polling</h1>
          <p className="max-w-2xl text-muted-foreground">
            Create polls, collect votes, and watch results update live as people interact. QuickPoll
            is optimized for fast experiments, interactive presentations, and product feedback loops.
          </p>
        </header>

        {banner && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              banner.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {banner.message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Create a poll</CardTitle>
            <CardDescription>
              Craft a question and add up to {MAX_OPTIONS} options. All interactions sync instantly
              with every connected client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleCreatePoll}>
              <div className="space-y-2">
                <Label htmlFor="question">Poll question</Label>
                <Input
                  id="question"
                  placeholder="What should we build next?"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Optional context <span className="text-muted-foreground">(max 240 chars)</span>
                </Label>
                <Textarea
                  id="description"
                  maxLength={240}
                  placeholder="Provide more details so voters can make an informed choice."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Options</Label>
                <div className="space-y-2">
                  {optionInputs.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={value}
                        onChange={(event) => handleOptionChange(index, event.target.value)}
                        required={index < 2}
                      />
                      {optionInputs.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleRemoveOption(index)}
                          aria-label={`Remove option ${index + 1}`}
                        >
                          -
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddOption}
                  disabled={optionInputs.length >= MAX_OPTIONS}
                >
                  Add another option
                </Button>

                {formError && <p className="text-sm text-destructive">{formError}</p>}
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{optionInputs.length} options configured</span>
                <span>{MAX_OPTIONS - optionInputs.length} remaining</span>
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Launch poll"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Live polls</h2>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading the latest results…"
                : totalPolls === 0
                ? "Create your first poll to see it here."
                : "Votes update the moment they happen."}
            </p>
          </div>
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <Card key={item} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {[0, 1, 2].map((option) => (
                    <div key={option} className="h-10 rounded-md bg-muted" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && totalPolls === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No polls yet — launch one above to get started.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              pending={Boolean(pendingPollActions[poll.id])}
              onVote={handleVote}
              onLike={handleLike}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function PollCard({
  poll,
  pending,
  onVote,
  onLike,
}: {
  poll: Poll;
  pending: boolean;
  onVote: (pollId: number, optionId: number) => Promise<void>;
  onLike: (pollId: number) => Promise<void>;
}) {
  const totalVotes = useMemo(
    () => poll.options.reduce((sum, option) => sum + option.votes, 0),
    [poll.options],
  );

  const createdRelative = useMemo(() => formatRelativeTime(poll.created_at), [poll.created_at]);

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-lg">
      <CardHeader className="space-y-2 bg-card/60">
        <CardTitle>{poll.question}</CardTitle>
        {poll.description && <CardDescription>{poll.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{totalVotes} total votes</Badge>
          <span>Created {createdRelative}</span>
        </div>

        <div className="space-y-2">
          {poll.options.map((option) => {
            const percentage = totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100);
            return (
              <button
                key={option.id}
                onClick={() => onVote(poll.id, option.id)}
                disabled={pending}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="font-medium">{option.text}</span>
                <span className="text-sm text-muted-foreground">
                  {option.votes} votes · {percentage}%
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between bg-muted/30">
        <Button
          variant="ghost"
          onClick={() => onLike(poll.id)}
          disabled={pending}
          className="gap-2"
        >
          <span aria-hidden>👍</span>
          {poll.likes}
          <span className="sr-only">Like poll</span>
        </Button>

        <span className="text-xs text-muted-foreground">#{poll.id}</span>
      </CardFooter>
    </Card>
  );
}

function deriveWebsocketBase(apiBase: string): string {
  if (apiBase.startsWith("https://")) {
    return `wss://${apiBase.slice("https://".length)}`.replace(/\/$/, "");
  }
  if (apiBase.startsWith("http://")) {
    return `ws://${apiBase.slice("http://".length)}`.replace(/\/$/, "");
  }
  return apiBase.replace(/\/$/, "");
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffInSeconds);

  const units: { threshold: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { threshold: 60, divisor: 1, unit: "second" },
    { threshold: 3600, divisor: 60, unit: "minute" },
    { threshold: 86400, divisor: 3600, unit: "hour" },
    { threshold: 604800, divisor: 86400, unit: "day" },
    { threshold: 2629800, divisor: 604800, unit: "week" },
    { threshold: 31557600, divisor: 2629800, unit: "month" },
    { threshold: Infinity, divisor: 31557600, unit: "year" },
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const { threshold, divisor, unit } of units) {
    if (abs < threshold) {
      const value = Math.round(diffInSeconds / divisor);
      return formatter.format(value, unit);
    }
  }

  return formatter.format(0, "second");
}
