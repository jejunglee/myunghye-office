# 개발 소스

- 화면: `index.html`, `styles.css`
- 기능: `core.js` → `seed.js` → `remote.js`(Supabase 연동) → `views-*.js`
- 서버 설정: `supabase_setup.sql` (Supabase SQL Editor에서 실행)

## 배포용 파일 만들기
```
python src/bundle.py index.html
```
하나로 합쳐진 `index.html`이 만들어지며, 이것을 커밋·푸시하면 GitHub Pages에 반영됩니다.
