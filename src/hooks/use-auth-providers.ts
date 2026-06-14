"use client";

import { useEffect, useState } from "react";

type AuthProvidersState = {
  loading: boolean;
  googleEnabled: boolean;
  githubEnabled: boolean;
  hasAnyProvider: boolean;
};

export function useAuthProviders(): AuthProvidersState {
  const [providerIds, setProviderIds] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, unknown>) => {
        if (!cancelled) {
          setProviderIds(Object.keys(data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviderIds([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading: providerIds === null,
    googleEnabled: providerIds?.includes("google") ?? false,
    githubEnabled: providerIds?.includes("github") ?? false,
    hasAnyProvider: (providerIds?.length ?? 0) > 0,
  };
}
