"use client";

import { useEffect, useState, useCallback } from "react";
import { CPWVoteStatus } from "@prisma/client";
import { Lock, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface SkillVote {
  id: string;
  name: string;
  vote: {
    status: CPWVoteStatus;
    comment: string | null;
  } | null;
}

interface CPWDisplayProps {
  sessionId: string;
  sessionName: string;
  isLocked: boolean;
  skills: SkillVote[];
}

export function CPWDisplay({
  sessionId,
  sessionName,
  isLocked: initialLocked,
  skills: initialSkills,
}: CPWDisplayProps) {
  const [skills, setSkills] = useState<SkillVote[]>(initialSkills);
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [animatingSkills, setAnimatingSkills] = useState<Set<string>>(new Set());

  // Polling for updates
  const fetchUpdates = useCallback(async () => {
    try {
      const res = await fetch(`/api/cpw/votes?sessionId=${sessionId}`);
      if (!res.ok) return;

      const data = await res.json();

      // Check for new or changed votes
      const newAnimating = new Set<string>();
      data.skills.forEach((newSkill: SkillVote) => {
        const oldSkill = skills.find((s) => s.id === newSkill.id);
        if (
          (!oldSkill?.vote && newSkill.vote) ||
          (oldSkill?.vote?.status !== newSkill.vote?.status)
        ) {
          newAnimating.add(newSkill.id);
        }
      });

      if (newAnimating.size > 0) {
        setAnimatingSkills(newAnimating);
        setTimeout(() => setAnimatingSkills(new Set()), 1000);
      }

      setSkills(data.skills);
      setIsLocked(data.isLocked);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch updates", error);
    }
  }, [sessionId, skills]);

  useEffect(() => {
    const interval = setInterval(fetchUpdates, 2000);
    return () => clearInterval(interval);
  }, [fetchUpdates]);

  // Calculate stats
  const totalSkills = skills.length;
  const votedSkills = skills.filter((s) => s.vote !== null).length;
  const greenSkills = skills.filter((s) => s.vote?.status === CPWVoteStatus.GREEN);
  const redSkills = skills.filter((s) => s.vote?.status === CPWVoteStatus.RED);
  const pendingSkills = skills.filter((s) => s.vote === null);
  const progress = totalSkills > 0 ? (votedSkills / totalSkills) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{sessionName}</h1>
            <p className="text-sm text-slate-400">CPW Final Verdict</p>
          </div>
          <div className="flex items-center gap-6">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="font-semibold text-green-400">{greenSkills.length}</span>
                <span className="text-slate-400">On Track</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="font-semibold text-red-400">{redSkills.length}</span>
                <span className="text-slate-400">Issues</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-600" />
                <span className="font-semibold text-slate-300">{pendingSkills.length}</span>
                <span className="text-slate-400">Pending</span>
              </div>
            </div>

            {/* Lock Status */}
            {isLocked ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-2 text-amber-400">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Voting Locked</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-4 py-2 text-green-400">
                <Clock className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-medium">Voting Open</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="flex h-[calc(100vh-88px)]">
        {/* Skills Grid */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="grid h-full grid-cols-8 gap-2">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isAnimating={animatingSkills.has(skill.id)}
              />
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 border-l border-slate-800 bg-slate-900/50 p-4 flex flex-col">
          {/* Issues Section */}
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold">Issues Raised</h2>
            <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-sm font-medium text-red-400">
              {redSkills.length}
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
            {redSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <CheckCircle2 className="h-10 w-10 mb-2" />
                <p className="text-sm">No issues reported yet</p>
              </div>
            ) : (
              redSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 animate-in fade-in slide-in-from-right duration-300"
                >
                  <h3 className="font-semibold text-red-400">{skill.name}</h3>
                  {skill.vote?.comment && (
                    <p className="mt-1 text-sm text-slate-300">{skill.vote.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Awaiting Vote Section - shows when < 15 pending */}
          {pendingSkills.length > 0 && pendingSkills.length <= 15 && (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-slate-400" />
                <h2 className="text-lg font-semibold">Awaiting Vote</h2>
                <span className="ml-auto rounded-full bg-slate-600/50 px-2 py-0.5 text-sm font-medium text-slate-300">
                  {pendingSkills.length}
                </span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {pendingSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="rounded px-2 py-1 text-sm text-slate-400 bg-slate-800/50"
                  >
                    {skill.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  isAnimating,
}: {
  skill: SkillVote;
  isAnimating: boolean;
}) {
  const getStatusStyles = () => {
    if (!skill.vote) {
      return "bg-slate-800/50 border-slate-700 text-slate-400";
    }
    if (skill.vote.status === CPWVoteStatus.GREEN) {
      return "bg-green-500/20 border-green-500/50 text-green-400 shadow-lg shadow-green-500/20";
    }
    return "bg-red-500/20 border-red-500/50 text-red-400 shadow-lg shadow-red-500/20";
  };

  const getIcon = () => {
    if (!skill.vote) return null;
    if (skill.vote.status === CPWVoteStatus.GREEN) {
      return <CheckCircle2 className="h-4 w-4" />;
    }
    return <AlertCircle className="h-4 w-4" />;
  };

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center rounded-lg border p-2
        transition-all duration-300 ease-out
        ${getStatusStyles()}
        ${isAnimating ? "scale-110 animate-pulse" : ""}
      `}
      title={skill.name}
    >
      <div className="absolute top-1 right-1">{getIcon()}</div>
      <span className="text-xs font-medium text-center line-clamp-2 leading-tight">
        {skill.name.length > 15 ? skill.name.substring(0, 15) + "..." : skill.name}
      </span>
    </div>
  );
}
