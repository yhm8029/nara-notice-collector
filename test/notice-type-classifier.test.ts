import { describe, expect, it } from "vitest";
import {
  classifyNoticeType,
  noticeTypeToKorean
} from "../src/classify/notice-type-classifier.js";

describe("notice type classifier", () => {
  it("classifies construction notices by title keywords", () => {
    expect(classifyNoticeType("OO초등학교 개축공사")).toBe("construction");
    expect(classifyNoticeType("청사 옥상 방수 보수공사")).toBe("construction");
  });

  it("classifies goods notices by title keywords", () => {
    expect(classifyNoticeType("자동제어 장비 구매")).toBe("goods");
    expect(classifyNoticeType("실험실 기자재 납품")).toBe("goods");
  });

  it("classifies service notices by title keywords", () => {
    expect(classifyNoticeType("전기설비 정기점검 용역")).toBe("service");
    expect(classifyNoticeType("교통영향평가 컨설팅")).toBe("service");
  });

  it("classifies ambiguous titles as domestic procurement", () => {
    expect(classifyNoticeType("스마트시티 플랫폼 구축")).toBe("domestic");
    expect(classifyNoticeType("")).toBe("domestic");
  });

  it("applies construction before goods and service when multiple keywords appear", () => {
    expect(classifyNoticeType("기계설비공사 감리 용역")).toBe("construction");
  });

  it("converts notice type to Korean export labels", () => {
    expect(noticeTypeToKorean("construction")).toBe("공사");
    expect(noticeTypeToKorean("goods")).toBe("물품");
    expect(noticeTypeToKorean("service")).toBe("용역");
    expect(noticeTypeToKorean("domestic")).toBe("내자");
  });
});
