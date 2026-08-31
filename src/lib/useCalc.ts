import { useMemo } from "react";
import { buildCalc, type CalcBundle } from "./mrvData";
import { useUI, activeEf } from "../store";

/* 검토·승인 상태와 적용 배출계수·단가를 반영한 산정 번들.
   승인된 비일상적 조정·새 배출계수가 반영될 때마다 새 계산버전이 된다. */
export function useCalc(): CalcBundle {
  const reviewStates = useUI((s) => s.reviewStates);
  const efList = useUI((s) => s.efList);
  const tariffValue = useUI((s) => s.tariffValue);
  return useMemo(() => {
    const nrStatus: Record<string, string> = {};
    for (const [id, st] of Object.entries(reviewStates)) {
      if (id.startsWith("NR-") && st === "승인 완료") nrStatus[id] = "승인 완료";
    }
    const ef = activeEf(efList);
    return buildCalc(nrStatus, {
      efValue: ef.value,
      tariffValue,
      extraVersions: efList.length - 1,
    });
  }, [reviewStates, efList, tariffValue]);
}
