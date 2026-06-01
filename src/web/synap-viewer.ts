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
      message: "Synap 문서뷰어 설정이 없어 공고문 링크를 직접 엽니다."
    };
  }

  if (!template.includes("{url}")) {
    throw new Error("Synap 문서뷰어 URL 템플릿에는 {url} 값이 포함되어야 합니다.");
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
    throw new Error("공고문 링크가 필요합니다.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("공고문 링크 형식이 올바르지 않습니다.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("공고문 링크는 http 또는 https 주소여야 합니다.");
  }

  return parsed.href;
}
