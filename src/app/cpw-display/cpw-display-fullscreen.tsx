"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CPWVoteStatus } from "@prisma/client";
import { Lock, AlertCircle, CheckCircle2, Clock, X } from "lucide-react";

interface SkillVote {
  id: string;
  code: string | null;
  name: string;
  vote: {
    status: CPWVoteStatus;
    comment: string | null;
  } | null;
}

interface CPWDisplayFullscreenProps {
  sessionId: string;
  sessionName: string;
  isLocked: boolean;
  skills: SkillVote[];
}

export function CPWDisplayFullscreen({
  sessionId,
  sessionName,
  isLocked: initialLocked,
  skills: initialSkills,
}: CPWDisplayFullscreenProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillVote[]>(initialSkills);
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [animatingSkills, setAnimatingSkills] = useState<Set<string>>(new Set());
  const [celebratingSkills, setCelebratingSkills] = useState<Set<string>>(new Set());
  const [confettiParticles, setConfettiParticles] = useState<Array<{ id: number; x: number; color: string }>>([]);
  const prevSkillsRef = useRef<SkillVote[]>(initialSkills);
  const confettiIdRef = useRef(0);

  // ESC to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.back();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Trigger confetti
  const triggerConfetti = useCallback(() => {
    const colors = ['#22c55e', '#16a34a', '#4ade80', '#86efac', '#fbbf24', '#f59e0b', '#10b981'];
    const newParticles = Array.from({ length: 100 }, () => ({
      id: confettiIdRef.current++,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setConfettiParticles(prev => [...prev, ...newParticles]);

    // Clean up after animation
    setTimeout(() => {
      setConfettiParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 4000);
  }, []);

  // Polling for updates
  const fetchUpdates = useCallback(async () => {
    try {
      const res = await fetch(`/api/cpw/votes?sessionId=${sessionId}`);
      if (!res.ok) return;

      const data = await res.json();

      // Check for new or changed votes
      const newAnimating = new Set<string>();
      const newCelebrating = new Set<string>();
      let hasNewGreen = false;

      data.skills.forEach((newSkill: SkillVote) => {
        const oldSkill = prevSkillsRef.current.find((s) => s.id === newSkill.id);
        if (
          (!oldSkill?.vote && newSkill.vote) ||
          (oldSkill?.vote?.status !== newSkill.vote?.status)
        ) {
          newAnimating.add(newSkill.id);
          // Check if this is a new green vote
          if (newSkill.vote?.status === CPWVoteStatus.GREEN &&
              oldSkill?.vote?.status !== CPWVoteStatus.GREEN) {
            hasNewGreen = true;
            newCelebrating.add(newSkill.id);
          }
        }
      });

      if (newAnimating.size > 0) {
        setAnimatingSkills(newAnimating);
        setTimeout(() => setAnimatingSkills(new Set()), 2000);
      }

      if (newCelebrating.size > 0) {
        setCelebratingSkills(newCelebrating);
        triggerConfetti();
        setTimeout(() => setCelebratingSkills(new Set()), 2000);
      }

      prevSkillsRef.current = data.skills;
      setSkills(data.skills);
      setIsLocked(data.isLocked);
    } catch (error) {
      console.error("Failed to fetch updates", error);
    }
  }, [sessionId, triggerConfetti]);

  useEffect(() => {
    const interval = setInterval(fetchUpdates, 1500);
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
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 overflow-hidden">
      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
        {confettiParticles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-3 h-3 animate-confetti-fall"
            style={{
              left: `${particle.x}%`,
              backgroundColor: particle.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 right-4 z-50 rounded-full bg-white/80 border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shadow-sm"
        title="Press ESC to close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="WorldSkills Logo"
              width={48}
              height={48}
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{sessionName}</h1>
              <p className="text-sm text-slate-500">CPW Final Verdict</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            {/* Stats */}
            <div className="flex items-center gap-6 text-base">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-green-500 shadow-md shadow-green-500/30" />
                <span className="font-bold text-green-600 text-xl">{greenSkills.length}</span>
                <span className="text-slate-500">On Track</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-red-500 shadow-md shadow-red-500/30" />
                <span className="font-bold text-red-600 text-xl">{redSkills.length}</span>
                <span className="text-slate-500">Issues</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-slate-400" />
                <span className="font-bold text-slate-600 text-xl">{pendingSkills.length}</span>
                <span className="text-slate-500">Pending</span>
              </div>
            </div>

            {/* Lock Status */}
            {isLocked ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-100 border border-amber-200 px-5 py-2.5 text-amber-700">
                <Lock className="h-5 w-5" />
                <span className="font-semibold">Voting Locked</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-green-100 border border-green-200 px-5 py-2.5 text-green-700">
                <Clock className="h-5 w-5 animate-pulse" />
                <span className="font-semibold">Voting Open</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-200">
          <div
            className="h-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="flex h-[calc(100vh-90px)]">
        {/* Skills Grid */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="grid h-full grid-cols-8 gap-2 auto-rows-fr">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isAnimating={animatingSkills.has(skill.id)}
                isCelebrating={celebratingSkills.has(skill.id)}
              />
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 border-l border-slate-200 bg-white/50 p-4 flex flex-col">
          {/* Issues Section */}
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <h2 className="text-xl font-semibold text-slate-900">Issues Raised</h2>
            <span className="ml-auto rounded-full bg-red-100 px-3 py-1 text-base font-semibold text-red-600">
              {redSkills.length}
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
            {redSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CheckCircle2 className="h-16 w-16 mb-4" />
                <p className="text-lg">No issues reported yet</p>
              </div>
            ) : (
              redSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-xl border border-red-200 bg-red-50 p-4 animate-in fade-in slide-in-from-right duration-300"
                >
                  <div className="flex items-center gap-2">
                    {skill.code && (
                      <span className="text-sm font-bold text-red-400">#{skill.code}</span>
                    )}
                    <h3 className="font-semibold text-red-700 text-lg">{skill.name}</h3>
                  </div>
                  {skill.vote?.comment && (
                    <p className="mt-2 text-base text-red-600">{skill.vote.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Awaiting Vote Section */}
          {pendingSkills.length > 0 && pendingSkills.length <= 15 && (
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-700">Awaiting Vote</h2>
                <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-sm font-medium text-slate-600">
                  {pendingSkills.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pendingSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="rounded-lg px-3 py-2 text-base text-slate-600 bg-slate-100 flex items-center gap-2"
                  >
                    {skill.code && (
                      <span className="text-sm font-bold text-slate-400">#{skill.code}</span>
                    )}
                    {skill.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ESC hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm text-slate-400">
        Press ESC to exit fullscreen
      </div>

      {/* CSS for confetti animation */}
      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 3s ease-out forwards;
        }
        @keyframes celebrate-spin {
          0% {
            transform: scale(1) rotateY(0deg);
          }
          50% {
            transform: scale(1.15) rotateY(180deg);
          }
          100% {
            transform: scale(1.1) rotateY(360deg);
          }
        }
        .animate-celebrate {
          animation: celebrate-spin 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function SkillCard({
  skill,
  isAnimating,
  isCelebrating,
}: {
  skill: SkillVote;
  isAnimating: boolean;
  isCelebrating: boolean;
}) {
  const isGreen = skill.vote?.status === CPWVoteStatus.GREEN;
  const isRed = skill.vote?.status === CPWVoteStatus.RED;

  const getStatusStyles = () => {
    if (!skill.vote) {
      return "bg-slate-100 border-slate-300 text-slate-600";
    }
    if (isGreen) {
      return "bg-gradient-to-br from-green-100 to-green-200 border-green-400 text-green-700 shadow-lg shadow-green-200";
    }
    return "bg-gradient-to-br from-red-100 to-red-200 border-red-400 text-red-700 shadow-lg shadow-red-200";
  };

  const getIcon = () => {
    if (!skill.vote) return null;
    if (isGreen) {
      return <CheckCircle2 className="h-[1.5vw] min-h-[16px] max-h-[24px] w-[1.5vw] min-w-[16px] max-w-[24px] text-green-500" />;
    }
    return <AlertCircle className="h-[1.5vw] min-h-[16px] max-h-[24px] w-[1.5vw] min-w-[16px] max-w-[24px] text-red-500" />;
  };

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center rounded-lg border-2 p-1
        transition-all duration-300 ease-out overflow-hidden
        ${getStatusStyles()}
        ${isCelebrating ? "animate-celebrate ring-4 ring-green-400 ring-opacity-75" : ""}
        ${isAnimating && isRed ? "scale-105 ring-4 ring-red-400" : ""}
        ${isAnimating && !skill.vote ? "scale-105 ring-4 ring-blue-400" : ""}
      `}
      title={skill.name}
      style={{
        perspective: '1000px',
      }}
    >
      <div className="absolute top-1 right-1">{getIcon()}</div>

      {/* Skill Code */}
      {skill.code && (
        <span
          className="font-bold opacity-60"
          style={{ fontSize: 'clamp(0.5rem, 0.9vw, 0.75rem)' }}
        >
          #{skill.code}
        </span>
      )}

      {/* Skill Name */}
      <span
        className="font-medium text-center leading-tight px-1"
        style={{
          fontSize: 'clamp(0.45rem, 0.85vw, 0.8rem)',
          wordBreak: 'break-word',
          hyphens: 'auto',
        }}
      >
        {skill.name}
      </span>
    </div>
  );
}
