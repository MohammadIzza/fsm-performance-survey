"use server";

import { revalidatePath } from "next/cache";
import { requireActiveActor, requireAdminActor } from "@/lib/authz";
import { reportIssue, resolveIssue } from "@/lib/services/assignmentIssues";
import { ServiceError } from "@/lib/services/units";
import type { IssueStatus, IssueType } from "@/generated/prisma/enums";

export interface FormState {
  error?: string;
}

export async function reportIssueAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActiveActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  try {
    await reportIssue(
      assignmentId,
      String(formData.get("type") ?? "") as IssueType,
      String(formData.get("detail") ?? ""),
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tugas/${assignmentId}`);
  return {};
}

export async function resolveIssueAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const issueId = String(formData.get("issueId") ?? "");
  try {
    await resolveIssue(
      issueId,
      {
        status: String(formData.get("status") ?? "") as IssueStatus,
        resolution: String(formData.get("resolution") ?? ""),
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/masalah");
  return {};
}
