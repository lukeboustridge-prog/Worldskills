"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SKILL_CATALOG, type SkillCatalogEntry } from "@/lib/skill-catalog";

const skillOptions = SKILL_CATALOG.map((skill) => ({
  value: skill.id,
  label: `Skill ${skill.code} - ${skill.name}`,
  sector: skill.sector
}));

const skillById = new Map<string, SkillCatalogEntry>(
  SKILL_CATALOG.map((skill) => [skill.id, skill])
);

interface SkillCatalogFieldProps {
  disabled?: boolean;
  usedSkillIds?: string[];
}

export function SkillCatalogField({ disabled = false, usedSkillIds = [] }: SkillCatalogFieldProps) {
  const [selectedId, setSelectedId] = useState("");
  const selectedSkill = selectedId ? skillById.get(selectedId) ?? null : null;
  const usedSet = new Set(usedSkillIds);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="skill-name">Skill</Label>
        <select
          id="skill-name"
          name="skillCatalogId"
          required
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={disabled}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Select skill
          </option>
          {skillOptions.map((skill) => {
            const isUsed = usedSet.has(skill.value);
            return (
              <option key={skill.value} value={skill.value} disabled={isUsed}>
                {isUsed ? `${skill.label} (already created)` : skill.label}
              </option>
            );
          })}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="skill-sector">Sector</Label>
        <Input
          id="skill-sector"
          value={selectedSkill?.sector ?? ""}
          readOnly
          disabled={disabled}
          placeholder="Select a skill to see its sector"
        />
      </div>
    </>
  );
}
