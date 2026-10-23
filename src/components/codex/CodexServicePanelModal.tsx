import { Copy, Eye, EyeOff, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface CodexServicePanelMetricItem {
  key: string;
  label: string;
  value: string;
  meta?: string;
  rawKey?: string;
}

export interface CodexServicePanelActionItem {
  key: string;
  label: string;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

interface CodexServicePanelModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  baseUrl: string;
  apiKeyDisplay: string;
  rawApiKey?: string;
  apiKeyVisible?: boolean;
  onClose: () => void;
  onToggleApiKeyVisible?: () => void;
  coreMetrics: CodexServicePanelMetricItem[];
  detailMetrics: CodexServicePanelMetricItem[];
  actions: CodexServicePanelActionItem[];
  connectionExtra?: ReactNode;
  emptyDetailText?: string;
}

export function CodexServicePanelModal({
  open,
  title,
  subtitle,
  baseUrl,
  apiKeyDisplay,
  rawApiKey,
  apiKeyVisible = false,
  onClose,
  onToggleApiKeyVisible,
  coreMetrics,
  detailMetrics,
  actions,
  connectionExtra,
  emptyDetailText,
}: CodexServicePanelModalProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-content juling-api-panel-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header juling-api-panel-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? (
              <span className="juling-api-panel-subtitle">{subtitle}</span>
            ) : null}
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label={t("common.close", "关闭")}
          >
            <X />
          </button>
        </div>

        <div className="juling-api-panel-body">
          <section className="juling-api-connection-card">
            <div className="juling-api-connection-row">
              <span>{t("codex.localAccess.baseUrl", "地址")}</span>
              <code title={baseUrl}>{baseUrl}</code>
              <button
                type="button"
                className="folder-icon-btn juling-api-icon-btn"
                onClick={() =>
                  void navigator.clipboard.writeText(baseUrl).catch(() => {})
                }
                title={t("common.copy", "复制")}
              >
                <Copy size={14} />
              </button>
            </div>
            <div className="juling-api-connection-row">
              <span>{t("codex.localAccess.apiKey", "密钥")}</span>
              <code title={apiKeyVisible ? rawApiKey || "" : ""}>
                {apiKeyDisplay}
              </code>
              <div className="juling-api-connection-actions">
                {onToggleApiKeyVisible ? (
                  <button
                    type="button"
                    className="folder-icon-btn juling-api-icon-btn"
                    onClick={onToggleApiKeyVisible}
                    title={
                      apiKeyVisible
                        ? t("codex.localAccess.hideKey", "隐藏密钥")
                        : t("codex.localAccess.showKey", "显示密钥")
                    }
                  >
                    {apiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="folder-icon-btn juling-api-icon-btn"
                  onClick={() =>
                    void navigator.clipboard.writeText(rawApiKey || "").catch(() => {})
                  }
                  title={t("common.copy", "复制")}
                  disabled={!rawApiKey}
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            {connectionExtra}
          </section>

          <section className="juling-api-summary-grid compact">
            {coreMetrics.map((item) => (
              <div
                className="juling-api-stat-card juling-api-stat-card-center"
                key={item.key}
              >
                <span className="juling-api-card-label">{item.label}</span>
                <strong>{item.value}</strong>
                {item.meta ? <small>{item.meta}</small> : null}
              </div>
            ))}
          </section>

          <section className="juling-api-panel-section">
            <div className="juling-api-section-head">
              <strong>
                {t("codex.modelProviders.usage.rawFields", "服务数据")}
              </strong>
            </div>
            <div className="juling-api-usage-card-grid">
              {detailMetrics.length > 0 ? (
                detailMetrics.map((item) => (
                  <div className="juling-api-usage-card" key={item.key}>
                    <span className="juling-api-card-label">{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.rawKey ? <small>{item.rawKey}</small> : null}
                  </div>
                ))
              ) : (
                <div className="juling-api-empty-row">
                  {emptyDetailText || t("codex.julingApi.noStats", "暂无统计")}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="modal-footer juling-api-panel-footer">
          {actions.map((action) => (
            <button
              key={action.key}
              className={`btn ${action.variant === "primary" ? "btn-primary" : "btn-secondary"}`}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
