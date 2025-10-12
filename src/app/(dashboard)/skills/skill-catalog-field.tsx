"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SKILL_CATALOG, type SkillCatalogEntry } from "@/lib/skill-catalog";

const skillOptions = SKILL_CATALOG.map((skill) => ({
  value: skill.name,
  label: `Skill ${skill.code} - ${skill.name}`,
  sector: skill.sector
}));

const skillByName = new Map<string, SkillCatalogEntry>(
  SKILL_CATALOG.map((skill) => [skill.name, skill])
);

export function SkillCatalogField() {
  const [selectedName, setSelectedName] = useState("");
  const selectedSkill = selectedName ? skillByName.get(selectedName) ?? null : null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="skill-name">Skill</Label>
        <select
          id="skill-name"
          name="name"
          required
          value={selectedName}
          onChange={(event) => setSelectedName(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Select skill
          </option>
          {skillOptions.map((skill) => (
            <option key={skill.value} value={skill.value}>
              {skill.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="skill-sector">Sector</Label>
        <Input
          id="skill-sector"
          value={selectedSkill?.sector ?? ""}
          readOnly
          placeholder="Select a skill to see its sector"
        />
        <input type="hidden" name="skillSector" value={selectedSkill?.sector ?? ""} />
      </div>
    </>
  );
}
