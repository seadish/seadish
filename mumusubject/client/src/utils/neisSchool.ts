// client/src/utils/neisSchool.ts
export interface School {
  code: string;
  name: string;
  regionCode: string;
  regionName: string;
  kind: string;
  address?: string;
}

const API_KEY: string = (import.meta.env.VITE_NEIS_API_KEY ?? '').trim();
const BASE_URL = 'https://open.neis.go.kr/hub/schoolInfo';

interface NeisRow {
  ATPT_OFCDC_SC_CODE?: string;
  ATPT_OFCDC_SC_NM?: string;
  SD_SCHUL_CODE?: string;
  SCHUL_NM?: string;
  SCHUL_KND_SC_NM?: string;
  ORG_RDNMA?: string;
}

interface NeisResponse {
  schoolInfo?: Array<
    | { head?: Array<{ list_total_count?: number; RESULT?: { CODE: string; MESSAGE: string } }> }
    | { row?: NeisRow[] }
  >;
  RESULT?: { CODE: string; MESSAGE: string };
}

export async function searchElementarySchools(query: string): Promise<School[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!API_KEY) {
    console.warn('[neis] VITE_NEIS_API_KEY 미설정 — 학교 검색 불가');
    return [];
  }

  const params = new URLSearchParams({
    KEY: API_KEY, Type: 'json',
    pIndex: '1', pSize: '100',
    SCHUL_NM: trimmed,
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`NEIS 응답 오류 (HTTP ${res.status})`);
  const data = (await res.json()) as NeisResponse;

  if (data.RESULT && data.RESULT.CODE !== 'INFO-000') return [];

  const rowsContainer = data.schoolInfo?.find((b) => 'row' in b) as { row?: NeisRow[] } | undefined;
  const rows = rowsContainer?.row ?? [];

  return rows
    .filter((r) => (r.SCHUL_KND_SC_NM ?? '').includes('초등'))
    .map<School>((r) => ({
      code: r.SD_SCHUL_CODE ?? '',
      name: r.SCHUL_NM ?? '',
      regionCode: r.ATPT_OFCDC_SC_CODE ?? '',
      regionName: r.ATPT_OFCDC_SC_NM ?? '',
      kind: r.SCHUL_KND_SC_NM ?? '',
      address: r.ORG_RDNMA,
    }))
    .filter((s) => s.code && s.name);
}
