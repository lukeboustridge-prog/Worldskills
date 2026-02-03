"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSCMQuestionAnswerAction } from "@/app/(dashboard)/settings/scm-questions-actions";

interface Question {
  id: string;
  question: string;
  description: string | null;
  position: number;
}

interface SCMQuestionsModalProps {
  questions: Question[];
}

export function SCMQuestionsModal({ questions }: SCMQuestionsModalProps) {
  const [isOpen, setIsOpen] = useState(questions.length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isPending, startTransition] = useTransition();
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const remainingQuestions = questions.filter((q) => !answeredQuestions.has(q.id));
  const currentQuestion = remainingQuestions[currentIndex];
  const totalRemaining = remainingQuestions.length;

  if (!currentQuestion || totalRemaining === 0) {
    return null;
  }

  const handleSkip = () => {
    setAnswer("");
    setMessage(null);
    if (currentIndex < totalRemaining - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleSubmit = () => {
    if (!answer.trim()) {
      setMessage({ type: "error", text: "Please provide an answer" });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("questionId", currentQuestion.id);
      formData.append("answer", answer);

      try {
        const result = await submitSCMQuestionAnswerAction(formData);
        if (result.success) {
          setMessage({ type: "success", text: "Answer submitted successfully" });
          setAnsweredQuestions((prev) => new Set(prev).add(currentQuestion.id));
          setAnswer("");

          setTimeout(() => {
            setMessage(null);
            if (totalRemaining <= 1) {
              setIsOpen(false);
            } else {
              setCurrentIndex(0);
            }
          }, 1000);
        }
      } catch (error) {
        setMessage({ type: "error", text: "Failed to submit answer. Please try again." });
      }
    });
  };

  const progressText = `Question ${currentIndex + 1} of ${totalRemaining}`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>SCM Questions</DialogTitle>
          <DialogDescription>
            Please answer the following questions. You can skip and return later, but your responses help us improve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{progressText}</span>
            <div className="flex gap-1">
              {remainingQuestions.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-6 rounded-full ${
                    idx === currentIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">{currentQuestion.question}</Label>
            {currentQuestion.description && (
              <p className="text-sm text-muted-foreground">{currentQuestion.description}</p>
            )}
            <Textarea
              placeholder="Enter your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {message && (
            <div
              className={`rounded-md p-3 text-sm ${
                message.type === "success"
                  ? "border border-green-400 bg-green-50 text-green-900"
                  : "border border-red-400 bg-red-50 text-red-900"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleSkip} disabled={isPending}>
            Skip for now
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Submitting..." : "Submit answer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
