import { describe, expect, it, vi } from "vitest";
import { resolveG2bSynapViewerUrl } from "../src/web/g2b-synap-resolver.js";

describe("resolveG2bSynapViewerUrl", () => {
  it("resolves a G2B attachment download URL into a Synap viewer URL", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responseJson({
          dmItemMap: {
            itemPbancUntyAtchFileNo: "2e0fb8fe-cfb7-4348-8461-1343da0d748b"
          }
        })
      )
      .mockResolvedValueOnce(
        responseJson({
          result: {
            viewUrlPath:
              "https://www.g2b.go.kr/SynapDocViewServer/viewer/doc.html?key=resolved-key&convType=img&convLocale=ko_KR&contextPath=/SynapDocViewServer"
          }
        })
      );

    const result = await resolveG2bSynapViewerUrl({
      sourceUrl:
        "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R25BK00830087&bidPbancOrd=000&fileSeq=3&prcmBsneSeCd=05",
      fetchImpl
    });

    expect(result).toBe(
      "https://www.g2b.go.kr/SynapDocViewServer/viewer/doc.html?key=resolved-key&convType=img&convLocale=ko_KR&contextPath=/SynapDocViewServer"
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://www.g2b.go.kr/pn/pnp/pnpe/TechBidPbac/selectTechAnncMngV.do",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ dmItemMap: { bidPbancNo: "R25BK00830087", bidPbancOrd: "000" } })
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://www.g2b.go.kr/fs/fsc/fsca/atchFileDocViewer.do",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dlDownAtflGrpDetlM: {
            untyAtchFileNo: "2e0fb8fe-cfb7-4348-8461-1343da0d748b",
            atchFileSqno: 3
          }
        })
      })
    );
  });

  it("returns undefined for non-G2B attachment URLs", async () => {
    const fetchImpl = vi.fn();

    await expect(
      resolveG2bSynapViewerUrl({ sourceUrl: "https://example.com/notice.pdf", fetchImpl })
    ).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function responseJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  };
}
