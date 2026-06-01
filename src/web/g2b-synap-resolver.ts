const G2B_TECH_ANNOUNCE_DETAIL_URL = "https://www.g2b.go.kr/pn/pnp/pnpe/TechBidPbac/selectTechAnncMngV.do";
const G2B_ATTACHMENT_DOC_VIEWER_URL = "https://www.g2b.go.kr/fs/fsc/fsca/atchFileDocViewer.do";

const G2B_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
  "content-type": "application/json;charset=UTF-8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

export type ResolveG2bSynapViewerUrlInput = {
  sourceUrl: string;
  fetchImpl?: typeof fetch;
};

export async function resolveG2bSynapViewerUrl(
  input: ResolveG2bSynapViewerUrlInput
): Promise<string | undefined> {
  const attachment = parseG2bAttachmentUrl(input.sourceUrl);
  if (!attachment) {
    return undefined;
  }

  const fetcher = input.fetchImpl ?? fetch;
  const groupNo = await fetchNoticeAttachmentGroupNo(fetcher, attachment.bidNo, attachment.bidOrd);
  if (!groupNo) {
    return undefined;
  }

  return fetchSynapViewerUrl(fetcher, groupNo, attachment.fileSeq);
}

export function isG2bAttachmentDownloadUrl(value: string): boolean {
  return Boolean(parseG2bAttachmentUrl(value));
}

async function fetchNoticeAttachmentGroupNo(fetcher: typeof fetch, bidNo: string, bidOrd: string): Promise<string | undefined> {
  const response = await fetcher(G2B_TECH_ANNOUNCE_DETAIL_URL, {
    method: "POST",
    headers: G2B_HEADERS,
    body: JSON.stringify({ dmItemMap: { bidPbancNo: bidNo, bidPbancOrd: bidOrd } })
  });
  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as G2bDetailPayload;
  return stringValue(payload.dmItemMap?.itemPbancUntyAtchFileNo);
}

async function fetchSynapViewerUrl(fetcher: typeof fetch, groupNo: string, fileSeq: number): Promise<string | undefined> {
  const response = await fetcher(G2B_ATTACHMENT_DOC_VIEWER_URL, {
    method: "POST",
    headers: G2B_HEADERS,
    body: JSON.stringify({
      dlDownAtflGrpDetlM: {
        untyAtchFileNo: groupNo,
        atchFileSqno: fileSeq
      }
    })
  });
  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as G2bViewerPayload;
  const viewUrl = stringValue(payload.result?.viewUrlPath);
  return viewUrl && isG2bSynapViewerUrl(viewUrl) ? viewUrl : undefined;
}

function parseG2bAttachmentUrl(value: string): { bidNo: string; bidOrd: string; fileSeq: number } | undefined {
  try {
    const url = new URL(value);
    const isG2bHost = url.hostname.endsWith("g2b.go.kr");
    const isAttachmentPath = url.pathname.includes("/UntyAtchFile/downloadFile.do");
    if (!isG2bHost || !isAttachmentPath) {
      return undefined;
    }

    const bidNo = stringValue(url.searchParams.get("bidPbancNo"));
    const bidOrd = normalizeBidOrd(url.searchParams.get("bidPbancOrd"));
    const fileSeq = Number(url.searchParams.get("fileSeq") ?? "1");
    if (!bidNo || !Number.isInteger(fileSeq) || fileSeq < 1) {
      return undefined;
    }

    return { bidNo, bidOrd, fileSeq };
  } catch {
    return undefined;
  }
}

function normalizeBidOrd(value: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits ? digits.padStart(3, "0") : "000";
}

function isG2bSynapViewerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("g2b.go.kr") && url.pathname.includes("/SynapDocViewServer/viewer/doc.html");
  } catch {
    return false;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

type G2bDetailPayload = {
  dmItemMap?: {
    itemPbancUntyAtchFileNo?: unknown;
  };
};

type G2bViewerPayload = {
  result?: {
    viewUrlPath?: unknown;
  };
};
