"use client";

import { useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkImportUsersAction, type ImportUser, type BulkImportResult } from "./import-actions";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: Role.SA, label: "Skill Advisor" },
  { value: Role.SCM, label: "Skill Competition Manager" },
  { value: Role.Secretariat, label: "Secretariat" }
];

const FIELD_OPTIONS = [
  { value: "", label: "-- Do not import --" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "skillName", label: "Skill Name" }
];

type ColumnMapping = {
  [header: string]: string;
};

export function UserImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [selectedRole, setSelectedRole] = useState<Role>(Role.SCM);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);

    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length < 2) {
          setError("CSV must have at least a header row and one data row.");
          return;
        }

        const headerRow = data[0];
        setHeaders(headerRow);
        setCsvData(data.slice(1).filter((row) => row.some((cell) => cell.trim())));

        // Auto-detect column mapping based on header names
        const autoMapping: ColumnMapping = {};
        headerRow.forEach((header) => {
          const lowerHeader = header.toLowerCase().trim();
          if (lowerHeader.includes("name") && !lowerHeader.includes("skill")) {
            autoMapping[header] = "name";
          } else if (lowerHeader.includes("email")) {
            autoMapping[header] = "email";
          } else if (lowerHeader.includes("skill")) {
            autoMapping[header] = "skillName";
          }
        });
        setColumnMapping(autoMapping);
      },
      error: (parseError) => {
        setError(`Failed to parse CSV: ${parseError.message}`);
      }
    });
  };

  const handleMappingChange = (header: string, field: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [header]: field
    }));
  };

  const handleImport = () => {
    if (!csvData || !headers.length) {
      setError("No data to import.");
      return;
    }

    // Find which columns are mapped to which fields
    const nameIndex = headers.findIndex((h) => columnMapping[h] === "name");
    const emailIndex = headers.findIndex((h) => columnMapping[h] === "email");
    const skillNameIndex = headers.findIndex((h) => columnMapping[h] === "skillName");

    if (emailIndex === -1) {
      setError("You must map a column to Email.");
      return;
    }

    if (nameIndex === -1) {
      setError("You must map a column to Name.");
      return;
    }

    // Build the users array
    const users = csvData
      .map((row) => {
        const email = row[emailIndex]?.trim() ?? "";
        const name = row[nameIndex]?.trim() ?? "";
        const skillName = skillNameIndex >= 0 ? row[skillNameIndex]?.trim() : undefined;

        if (!email || !name) return null;

        return {
          name,
          email,
          skillName: skillName || undefined
        };
      })
      .filter((user): user is ImportUser => user !== null);

    if (users.length === 0) {
      setError("No valid users found in the CSV.");
      return;
    }

    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const importResult = await bulkImportUsersAction(users, selectedRole);
        setResult(importResult);

        if (importResult.success) {
          // Clear the form on success
          setCsvData(null);
          setHeaders([]);
          setColumnMapping({});
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  };

  const handleReset = () => {
    setCsvData(null);
    setHeaders([]);
    setColumnMapping({});
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const previewUsers = csvData?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <div className="space-y-2">
        <Label htmlFor="csv-file">Upload CSV File</Label>
        <Input
          ref={fileInputRef}
          id="csv-file"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">
          Upload a CSV file with user data. The first row should contain column headers.
        </p>
      </div>

      {/* Column Mapping */}
      {headers.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium">Column Mapping</h4>
            <p className="text-xs text-muted-foreground">
              Map CSV columns to user fields. Name and Email are required.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {headers.map((header) => (
              <div key={header} className="space-y-1">
                <Label htmlFor={`mapping-${header}`} className="text-xs">
                  {header}
                </Label>
                <select
                  id={`mapping-${header}`}
                  value={columnMapping[header] ?? ""}
                  onChange={(e) => handleMappingChange(header, e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {FIELD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Role Selection */}
      {headers.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="role-select">Role to Assign</Label>
          <select
            id="role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            All imported users will be assigned this role. If a Skill Name is mapped and matched, the user will be linked as the {selectedRole === Role.SA ? "Skill Advisor" : selectedRole === Role.SCM ? "Skill Competition Manager" : "assigned role"} for that skill.
          </p>
        </div>
      ) : null}

      {/* Preview */}
      {previewUsers.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Preview (first 5 rows)</h4>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-3 py-2 text-left font-medium">
                      {header}
                      {columnMapping[header] ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          → {columnMapping[header]}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewUsers.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvData && csvData.length > 5 ? (
            <p className="text-xs text-muted-foreground">
              ...and {csvData.length - 5} more rows
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Error Display */}
      {error ? (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Result Display */}
      {result ? (
        <div
          className={`rounded-md border p-4 text-sm ${
            result.success && result.errors.length === 0
              ? "border-green-400 bg-green-50 text-green-900"
              : result.errors.length > 0
                ? "border-amber-400 bg-amber-50 text-amber-900"
                : "border-destructive/60 bg-destructive/10 text-destructive"
          }`}
        >
          <p className="font-medium">Import Complete</p>
          <ul className="mt-2 space-y-1">
            <li>Created: {result.created} new users</li>
            <li>Updated: {result.updated} existing users</li>
            <li>Linked: {result.linked} users to skills</li>
            <li>Emails sent: {result.emailsSent}</li>
          </ul>
          {result.errors.length > 0 ? (
            <div className="mt-3">
              <p className="font-medium">Warnings:</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-xs">
                {result.errors.slice(0, 10).map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
                {result.errors.length > 10 ? (
                  <li>...and {result.errors.length - 10} more warnings</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      {headers.length > 0 ? (
        <div className="flex gap-3">
          <Button onClick={handleImport} disabled={isPending}>
            {isPending ? "Importing..." : "Import Users"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isPending}>
            Reset
          </Button>
        </div>
      ) : null}
    </div>
  );
}
