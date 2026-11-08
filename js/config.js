/* 배포 설정 — Supabase 공개 키(anon / publishable)는 브라우저에 노출돼도 되는 키예요.
   실제 데이터 접근은 supabase/schema.sql 의 함수와 "동기화 코드"로만 가능해요. */
window.TRIP_CONFIG = {
  supabaseUrl: 'https://uieewficbwyrcvwjsdvh.supabase.co',
  supabaseKey: 'sb_publishable_s7_8oLGsu9nzsbiic-z-yQ_WcFouNBF',
  siteUrl: 'https://ms63-v0.github.io/fukuoka-trip/',
};
