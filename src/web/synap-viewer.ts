export type ViewerUrlMode = "synap" | "source";

export type ViewerUrlInput = {
  sourceUrl: string;
  title?: string;
};

export type SynapViewerConfig = {
  template?: string;
};

export type ViewerUrlResult = {
  mode: ViewerUrlMode;
  viewerUrl: string;
  message?: string;
};

export function buildSynapViewerUrl(input: ViewerUrlInput, config: SynapViewerConfig = {}): ViewerUrlResult {
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const template = config.template?.trim();

  if (!template) {
    return {
      mode: "source",
      viewerUrl: sourceUrl,
      message: "SYNAP_VIEWER_URL_TEMPLATE is not configured. Opening the original notice link."
    };
  }

  if (!template.includes("{url}")) {
    throw new Error("SYNAP_VIEWER_URL_TEMPLATE must include a {url} placeholder.");
  }

  return {
    mode: "synap",
    viewerUrl: template
      .replaceAll("{url}", encodeURIComponent(sourceUrl))
      .replaceAll("{title}", encodeURIComponent(input.title?.trim() ?? ""))
  };
}

function normalizeSourceUrl(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    throw new Error("sourceUrl is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("sourceUrl must be a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("sourceUrl must use http or https.");
  }

  return parsed.href;
}
