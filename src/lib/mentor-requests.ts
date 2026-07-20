// Why a member is asking to be matched with a mentor. Shared by the request
// form, the admin queue and the notification email.

export const MENTOR_REQUEST_REASONS: { value: string; label: string }[] = [
  { value: "interview_prep", label: "הכנה לראיון עבודה" },
  { value: "first_months", label: "ליווי בחודשי עבודה ראשונים" },
  { value: "professional", label: "מענה לשאלות מקצועיות" },
  { value: "personal", label: "מענה להתלבטויות אישיות" },
];

export function mentorReasonLabel(value: string): string {
  return MENTOR_REQUEST_REASONS.find((r) => r.value === value)?.label ?? value;
}
