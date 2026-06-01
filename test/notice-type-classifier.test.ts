import { describe, expect, it } from "vitest";
import {
  classifyNoticeType,
  noticeTypeToKorean
} from "../src/classify/notice-type-classifier.js";

describe("notice type classifier", () => {
  it("classifies construction notices from the Nara API business division", () => {
    expect(classifyNoticeType({ bsnsDivNm: "공사", bidNtceNm: "키워드 없는 제목" })).toBe("construction");
  });

  it("classifies goods notices from the Nara API business division", () => {
    expect(classifyNoticeType({ bsnsDivNm: "물품", bidNtceNm: "키워드 없는 제목" })).toBe("goods");
  });

  it("classifies service notices from the Nara API business division", () => {
    expect(classifyNoticeType({ bsnsDivNm: "용역", bidNtceNm: "키워드 없는 제목" })).toBe("service");
  });

  it("classifies domestic notices from the Nara API business division", () => {
    expect(classifyNoticeType({ bsnsDivNm: "내자", bidNtceNm: "키워드 없는 제목" })).toBe("domestic");
  });

  it("uses the endpoint type hint when the response has no business division", () => {
    expect(classifyNoticeType({ noticeTypeHint: "goods", bidNtceNm: "키워드 없는 제목" })).toBe("goods");
  });

  it("does not classify by title keywords when API type fields are missing", () => {
    expect(classifyNoticeType({ bidNtceNm: "OO초등학교 개축공사" })).toBe("domestic");
  });

  it("converts notice type to Korean export labels", () => {
    expect(noticeTypeToKorean("construction")).toBe("공사");
    expect(noticeTypeToKorean("goods")).toBe("물품");
    expect(noticeTypeToKorean("service")).toBe("용역");
    expect(noticeTypeToKorean("domestic")).toBe("내자");
  });
});
