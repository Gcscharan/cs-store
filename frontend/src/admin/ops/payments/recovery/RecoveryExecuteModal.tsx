import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import type { RecoveryExecuteAction } from "./types";
import { useLanguage } from "../../../../contexts/LanguageContext";

const CONFIRM_STRING = "YES_I_UNDERSTAND_THIS_CHANGES_STATE";

function ModalShell(props: { title: string; children: ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={props.onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-900">{props.title}</div>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              onClick={props.onClose}
            >
              Close
            </button>
          </div>
          <div className="p-4">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

export default function RecoveryExecuteModal(props: {
  open: boolean;
  paymentIntentId: string;
  action: RecoveryExecuteAction;
  onClose: () => void;
  onConfirm: (args: { reason: string; confirm: string }) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
}): JSX.Element | null {
  const { t } = useLanguage();
  const [reason, setReason] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");

  const canSubmit = useMemo(() => {
    return reason.trim().length >= 15 && confirm === CONFIRM_STRING && !props.isSubmitting;
  }, [confirm, props.isSubmitting, reason]);

  if (!props.open) return null;

  return (
    <ModalShell title={t("admin.confirmRecoveryExecution")} onClose={props.onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
          {t("admin.recoveryExecutionWarning")}
        </div>

        <div className="text-sm text-gray-700">
          <div className="font-medium text-gray-900">{t("admin.action")}</div>
          <div className="mt-1 font-mono text-xs">{props.action}</div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">{t("admin.reasonMin15")}</label>
          <textarea
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("admin.describeWhyExecuting")}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">{t("admin.typeToConfirm")}</label>
          <div className="mt-1 text-xs text-gray-600 font-mono">{CONFIRM_STRING}</div>
          <input
            className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_STRING}
          />
        </div>

        {props.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {props.error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
            onClick={props.onClose}
            disabled={props.isSubmitting}
          >
            {t("ui.cancel")}
          </button>
          <button
            type="button"
            className={
              canSubmit
                ? "rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                : "rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-600 cursor-not-allowed"
            }
            disabled={!canSubmit}
            onClick={async () => {
              await props.onConfirm({ reason: reason.trim(), confirm });
            }}
          >
            {props.isSubmitting ? t("admin.executing") : t("admin.execute")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
