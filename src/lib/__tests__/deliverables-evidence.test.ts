import { describe, expect, it } from "vitest";

import {
  createDocumentEvidenceRecord,
  findDocumentEvidence,
  isRetryableDocumentUploadError,
  removeDocumentEvidenceItem,
  upsertDocumentEvidenceItem,
  validateDocumentEvidenceInput
} from "@/lib/deliverables";
import { canViewSkill } from "@/lib/permissions";
import type { DeliverableEvidenceItem } from "@/lib/deliverables";
import { Role } from "@prisma/client";

describe("document evidence helpers", () => {
  it("returns null when no document evidence exists", () => {
    expect(findDocumentEvidence([])).toBeNull();
  });

  it("creates a new document entry when uploading for the first time", () => {
    const record = createDocumentEvidenceRecord({
      storageKey: "deliverables/skill/deliverable/file.pdf",
      fileName: "plan.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      checksum: "ZmFrZS1oYXNo"
    });

    const { items, removed } = upsertDocumentEvidenceItem({ items: [], next: record });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ fileName: "plan.pdf", storageKey: record.storageKey });
    expect(removed).toBeNull();
  });

  it("rejects uploads with unsupported mime types", () => {
    expect(() =>
      validateDocumentEvidenceInput({ mimeType: "text/plain", fileSize: 1024 })
    ).toThrow(/isn't supported/);
  });

  it("rejects uploads that exceed the size limit", () => {
    expect(() =>
      validateDocumentEvidenceInput({ mimeType: "application/pdf", fileSize: 30 * 1024 * 1024 })
    ).toThrow(/larger than the maximum/);
  });

  it("flags network errors as retryable", () => {
    const networkError = new TypeError("NetworkError when attempting to fetch resource.");
    expect(isRetryableDocumentUploadError(networkError)).toBe(true);
  });

  it("replaces an existing document and reports the removed entry", () => {
    const original = createDocumentEvidenceRecord({
      storageKey: "deliverables/skill/deliverable/original.pdf",
      fileName: "original.pdf",
      fileSize: 512,
      mimeType: "application/pdf",
      checksum: "YWJj"
    });

    const replacement = createDocumentEvidenceRecord({
      storageKey: "deliverables/skill/deliverable/replacement.pdf",
      fileName: "replacement.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      checksum: "ZGVm"
    });

    const { items, removed } = upsertDocumentEvidenceItem({
      items: [original],
      next: replacement,
      replaceId: original.id
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ fileName: "replacement.pdf" });
    expect(removed?.fileName).toBe("original.pdf");
  });

  it("does not mutate the original evidence array so callers can roll back on failure", () => {
    const original = createDocumentEvidenceRecord({
      storageKey: "deliverables/skill/deliverable/original.pdf",
      fileName: "original.pdf",
      fileSize: 512,
      mimeType: "application/pdf",
      checksum: "YWJj"
    });

    const before: DeliverableEvidenceItem[] = [original];
    const copy = [...before];

    upsertDocumentEvidenceItem({ items: before, next: createDocumentEvidenceRecord({
      storageKey: "deliverables/skill/deliverable/replacement.pdf",
      fileName: "replacement.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      checksum: "ZGVm"
    }), replaceId: original.id });

    expect(before).toEqual(copy);
  });

  it("removes a document evidence entry and returns the removed metadata", () => {
    const document = createDocumentEvidenceRecord({
      storageKey: "deliverables/skill/deliverable/doc.pdf",
      fileName: "doc.pdf",
      fileSize: 512,
      mimeType: "application/pdf",
      checksum: "YWJj"
    });

    const { items, removed } = removeDocumentEvidenceItem({ items: [document], evidenceId: document.id });
    expect(items).toHaveLength(0);
    expect(removed?.storageKey).toBe(document.storageKey);
  });

  it("blocks downloads for users without access to the skill", () => {
    const user = { id: "user-1", isAdmin: false, role: Role.SA };
    const skill = { saId: "user-2", scmId: "user-3" };

    expect(canViewSkill(user, skill)).toBe(false);
  });
});
