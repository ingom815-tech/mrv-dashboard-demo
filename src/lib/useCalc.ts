import { useMemo } from "react";
import { buildCalc, type CalcBundle } from "./mrvData";
import { useUI } from "../store";

/* 검토·승인 상태를 반영한 산정 번들.
   승인 완료된 비일상적 조정만 조정 기준선에 반영되며, 반영 시 새 계산버전이 된다. */
export function useCalc(): CalcBundle {
  const reviewStates = useUI((s) => s.reviewStates);
  return useMemo(() => {
    const nrStatus: Record<string, string> = {};
    for (const [id, st] of Object.entries(reviewStates)) {
      if (id.startsWith("NR-") && st === "승인 완료") nrStatus[id] = "승인 완료";
    }
    return buildCalc(nrStatus);
  }, [reviewStates]);
}
