"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui";
import { toggleQuestionActive } from "@/app/(admin)/admin/actions";

export function QuestionToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();

  return (
    <Switch
      checked={on}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        setOn(next);
        start(() => void toggleQuestionActive(id, next));
      }}
    />
  );
}
