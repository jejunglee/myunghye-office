/* =========================================================
   초기 데이터 — 빈 상태로 시작 (관리자 계정 + 부서 구성만)
   ========================================================= */
const DOC_CATEGORIES = ['회의자료', '업무계획', '연수·연구', '행정', '공문', '급식', '기타'];
const MEETING_TYPES = ['전체 교직원회의', '부장회의', '교육과정위원회', '학업성적관리위원회', '개별화교육지원팀', '고교학점제 협의회', '사용자 참여 설계 협의회', '기타 회의'];
const ALLERGY = ['난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣'];
const DEFAULT_DEPTS = [
  { id: 'd1', name: '교무기획부', color: '#0071e3' },
  { id: 'd2', name: '교육운영부', color: '#ff9500' },
  { id: 'd3', name: '교육역량부', color: '#af52de' },
  { id: 'd4', name: '교육정보부', color: '#30b0c7' },
  { id: 'd5', name: '인성교육부', color: '#34c759' },
  { id: 'd6', name: '취업전환부', color: '#5856d6' },
  { id: 'd7', name: '학생생활안전부', color: '#ff2d55' },
];

function seedDB() {
  return {
    depts: DEFAULT_DEPTS.map((d) => ({ ...d })),
    users: [],
    events: [], meetings: [], docs: [], notices: [], notis: [], logs: [], trash: [], meals: {},
    meetingTypes: MEETING_TYPES.slice(), categories: DOC_CATEGORIES.slice(),
    settings: { lockMinutes: 30 },
    createdAt: nowISO(),
  };
}
