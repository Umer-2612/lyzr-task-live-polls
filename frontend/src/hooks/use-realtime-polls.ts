"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Poll } from "@/types/poll";

interface UseRealtimePollsArgs {
  apiBase: string;
  wsBase: string;
}

interface UseRealtimePollsState {
  polls: Poll[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

type PollEvent =
  | { type: "poll_snapshot"; polls: Poll[] }
  | { type: "poll_created"; poll: Poll }
  | { type: "poll_updated"; poll: Poll };

export function useRealtimePolls({ apiBase, wsBase }: UseRealtimePollsArgs): UseRealtimePollsState {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const listEndpoint = useMemo(() => `${apiBase}/polls`, [apiBase]);
  const websocketUrl = useMemo(() => {
    const normalized = wsBase.endsWith("/") ? wsBase.slice(0, -1) : wsBase;
    return `${normalized}/ws`;
  }, [wsBase]);

  const applyEvent = useCallback((event: PollEvent) => {
    setPolls((current) => {
      switch (event.type) {
        case "poll_snapshot":
          return event.polls.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        case "poll_created": {
          const withoutDupes = current.filter((poll) => poll.id !== event.poll.id);
          return [event.poll, ...withoutDupes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        }
        case "poll_updated":
          return current
            .map((poll) => (poll.id === event.poll.id ? event.poll : poll))
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        default:
          return current;
      }
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(listEndpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load polls");
      }
      const data = (await response.json()) as Poll[];
      setPolls(data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load polls");
    } finally {
      setLoading(false);
    }
  }, [listEndpoint]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;

    const connect = () => {
      if (!active) {
        return;
      }

      try {
        socketRef.current = new WebSocket(websocketUrl);
      } catch (err) {
        setError("Unable to connect to real-time updates.");
        return;
      }

      const socket = socketRef.current;

      socket.onopen = () => {
        setError(null);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as PollEvent;
          applyEvent(payload);
        } catch {
          // Ignore malformed events
        }
      };

      socket.onerror = () => {
        setError("Real-time connection error.");
      };

      socket.onclose = () => {
        if (!active) {
          return;
        }
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, 2000);
      };
    };

    connect();

    return () => {
      active = false;
      socketRef.current?.close();
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [applyEvent, websocketUrl]);

  return { polls, loading, error, refresh };
}
