"use client";

import { useSession } from "@/app/providers";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import toast from "react-hot-toast";
import {
  Settings as SettingsIcon,
  User,
  Code,
  RefreshCw,
  AlertTriangle,
  Palette,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { getCfRankColor, getRatingColor, formatDate } from "@/lib/utils";

interface CfProfile {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string;
  maxRank: string;
  avatar: string | null;
}

interface CfStats {
  solvedCount: number;
  contestsParticipated: number;
  lastSync: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [handle, setHandle] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<CfProfile | null>(null);
  const [stats, setStats] = useState<CfStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSync, setNeedsSync] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchProfile();
  }, [session]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/cf/analysis");
      if (res.status === 404) {
        setNeedsSync(true);
        return;
      }
      const json = await res.json();
      setProfile(json.profile);
      setStats({
        solvedCount: json.stats.solvedCount,
        contestsParticipated: json.stats.contestsParticipated,
        lastSync: null, // analysis endpoint doesn't return lastSync; we get it from sync response
      });
      setNeedsSync(false);
    } catch {
      setNeedsSync(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    const cfHandle = handle.trim();
    if (!cfHandle) {
      toast.error("Enter your Codeforces handle");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/cf/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cfHandle }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      const data = await res.json();
      toast.success("Codeforces data synced!");
      setProfile(data.profile);
      setStats({
        solvedCount: data.submissionsCount ?? 0,
        contestsParticipated: data.contestsCount ?? 0,
        lastSync: data.profile?.lastSync ?? null,
      });
      setNeedsSync(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleResync() {
    if (!profile) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/cf/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: profile.handle }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Re-sync failed");
      }
      const data = await res.json();
      toast.success("Codeforces data re-synced!");
      setProfile(data.profile);
      setStats({
        solvedCount: data.submissionsCount ?? 0,
        contestsParticipated: data.contestsCount ?? 0,
        lastSync: data.profile?.lastSync ?? null,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteAllData() {
    const confirmed = window.confirm(
      "Are you sure you want to delete all your Codeforces data?\n\n" +
        "This will remove your profile, submissions, contest history, and tag statistics. " +
        "This action cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/cf/sync", { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete data");
      }
      toast.success("All Codeforces data deleted");
      setProfile(null);
      setStats(null);
      setNeedsSync(true);
      setHandle("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please sign in to manage your settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Manage your Codeforces connection, preferences, and data.
        </p>
      </div>

      {/* Profile section */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-blue-500" />
          Account
        </h2>
        <div className="flex items-center gap-4">
          {session.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              className="w-14 h-14 rounded-full"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <User className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {session.user?.name ?? "User"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {session.user?.email ?? ""}
            </p>
          </div>
        </div>
      </section>

      {/* Codeforces section */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Code className="w-5 h-5 text-blue-500" />
          Codeforces
        </h2>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ) : needsSync || !profile ? (
          // Sync form
          <div className="text-center py-4">
            <Code className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Connect your Codeforces handle to get started.
            </p>
            <div className="flex gap-3 max-w-md mx-auto">
              <input
                type="text"
                placeholder="Your Codeforces handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="input-field flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSync()}
              />
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-primary"
              >
                {syncing ? "Syncing..." : "Sync"}
              </button>
            </div>
          </div>
        ) : (
          // Profile card
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {profile.avatar && (
                <img
                  src={profile.avatar}
                  alt={profile.handle}
                  className="w-14 h-14 rounded-full"
                />
              )}
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {profile.handle}
                </p>
                <p className={`font-semibold ${getCfRankColor(profile.rank)}`}>
                  {profile.rank}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p
                  className={`text-2xl font-bold ${getRatingColor(profile.rating)}`}
                >
                  {profile.rating}
                </p>
                <p className="text-xs text-gray-500">
                  Max: {profile.maxRating} ({profile.maxRank})
                </p>
              </div>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {stats.solvedCount}
                  </p>
                  <p className="text-xs text-gray-500">Problems Solved</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {stats.contestsParticipated}
                  </p>
                  <p className="text-xs text-gray-500">Contests</p>
                </div>
              </div>
            )}

            {/* Re-sync button */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleResync}
                disabled={syncing}
                className="btn-secondary"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Re-syncing..." : "Re-sync Codeforces Data"}
              </button>
              {stats?.lastSync && (
                <span className="text-xs text-gray-400">
                  Last synced: {formatDate(stats.lastSync)}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Jiangly Solution Finder section */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
          <ExternalLink className="w-5 h-5 text-purple-500" />
          Jiangly Solution Finder
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Search for solutions to Codeforces problems solved by the legendary
          competitive programmer{" "}
          <a
            href="https://codeforces.com/profile/jiangly"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            jiangly
          </a>
          . This feature scans recent Codeforces submissions to find solutions
          matching the problem you&apos;re working on, so you can study how a
          top-tier coder approached it.
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            How it works:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>
              Enter a problem ID (e.g.{" "}
              <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">
                2050B
              </code>
              )
            </li>
            <li>The system fetches jiangly&apos;s solution to that problem</li>
            <li>View the exact code he submitted with syntax highlighting</li>
            <li>Use it as a reference after attempting the problem yourself</li>
          </ul>
          <a
            href="/problems"
            className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium mt-2"
          >
            Go to Problem Finder
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Theme section */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-purple-500" />
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Theme
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Switch between light and dark mode
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme("light")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mounted && theme === "light"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mounted && theme === "dark"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Dark
            </button>
          </div>
        </div>
      </section>

      {/* Danger Zone section */}
      <section className="card p-6 border-red-200 dark:border-red-900/50">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Irreversible actions that will remove your data from our servers.
        </p>
        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Delete all Codeforces data
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Removes your CF profile, submissions, contests, and tag
              statistics.
            </p>
          </div>
          <button
            onClick={handleDeleteAllData}
            disabled={deleting || needsSync}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-150 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting..." : "Delete all data"}
          </button>
        </div>
      </section>
    </div>
  );
}
