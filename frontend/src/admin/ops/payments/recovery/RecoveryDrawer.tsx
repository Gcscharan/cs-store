import type { ReactNode } from "react";
import type { PaymentsReconciliationItem, PaymentsRecoveryRowEnrichment } from "./types";
import { formatIsoDate, maskId } from "./utils";
import { useLanguage } from "../../../../contexts/LanguageContext";

function Section(props: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      </div>
      <div className="px-4 py-3">{props.children}</div>
    </div>
  );
}

function Field(props: { label: string; value?: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-xs font-medium text-gray-600">{props.label}</div>
      <div className="text-xs text-gray-900 text-right break-all">{props.value ?? "—"}</div>
    </div>
  );
}

export default function RecoveryDrawer(props: {
  open: boolean;
  onClose: () => void;
  item?: PaymentsReconciliationItem;
  enrichment?: PaymentsRecoveryRowEnrichment;
  loading?: boolean;
  canExecuteSuggestedAction?: boolean;
  onExecuteSuggestedAction?: () => void;
  lastAuditId?: string;
}): JSX.Element | null {
  const { t } = useLanguage();
  if (!props.open) return null;

  const item = props.item;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={props.onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-gray-50 shadow-xl border-l border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div>
            <div className="text-sm font-semibold text-gray-900">{t("admin.paymentRecoverySuggestion")}</div>
            <div className="mt-0.5 text-xs text-gray-600 font-mono">
              {item ? maskId(item.paymentIntentId) : ""}
            </div>
          </div>
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            onClick={props.onClose}
          >
            {t("ui.close")}
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-auto h-full">
          {props.loading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">{t("admin.loadingDetails")}</div>
          ) : null}

          <Section title={t("admin.orderSummary")}>
            <Field label={t("admin.orderId")} value={item ? <span className="font-mono">{maskId(item.orderId)}</span> : "—"} />
            <Field label={t("admin.orderPaymentStatus")} value={item?.orderPaymentStatus ? String(item.orderPaymentStatus) : "—"} />
          </Section>

          <Section title={t("admin.paymentIntentSnapshot")}>
            <Field label={t("admin.paymentIntentId")} value={item ? <span className="font-mono">{maskId(item.paymentIntentId)}</span> : "—"} />
            <Field label={t("admin.gateway")} value={item?.gateway} />
            <Field label={t("admin.intentStatus")} value={item?.status ? String(item.status) : "—"} />
            <Field label={t("admin.locked")} value={item ? (item.isLocked ? t("common.yes") : t("common.no")) : "—"} />
            <Field label={t("admin.lockReason")} value={item?.lockReason} />
            <Field label={t("admin.createdAt")} value={item?.createdAt ? formatIsoDate(item.createdAt) : "—"} />
            <Field label={t("admin.updatedAt")} value={item?.updatedAt ? formatIsoDate(item.updatedAt) : "—"} />
            <Field label={t("admin.lastScanned")} value={item?.lastScannedAt ? formatIsoDate(item.lastScannedAt) : "—"} />
          </Section>

          <Section title={t("admin.gatewayVerification")}>
            <Field label={t("admin.verifiedAt")} value={props.enrichment?.verification?.verifiedAt ? formatIsoDate(props.enrichment.verification.verifiedAt) : "—"} />
            <Field label={t("admin.discrepancy")} value={props.enrichment?.verification?.assessment?.discrepancy} />
            <Field label={t("admin.paidAtGateway")} value={props.enrichment?.verification?.assessment?.isPaidAtGateway ? t("common.yes") : props.enrichment?.verification ? t("common.no") : "—"} />
            <Field label={t("admin.paidInternally")} value={props.enrichment?.verification?.assessment?.isPaidInternally ? t("common.yes") : props.enrichment?.verification ? t("common.no") : "—"} />
            <div className="mt-3 border-t border-gray-100 pt-3" />
            <Field label={t("admin.gatewayOrder")} value={props.enrichment?.verification?.gateway?.order?.id ? <span className="font-mono">{maskId(props.enrichment.verification.gateway.order.id, { prefix: 8, suffix: 6 })}</span> : "—"} />
            <Field label={t("admin.gatewayOrderStatus")} value={props.enrichment?.verification?.gateway?.order?.status} />
            <Field label={t("admin.gatewayPayment")} value={props.enrichment?.verification?.gateway?.payment?.id ? <span className="font-mono">{maskId(props.enrichment.verification.gateway.payment.id, { prefix: 8, suffix: 6 })}</span> : "—"} />
            <Field label={t("admin.gatewayPaymentStatus")} value={props.enrichment?.verification?.gateway?.payment?.status} />
            <Field label={t("admin.paymentMethod")} value={props.enrichment?.verification?.gateway?.payment?.method} />
            <Field
              label={t("admin.refunds")}
              value={
                props.enrichment?.verification?.gateway?.refunds?.length ? (
                  <span className="font-mono">{props.enrichment.verification.gateway.refunds.length}</span>
                ) : props.enrichment?.verification ? (
                  "0"
                ) : (
                  "—"
                )
              }
            />
          </Section>

          <Section title={t("admin.recoverySuggestion")}>
            <Field label={t("admin.discrepancy")} value={props.enrichment?.suggestion?.discrepancy} />
            <Field label={t("admin.recommendedAction")} value={props.enrichment?.suggestion?.suggestion?.recommendedAction} />
            <Field label={t("admin.confidence")} value={props.enrichment?.suggestion?.suggestion?.confidence} />
            <Field label={t("admin.safe")} value={props.enrichment?.suggestion?.suggestion?.safe ? t("common.yes") : props.enrichment?.suggestion ? t("common.no") : "—"} />
            <Field label={t("admin.canAutoExecute")} value={props.enrichment?.suggestion?.suggestion?.canAutoExecute ? t("common.yes") : props.enrichment?.suggestion ? t("common.no") : "—"} />
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-600">{t("admin.reason")}</div>
              <div className="mt-1 text-sm text-gray-900">{props.enrichment?.suggestion?.suggestion?.reason || "—"}</div>
            </div>
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-600">{t("admin.nextSteps")}</div>
              <div className="mt-1">
                {props.enrichment?.suggestion?.suggestion?.nextSteps?.length ? (
                  <ul className="list-disc ml-5 text-sm text-gray-900">
                    {props.enrichment.suggestion.suggestion.nextSteps.map((s, idx) => (
                      <li key={String(idx)}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-900">—</div>
                )}
              </div>
            </div>
          </Section>

          <Section title={t("admin.adminControls")}>
            <div className="text-sm text-gray-700">{t("admin.adminInitiatedExecution")}</div>
            {props.lastAuditId ? (
              <div className="mt-2 text-xs text-gray-700">
                {t("admin.lastAudit")}:
                <span className="ml-2 font-mono">{props.lastAuditId}</span>
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!props.canExecuteSuggestedAction}
                onClick={() => {
                  if (props.canExecuteSuggestedAction && props.onExecuteSuggestedAction) {
                    props.onExecuteSuggestedAction();
                  }
                }}
                className={
                  props.canExecuteSuggestedAction
                    ? "rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    : "rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-600 cursor-not-allowed"
                }
              >
                {t("admin.applySuggestedAction")}
              </button>
              <button
                type="button"
                disabled
                className="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-600 cursor-not-allowed"
              >
                {t("admin.lockPermanently")}
              </button>
            </div>
          </Section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
